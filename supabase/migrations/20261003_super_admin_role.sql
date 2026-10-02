-- ================================================
-- دور الأدمن الرئيسي (super_admin) — المتحكم الوحيد
-- ================================================
-- التسلسل الهرمي الجديد للأدوار في team_members.role:
--
--   super_admin  — الأدمن الرئيسي: المتحكم الوحيد في النظام.
--                  يتجاوز كل الفحوصات، يرى كل الشجرات،
--                  لا يظهر ولا يُمَس من أي حساب آخر مهما كان دوره،
--                  ووحده من ينشئ حسابات leader.
--
--   leader       — ليدر: كل الصلاحيات لكن داخل شجرته فقط
--                  (نفسه + كل من تحته بسلسلة parent_id).
--                  لا يرى الأدمن الرئيسي ولا شجرات الليدرات الآخرين.
--
--   assistant    — مشرف مساعد: حسب JSON الصلاحيات + نطاق شجرته.
--
-- ⚠️ شغّله في Supabase SQL Editor
-- ✅ آمن: لا يلمس سياسات القراءة العامة للطلاب ولا بياناتهم.
-- ================================================

-- ==========================================
-- 1) تطوير دالة الفحص: super_admin و leader يتجاوزون كل الفحوصات
-- (نفس الاسم والسلوك — للتوافق مع كل اللي بيستخدمها)
-- ==========================================
CREATE OR REPLACE FUNCTION public.has_admin_permission(p_user_id UUID, p_resource TEXT, p_action TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    perms JSONB;
    user_role TEXT;
BEGIN
    IF p_user_id IS NULL OR p_resource IS NULL OR p_action IS NULL THEN
        RETURN FALSE;
    END IF;

    SELECT permissions, role INTO perms, user_role
    FROM public.team_members
    WHERE user_id = p_user_id
    LIMIT 1;

    IF perms IS NULL THEN
        RETURN FALSE;
    END IF;

    -- الأدمن الرئيسي والليدر عندهم كل الأذونات
    IF user_role IN ('super_admin', 'leader') THEN
        RETURN TRUE;
    END IF;

    RETURN COALESCE(((perms -> p_resource) ->> p_action)::BOOLEAN, FALSE);
END;
$$;

-- ==========================================
-- 2) (اختياري — مرة واحدة) ترقية حساب الأدمن الرئيسي
-- استبدل <USER_ID> بالـ UUID بتاع حساب الأدمن الرئيسي
-- (ممكن تجيبه من: SELECT id, phone FROM auth.users WHERE phone LIKE '%40945655';)
-- ==========================================
-- UPDATE public.team_members
-- SET role = 'super_admin',
--     permissions = '{
--         "inquiries": {"view": true, "reply": true, "create": true, "edit": true, "delete": true},
--         "announcements": {"view": true, "create": true, "edit": true, "delete": true},
--         "tasks": {"view": true, "create": true, "edit": true, "delete": true},
--         "schedules": {"view": true, "create": true, "edit": true, "delete": true},
--         "subjects": {"view": true, "create": true, "edit": true, "delete": true},
--         "important_dates": {"view": true, "create": true, "edit": true, "delete": true},
--         "submissions": {"view": true, "review": true},
--         "attendance": {"view": true, "create": true, "edit": true},
--         "links": {"view": true, "edit": true},
--         "team": {"view": true, "create": true, "edit": true, "delete": true},
--         "api_keys": {"view": true, "create": true, "delete": true},
--         "mcp": {"view": true, "test": true},
--         "settings": {"view": true, "edit": true}
--     }'::jsonb
-- WHERE user_id = '<USER_ID>';
