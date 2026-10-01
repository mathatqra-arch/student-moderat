-- ================================================
-- فرض الصلاحيات فعلياً على مستوى قاعدة البيانات (RLS)
-- ================================================
-- قبل الملف ده: أي عضو فريق (مساعد) كان يقدر يعمل كل شيء
-- على كل الجداول مباشرة من المتصفح — الصلاحيات كانت للعرض فقط.
--
-- بعد الملف ده: كل عملية على كل جدول بتفحص
-- has_admin_permission(auth.uid(), resource, action)
-- الـ leader يتجاوز كل الفحوصات (داخل الدالة).
--
-- ⚠️ شغّله في Supabase SQL Editor (ملف واحد، بترتيبه)
-- ✅ آمن: سياسات القراءة العامة للطلاب (FOR SELECT USING (true))
--    والإدخال المجهول (inquiries/submissions/push_subscriptions) مش بتتمس.
-- ================================================

-- ==========================================
-- 1) تطوير دالة الفحص: STABLE + search_path + حماية من NULL
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

    -- الـ leader عنده كل الأذونات
    IF user_role = 'leader' THEN
        RETURN TRUE;
    END IF;

    RETURN COALESCE(((perms -> p_resource) ->> p_action)::BOOLEAN, FALSE);
END;
$$;

-- ==========================================
-- 2) إضافة مورد links + backfill للموارد الناقصة
-- (الحسابات القديمة JSON بتاعها ناقص مجموعات اتضافت بعدين
--  → من غير backfill المساعد بيتمنع حتى من العرض رغم إن الواجهة بتعرضها متاحة)
-- ==========================================
ALTER TABLE public.team_members
    ALTER COLUMN permissions SET DEFAULT '{
        "inquiries": {"view": true, "reply": true, "delete": false},
        "announcements": {"view": true, "create": true, "edit": true, "delete": false},
        "tasks": {"view": true, "create": true, "edit": true, "delete": false},
        "schedules": {"view": true, "create": false, "edit": false, "delete": false},
        "subjects": {"view": true, "create": false, "edit": false, "delete": false},
        "important_dates": {"view": true, "create": false, "edit": false, "delete": false},
        "submissions": {"view": true, "review": false},
        "attendance": {"view": true, "create": false, "edit": false},
        "links": {"view": true, "edit": false},
        "team": {"view": true, "create": false, "edit": false, "delete": false},
        "api_keys": {"view": false, "create": false, "delete": false},
        "mcp": {"view": false, "test": false},
        "settings": {"view": false, "edit": false}
    }'::jsonb;

-- backfill: نضيف فقط المفاتيح الناقصة (|| ما يعدّلش الموجود)
UPDATE public.team_members SET permissions = permissions || '{"schedules": {"view": true, "create": false, "edit": false, "delete": false}}'::jsonb
WHERE role IS DISTINCT FROM 'leader' AND NOT (permissions ? 'schedules');
UPDATE public.team_members SET permissions = permissions || '{"subjects": {"view": true, "create": false, "edit": false, "delete": false}}'::jsonb
WHERE role IS DISTINCT FROM 'leader' AND NOT (permissions ? 'subjects');
UPDATE public.team_members SET permissions = permissions || '{"important_dates": {"view": true, "create": false, "edit": false, "delete": false}}'::jsonb
WHERE role IS DISTINCT FROM 'leader' AND NOT (permissions ? 'important_dates');
UPDATE public.team_members SET permissions = permissions || '{"submissions": {"view": true, "review": false}}'::jsonb
WHERE role IS DISTINCT FROM 'leader' AND NOT (permissions ? 'submissions');
UPDATE public.team_members SET permissions = permissions || '{"attendance": {"view": true, "create": false, "edit": false}}'::jsonb
WHERE role IS DISTINCT FROM 'leader' AND NOT (permissions ? 'attendance');
UPDATE public.team_members SET permissions = permissions || '{"links": {"view": true, "edit": false}}'::jsonb
WHERE role IS DISTINCT FROM 'leader' AND NOT (permissions ? 'links');

-- ==========================================
-- 3) الإعلانات — announcements
-- view / create / edit / delete
-- ==========================================
DROP POLICY IF EXISTS "Team admin full access announcements" ON public.announcements;
CREATE POLICY "Team admin view announcements"
    ON public.announcements FOR SELECT TO authenticated
    USING (public.has_admin_permission(auth.uid(), 'announcements', 'view'));
CREATE POLICY "Team admin create announcements"
    ON public.announcements FOR INSERT TO authenticated
    WITH CHECK (public.has_admin_permission(auth.uid(), 'announcements', 'create'));
CREATE POLICY "Team admin edit announcements"
    ON public.announcements FOR UPDATE TO authenticated
    USING (public.has_admin_permission(auth.uid(), 'announcements', 'edit'))
    WITH CHECK (public.has_admin_permission(auth.uid(), 'announcements', 'edit'));
CREATE POLICY "Team admin delete announcements"
    ON public.announcements FOR DELETE TO authenticated
    USING (public.has_admin_permission(auth.uid(), 'announcements', 'delete'));

-- ==========================================
-- 4) التكليفات — tasks
-- view / create / edit / delete
-- ==========================================
DROP POLICY IF EXISTS "Team admin full access tasks" ON public.tasks;
CREATE POLICY "Team admin view tasks"
    ON public.tasks FOR SELECT TO authenticated
    USING (public.has_admin_permission(auth.uid(), 'tasks', 'view'));
CREATE POLICY "Team admin create tasks"
    ON public.tasks FOR INSERT TO authenticated
    WITH CHECK (public.has_admin_permission(auth.uid(), 'tasks', 'create'));
CREATE POLICY "Team admin edit tasks"
    ON public.tasks FOR UPDATE TO authenticated
    USING (public.has_admin_permission(auth.uid(), 'tasks', 'edit'))
    WITH CHECK (public.has_admin_permission(auth.uid(), 'tasks', 'edit'));
CREATE POLICY "Team admin delete tasks"
    ON public.tasks FOR DELETE TO authenticated
    USING (public.has_admin_permission(auth.uid(), 'tasks', 'delete'));

-- ==========================================
-- 5) الاستفسارات — inquiries
-- view / reply (تحديث الحالة) / delete
-- الإدخال المجهول للطلاب بيفضل زي ما هو (سياسة منفصلة)
-- ==========================================
DROP POLICY IF EXISTS "Team admin full access inquiries" ON public.inquiries;
CREATE POLICY "Team admin view inquiries"
    ON public.inquiries FOR SELECT TO authenticated
    USING (public.has_admin_permission(auth.uid(), 'inquiries', 'view'));
CREATE POLICY "Team admin reply inquiries"
    ON public.inquiries FOR UPDATE TO authenticated
    USING (public.has_admin_permission(auth.uid(), 'inquiries', 'reply'))
    WITH CHECK (public.has_admin_permission(auth.uid(), 'inquiries', 'reply'));
CREATE POLICY "Team admin delete inquiries"
    ON public.inquiries FOR DELETE TO authenticated
    USING (public.has_admin_permission(auth.uid(), 'inquiries', 'delete'));

-- ==========================================
-- 6) الروابط السريعة — quick_links
-- links: view / edit (إضافة وتعديل وحذف = edit)
-- ==========================================
DROP POLICY IF EXISTS "Team admin full access quick_links" ON public.quick_links;
CREATE POLICY "Team admin view quick_links"
    ON public.quick_links FOR SELECT TO authenticated
    USING (public.has_admin_permission(auth.uid(), 'links', 'view'));
CREATE POLICY "Team admin create quick_links"
    ON public.quick_links FOR INSERT TO authenticated
    WITH CHECK (public.has_admin_permission(auth.uid(), 'links', 'edit'));
CREATE POLICY "Team admin edit quick_links"
    ON public.quick_links FOR UPDATE TO authenticated
    USING (public.has_admin_permission(auth.uid(), 'links', 'edit'))
    WITH CHECK (public.has_admin_permission(auth.uid(), 'links', 'edit'));
CREATE POLICY "Team admin delete quick_links"
    ON public.quick_links FOR DELETE TO authenticated
    USING (public.has_admin_permission(auth.uid(), 'links', 'edit'));

-- ==========================================
-- 7) المواد — subjects
-- view / create / edit / delete
-- ==========================================
DROP POLICY IF EXISTS "Team admin full access subjects" ON public.subjects;
CREATE POLICY "Team admin view subjects"
    ON public.subjects FOR SELECT TO authenticated
    USING (public.has_admin_permission(auth.uid(), 'subjects', 'view'));
CREATE POLICY "Team admin create subjects"
    ON public.subjects FOR INSERT TO authenticated
    WITH CHECK (public.has_admin_permission(auth.uid(), 'subjects', 'create'));
CREATE POLICY "Team admin edit subjects"
    ON public.subjects FOR UPDATE TO authenticated
    USING (public.has_admin_permission(auth.uid(), 'subjects', 'edit'))
    WITH CHECK (public.has_admin_permission(auth.uid(), 'subjects', 'edit'));
CREATE POLICY "Team admin delete subjects"
    ON public.subjects FOR DELETE TO authenticated
    USING (public.has_admin_permission(auth.uid(), 'subjects', 'delete'));

-- ==========================================
-- 8) الجداول — schedules
-- view / create / edit / delete
-- ==========================================
DROP POLICY IF EXISTS "Team admin full access schedules" ON public.schedules;
CREATE POLICY "Team admin view schedules"
    ON public.schedules FOR SELECT TO authenticated
    USING (public.has_admin_permission(auth.uid(), 'schedules', 'view'));
CREATE POLICY "Team admin create schedules"
    ON public.schedules FOR INSERT TO authenticated
    WITH CHECK (public.has_admin_permission(auth.uid(), 'schedules', 'create'));
CREATE POLICY "Team admin edit schedules"
    ON public.schedules FOR UPDATE TO authenticated
    USING (public.has_admin_permission(auth.uid(), 'schedules', 'edit'))
    WITH CHECK (public.has_admin_permission(auth.uid(), 'schedules', 'edit'));
CREATE POLICY "Team admin delete schedules"
    ON public.schedules FOR DELETE TO authenticated
    USING (public.has_admin_permission(auth.uid(), 'schedules', 'delete'));

-- ==========================================
-- 9) التواريخ المهمة — important_dates
-- view / create / edit / delete
-- ==========================================
DROP POLICY IF EXISTS "Team admin full access important_dates" ON public.important_dates;
CREATE POLICY "Team admin view important_dates"
    ON public.important_dates FOR SELECT TO authenticated
    USING (public.has_admin_permission(auth.uid(), 'important_dates', 'view'));
CREATE POLICY "Team admin create important_dates"
    ON public.important_dates FOR INSERT TO authenticated
    WITH CHECK (public.has_admin_permission(auth.uid(), 'important_dates', 'create'));
CREATE POLICY "Team admin edit important_dates"
    ON public.important_dates FOR UPDATE TO authenticated
    USING (public.has_admin_permission(auth.uid(), 'important_dates', 'edit'))
    WITH CHECK (public.has_admin_permission(auth.uid(), 'important_dates', 'edit'));
CREATE POLICY "Team admin delete important_dates"
    ON public.important_dates FOR DELETE TO authenticated
    USING (public.has_admin_permission(auth.uid(), 'important_dates', 'delete'));

-- ==========================================
-- 10) التسليمات — submissions
-- view / review — الإدخال المجهول للطلاب بيفضل زي ما هو
-- ==========================================
DROP POLICY IF EXISTS "Team admin full access submissions" ON public.submissions;
CREATE POLICY "Team admin view submissions"
    ON public.submissions FOR SELECT TO authenticated
    USING (public.has_admin_permission(auth.uid(), 'submissions', 'view'));
CREATE POLICY "Team admin review submissions"
    ON public.submissions FOR UPDATE TO authenticated
    USING (public.has_admin_permission(auth.uid(), 'submissions', 'review'))
    WITH CHECK (public.has_admin_permission(auth.uid(), 'submissions', 'review'));

-- ==========================================
-- 11) الحضور — attendance
-- view / create / edit
-- ==========================================
DROP POLICY IF EXISTS "Team admin full access attendance" ON public.attendance;
CREATE POLICY "Team admin view attendance"
    ON public.attendance FOR SELECT TO authenticated
    USING (public.has_admin_permission(auth.uid(), 'attendance', 'view'));
CREATE POLICY "Team admin create attendance"
    ON public.attendance FOR INSERT TO authenticated
    WITH CHECK (public.has_admin_permission(auth.uid(), 'attendance', 'create'));
CREATE POLICY "Team admin edit attendance"
    ON public.attendance FOR UPDATE TO authenticated
    USING (public.has_admin_permission(auth.uid(), 'attendance', 'edit'))
    WITH CHECK (public.has_admin_permission(auth.uid(), 'attendance', 'edit'));

-- ==========================================
-- 12) أعضاء الفريق — team_members (سد ثغرة تصعيد الصلاحيات!)
-- قبل كده: أي مساعد يقدر يعدّل صلاحيات نفسه من الكونسول مباشرة
-- الآن: view / create / edit / delete حسب مورد team
-- (الـ API routes بتستخدم service role → مش متأثرة)
-- ==========================================
DROP POLICY IF EXISTS "Team admin full access team_members" ON public.team_members;
DROP POLICY IF EXISTS "Team admin read team_members" ON public.team_members;
CREATE POLICY "Team admin view team_members"
    ON public.team_members FOR SELECT TO authenticated
    USING (public.has_admin_permission(auth.uid(), 'team', 'view'));
CREATE POLICY "Team admin create team_members"
    ON public.team_members FOR INSERT TO authenticated
    WITH CHECK (public.has_admin_permission(auth.uid(), 'team', 'create'));
CREATE POLICY "Team admin edit team_members"
    ON public.team_members FOR UPDATE TO authenticated
    USING (public.has_admin_permission(auth.uid(), 'team', 'edit'))
    WITH CHECK (public.has_admin_permission(auth.uid(), 'team', 'edit'));
CREATE POLICY "Team admin delete team_members"
    ON public.team_members FOR DELETE TO authenticated
    USING (public.has_admin_permission(auth.uid(), 'team', 'delete'));

-- ==========================================
-- 13) جداول النظام (settings/app_settings/notifications_log/push_subscriptions)
-- تفضل زي ما هي: is_team_admin() — مش مكشوفة في تابات الصلاحيات حالياً
-- ==========================================
-- (بدون تغيير)

-- ==========================================
-- 14) تحقق سريع — شغّل لو حابب تتأكد:
-- SELECT tablename, policyname, cmd FROM pg_policies
-- WHERE schemaname = 'public' AND policyname LIKE 'Team admin %'
-- ORDER BY tablename, cmd;
-- ==========================================
