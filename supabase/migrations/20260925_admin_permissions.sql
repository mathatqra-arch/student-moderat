-- ================================================
-- منصة إدارة الدفعة v3 — نظام الأذونات الهرمية
-- ================================================
-- صاحب المنصة (leader) يرى الكل
-- الأدمن يرى من تحته فقط
-- كل مستخدم يرى من تحته في الـ hierarchy فقط

-- 1. إضافة أعمدة الـ hierarchy لجدول team_members
ALTER TABLE public.team_members
    ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.team_members(id) ON DELETE SET NULL;

ALTER TABLE public.team_members
    ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '{
        "inquiries": {"view": true, "reply": true, "delete": false},
        "announcements": {"view": true, "create": true, "edit": true, "delete": false},
        "tasks": {"view": true, "create": true, "edit": true, "delete": false},
        "schedules": {"view": true, "create": false, "edit": false, "delete": false},
        "subjects": {"view": true, "create": false, "edit": false, "delete": false},
        "important_dates": {"view": true, "create": false, "edit": false, "delete": false},
        "submissions": {"view": true, "review": false},
        "attendance": {"view": true, "create": false, "edit": false},
        "team": {"view": true, "create": false, "edit": false, "delete": false},
        "api_keys": {"view": false, "create": false, "delete": false},
        "mcp": {"view": false, "test": false, "manage": false},
        "settings": {"view": false, "edit": false}
    }'::jsonb;

-- 2. تحديث الأدمن الأساسي (leader) بكل الأذونات
UPDATE public.team_members
SET permissions = '{
    "inquiries": {"view": true, "reply": true, "delete": true},
    "announcements": {"view": true, "create": true, "edit": true, "delete": true},
    "tasks": {"view": true, "create": true, "edit": true, "delete": true},
    "schedules": {"view": true, "create": true, "edit": true, "delete": true},
    "subjects": {"view": true, "create": true, "edit": true, "delete": true},
    "important_dates": {"view": true, "create": true, "edit": true, "delete": true},
    "submissions": {"view": true, "review": true},
    "attendance": {"view": true, "create": true, "edit": true},
    "team": {"view": true, "create": true, "edit": true, "delete": true},
    "api_keys": {"view": true, "create": true, "delete": true},
    "mcp": {"view": true, "test": true, "manage": true},
    "settings": {"view": true, "edit": true}
}'::jsonb,
    role = 'leader',
    parent_id = NULL
WHERE user_id = 'add849e1-fc16-4416-b1c4-740719e31d7c';

-- 3. إضافة عمود password_changed_at
ALTER TABLE public.team_members
    ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;

-- 4. فهارس للبحث السريع
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON public.team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_parent_id ON public.team_members(parent_id);

-- 5. تحديث سياسة RLS
DROP POLICY IF EXISTS "Allow admin full access to team_members" ON public.team_members;
CREATE POLICY "Allow admin full access to team_members"
    ON public.team_members FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- 6. دالة للتحقق من إذن معيّن لمستخدم
CREATE OR REPLACE FUNCTION public.has_admin_permission(p_user_id UUID, p_resource TEXT, p_action TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    perms JSONB;
    user_role TEXT;
BEGIN
    SELECT permissions, role INTO perms, user_role
    FROM public.team_members
    WHERE user_id = p_user_id;

    IF perms IS NULL THEN
        RETURN FALSE;
    END IF;

    -- leaders عندهم كل الأذونات
    IF user_role = 'leader' THEN
        RETURN TRUE;
    END IF;

    -- تحقق من الإذن المحدد
    RETURN COALESCE(((perms -> p_resource) ->> p_action)::BOOLEAN, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. دالة للحصول على كل المستخدمين تحت مستخدم معيّن (recursive)
CREATE OR REPLACE FUNCTION public.get_descendants(p_user_id UUID)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    name TEXT,
    role TEXT,
    parent_id UUID,
    permissions JSONB,
    depth INT
) AS $$
WITH RECURSIVE descendants AS (
    -- المستوى الأول: direct children
    SELECT
        tm.id, tm.user_id, tm.name, tm.role, tm.parent_id, tm.permissions, 1 AS depth
    FROM public.team_members tm
    WHERE tm.parent_id = (
        SELECT id FROM public.team_members WHERE user_id = p_user_id LIMIT 1
    )

    UNION ALL

    -- المستويات الأعم: descendants of children
    SELECT
        tm.id, tm.user_id, tm.name, tm.role, tm.parent_id, tm.permissions, d.depth + 1
    FROM public.team_members tm
    INNER JOIN descendants d ON tm.parent_id = d.id
)
SELECT * FROM descendants;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. دالة للحصول على المستخدمين الذين يظهرهم المستخدم الحالي
CREATE OR REPLACE FUNCTION public.get_visible_team_members(p_user_id UUID)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    name TEXT,
    role TEXT,
    parent_id UUID,
    permissions JSONB,
    created_at TIMESTAMPTZ,
    phone TEXT
) AS $$
BEGIN
    -- لو المستخدم leader → يرى الكل
    IF EXISTS (SELECT 1 FROM public.team_members WHERE user_id = p_user_id AND role = 'leader') THEN
        RETURN QUERY
        SELECT
            tm.id, tm.user_id, tm.name, tm.role, tm.parent_id, tm.permissions, tm.created_at,
            au.phone
        FROM public.team_members tm
        LEFT JOIN auth.users au ON tm.user_id = au.id
        WHERE tm.user_id != p_user_id
        ORDER BY tm.created_at DESC;
        RETURN;
    END IF;

    -- غير leader → يرى الـ descendants فقط
    RETURN QUERY
    SELECT
        d.id, d.user_id, d.name, d.role, d.parent_id, d.permissions, tm.created_at,
        au.phone
    FROM public.get_descendants(p_user_id) d
    LEFT JOIN public.team_members tm ON d.id = tm.id
    LEFT JOIN auth.users au ON d.user_id = au.id
    ORDER BY tm.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
