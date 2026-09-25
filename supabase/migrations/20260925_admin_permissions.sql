-- ================================================
-- منصة إدارة الدفعة - نظام الأذونات (Permissions System)
-- ================================================

-- 1. إضافة عمود permissions لجدول team_members
ALTER TABLE public.team_members
    ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '{
        "inquiries": {"view": true, "reply": true, "delete": false},
        "announcements": {"view": true, "create": true, "edit": true, "delete": false},
        "tasks": {"view": true, "create": true, "edit": true, "delete": false},
        "team": {"view": true, "create": false, "edit": false, "delete": false},
        "api_keys": {"view": false, "create": false, "delete": false},
        "mcp": {"view": false, "test": false},
        "settings": {"view": false, "edit": false}
    }'::jsonb;

-- 2. تحديث الأدمن الأساسي (leader) بكل الأذونات
UPDATE public.team_members
SET permissions = '{
    "inquiries": {"view": true, "reply": true, "delete": true},
    "announcements": {"view": true, "create": true, "edit": true, "delete": true},
    "tasks": {"view": true, "create": true, "edit": true, "delete": true},
    "team": {"view": true, "create": true, "edit": true, "delete": true},
    "api_keys": {"view": true, "create": true, "delete": true},
    "mcp": {"view": true, "test": true},
    "settings": {"view": true, "edit": true}
}'::jsonb,
    role = 'leader'
WHERE user_id = 'add849e1-fc16-4416-b1c4-740719e31d7c';

-- 3. إضافة عمود password_changed_at لتتبع تغيير كلمة المرور
ALTER TABLE public.team_members
    ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;

-- 4. فهرس للبحث السريع
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON public.team_members(user_id);

-- 5. تحديث سياسة RLS — الأدمن المصادق عليه فقط يقدر يقرأ/يعدّل team_members
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
    result BOOLEAN;
BEGIN
    SELECT permissions INTO perms
    FROM public.team_members
    WHERE user_id = p_user_id;

    IF perms IS NULL THEN
        RETURN FALSE;
    END IF;

    -- leaders عندهم كل الأذونات
    IF EXISTS (SELECT 1 FROM public.team_members WHERE user_id = p_user_id AND role = 'leader') THEN
        RETURN TRUE;
    END IF;

    -- تحقق من الإذن المحدد
    result := (perms -> p_resource) ->> p_action;

    RETURN COALESCE(result::BOOLEAN, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
