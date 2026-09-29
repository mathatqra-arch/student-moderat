-- ================================================
-- Production Hardening v2.1.0
-- شغّل هذا الملف في Supabase SQL Editor (واحد فقط، بترتيب)
--
-- 1) Rate Limiting ذري عبر قاعدة البيانات (يعمل مع 1000+ مستخدم متزامن)
-- 2) حماية نقاط الإدخال العامة من الإساءة (Triggers على inquiries/subscriptions)
-- 3) قيود تحقق على البيانات (طول النصوص، صحة الروابط)
-- 4) جدول سجل تدقيق MCP
-- 5) تقوية RLS: استبدال "أي مستخدم مسجل" بفحص دور فعلي (is_team_admin)
-- 6) فهارس أداء للاستعلامات الساخنة
-- 7) قفل جدول api_keys (service role فقط)
-- ================================================

-- ==========================================
-- 1) جدول Rate Limits + دالة ذرية
-- ==========================================
CREATE TABLE IF NOT EXISTS public.rate_limits (
    bucket_key  TEXT        NOT NULL,
    window_start TIMESTAMPTZ NOT NULL,
    hit_count   INT         NOT NULL DEFAULT 0,
    PRIMARY KEY (bucket_key, window_start)
);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
-- لا سياسات على هذا الجدول → الوصول عبر service_role / SECURITY DEFINER فقط

-- دالة ذرية: تحتسب "ضربة" وتقرر السماح أو الرفض
-- آمنة ضد السباقات (atomic upsert) وتناسب التزامن العالي
CREATE OR REPLACE FUNCTION public.rate_limit_hit(
    p_key            TEXT,
    p_window_seconds INT,
    p_max            INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_bucket_start TIMESTAMPTZ;
    v_current      INT;
    v_allowed      BOOLEAN;
    v_retry_after  INT;
BEGIN
    -- نافذة زمنية ثابتة (fixed window)
    v_bucket_start := to_timestamp(
        floor(extract(epoch FROM now()) / GREATEST(p_window_seconds, 1)) * GREATEST(p_window_seconds, 1)
    );

    -- زيادة ذرية
    INSERT INTO public.rate_limits (bucket_key, window_start, hit_count)
    VALUES (p_key, v_bucket_start, 1)
    ON CONFLICT (bucket_key, window_start)
    DO UPDATE SET hit_count = public.rate_limits.hit_count + 1
    RETURNING hit_count INTO v_current;

    v_allowed := v_current <= p_max;

    IF v_allowed THEN
        v_retry_after := 0;
    ELSE
        v_retry_after := CEIL(
            extract(epoch FROM (v_bucket_start + make_interval(secs => GREATEST(p_window_seconds, 1))) - now())
        )::INT;
        IF v_retry_after < 1 THEN v_retry_after := 1; END IF;
    END IF;

    -- تنظيف دوري خفيف (احتمالية 2% لكل نداء)
    IF random() < 0.02 THEN
        DELETE FROM public.rate_limits
        WHERE window_start < now() - interval '1 hour';
    END IF;

    RETURN jsonb_build_object(
        'allowed',     v_allowed,
        'current',     v_current,
        'max',         p_max,
        'retry_after', v_retry_after
    );
END;
$$;

-- ==========================================
-- 2) حماية نقاط الإدخال العامة من الإساءة
-- (الطلاب يرسلون مباشرة عبر anon key → الحماية لازم تكون في قاعدة البيانات)
-- ==========================================

-- استخراج IP الطلب من PostgREST headers
CREATE OR REPLACE FUNCTION public.get_request_ip()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_headers JSONB;
    v_ip      TEXT;
BEGIN
    BEGIN
        v_headers := current_setting('request.headers', true)::JSONB;
    EXCEPTION WHEN OTHERS THEN
        RETURN NULL;
    END;
    IF v_headers IS NULL THEN
        RETURN NULL;
    END IF;
    v_ip := COALESCE(
        v_headers->>'cf-connecting-ip',
        split_part(COALESCE(v_headers->>'x-forwarded-for', ''), ',', 1),
        v_headers->>'x-real-ip'
    );
    RETURN NULLIF(trim(COALESCE(v_ip, '')), '');
END;
$$;

-- Trigger عام: حد للإدخالات المجهولة (قبل INSERT)
-- ⚠️ دوال الـ Triggers في PostgreSQL لا يمكن أن تعلن وسائط في توقيعها (42P13)
-- الوسائط تُمرر من CREATE TRIGGER وتُقرأ هنا عبر TG_NARGS / TG_ARGV
CREATE OR REPLACE FUNCTION public.enforce_anon_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result JSONB;
    v_ip     TEXT;
    v_bucket TEXT;
    v_max    INT;
    v_window INT;
BEGIN
    IF TG_NARGS < 3 THEN
        RAISE EXCEPTION 'enforce_anon_rate_limit يتطلب 3 وسائط: (bucket, max, window_seconds)'
            USING ERRCODE = 'P0001';
    END IF;

    v_bucket := TG_ARGV[0];
    v_max    := TG_ARGV[1]::INT;
    v_window := TG_ARGV[2]::INT;

    v_ip := public.get_request_ip();
    IF v_ip IS NULL THEN
        RETURN NEW; -- لا يوجد IP (اتصال داخلي) → اسمح
    END IF;

    v_result := public.rate_limit_hit(v_bucket || ':' || v_ip, v_window, v_max);
    IF (v_result->>'allowed')::BOOLEAN IS NOT TRUE THEN
        RAISE EXCEPTION 'تم تجاوز الحد المسموح من الإرسال. حاول بعد % ثانية', v_result->>'retry_after'
            USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
END;
$$;

-- الاستفسارات: 5 رسائل كل 10 دقائق لكل IP
DROP TRIGGER IF EXISTS trg_inquiries_rate_limit ON public.inquiries;
CREATE TRIGGER trg_inquiries_rate_limit
    BEFORE INSERT ON public.inquiries
    FOR EACH ROW EXECUTE FUNCTION
        public.enforce_anon_rate_limit('anon_inquiry', 5, 600);

-- التسليمات: 10 كل 10 دقائق لكل IP
DROP TRIGGER IF EXISTS trg_submissions_rate_limit ON public.submissions;
CREATE TRIGGER trg_submissions_rate_limit
    BEFORE INSERT ON public.submissions
    FOR EACH ROW EXECUTE FUNCTION
        public.enforce_anon_rate_limit('anon_submission', 10, 600);

-- اشتراكات الإشعارات: 3 كل ساعة لكل IP
DROP TRIGGER IF EXISTS trg_push_subs_rate_limit ON public.push_subscriptions;
CREATE TRIGGER trg_push_subs_rate_limit
    BEFORE INSERT ON public.push_subscriptions
    FOR EACH ROW EXECUTE FUNCTION
        public.enforce_anon_rate_limit('anon_push_sub', 3, 3600);

-- ==========================================
-- 3) قيود التحقق على البيانات (للصفوف الجديدة)
-- ==========================================
ALTER TABLE public.inquiries
    DROP CONSTRAINT IF EXISTS chk_inquiries_lengths;
ALTER TABLE public.inquiries
    ADD CONSTRAINT chk_inquiries_lengths CHECK (
        char_length(full_name) BETWEEN 2 AND 100
        AND char_length(message) BETWEEN 5 AND 2000
        AND char_length(COALESCE(whatsapp_number, '')) <= 20
    ) NOT VALID;

ALTER TABLE public.announcements
    DROP CONSTRAINT IF EXISTS chk_announcements_lengths;
ALTER TABLE public.announcements
    ADD CONSTRAINT chk_announcements_lengths CHECK (
        char_length(title) BETWEEN 1 AND 200
        AND char_length(content) BETWEEN 1 AND 10000
    ) NOT VALID;

ALTER TABLE public.tasks
    DROP CONSTRAINT IF EXISTS chk_tasks_lengths;
ALTER TABLE public.tasks
    ADD CONSTRAINT chk_tasks_lengths CHECK (
        char_length(title) BETWEEN 1 AND 200
        AND char_length(subject) BETWEEN 1 AND 100
        AND char_length(COALESCE(description, '')) <= 5000
    ) NOT VALID;

ALTER TABLE public.quick_links
    DROP CONSTRAINT IF EXISTS chk_quick_links_url;
ALTER TABLE public.quick_links
    ADD CONSTRAINT chk_quick_links_url CHECK (
        url ~* '^https?://.+'
        AND char_length(url) <= 1000
    ) NOT VALID;

-- ==========================================
-- 4) سجل تدقيق MCP (من يفعل ماذا ومتى)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.mcp_audit_log (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    key_id        UUID,
    key_name      TEXT,
    tool          TEXT NOT NULL,
    args_summary  TEXT,
    success       BOOLEAN NOT NULL DEFAULT true,
    error_message TEXT,
    duration_ms   INT,
    client_ip     TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mcp_audit_created ON public.mcp_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mcp_audit_key ON public.mcp_audit_log(key_id, created_at DESC);

ALTER TABLE public.mcp_audit_log ENABLE ROW LEVEL SECURITY;
-- لا سياسات → service_role فقط (قراءة/كتابة عبر الـ Edge Function)

-- ==========================================
-- 5) تقوية RLS — فحص دور فعلي بدل "أي مستخدم مسجل"
-- ==========================================

-- دالة: هل المستخدم الحالي عضو فريق (أدمن)؟
CREATE OR REPLACE FUNCTION public.is_team_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.team_members
        WHERE user_id = auth.uid()
    );
$$;

-- --- announcements ---
DROP POLICY IF EXISTS "Allow admin full access for announcements" ON public.announcements;
DROP POLICY IF EXISTS "Team admin full access announcements" ON public.announcements;
CREATE POLICY "Team admin full access announcements"
    ON public.announcements FOR ALL
    USING (public.is_team_admin())
    WITH CHECK (public.is_team_admin());

-- --- tasks ---
DROP POLICY IF EXISTS "Allow admin full access for tasks" ON public.tasks;
DROP POLICY IF EXISTS "Team admin full access tasks" ON public.tasks;
CREATE POLICY "Team admin full access tasks"
    ON public.tasks FOR ALL
    USING (public.is_team_admin())
    WITH CHECK (public.is_team_admin());

-- --- inquiries (الإدخال العام يبقى، الكتابة الكاملة للأدمن فقط) ---
DROP POLICY IF EXISTS "Allow authenticated admin full access to inquiries" ON public.inquiries;
DROP POLICY IF EXISTS "Team admin full access inquiries" ON public.inquiries;
CREATE POLICY "Team admin full access inquiries"
    ON public.inquiries FOR ALL
    USING (public.is_team_admin())
    WITH CHECK (public.is_team_admin());
-- ملاحظة: سياسة الإدخال المجهول "Allow anonymous users to insert inquiries" تبقى كما هي

-- --- quick_links ---
DROP POLICY IF EXISTS "Allow admin full access for quick_links" ON public.quick_links;
DROP POLICY IF EXISTS "Team admin full access quick_links" ON public.quick_links;
CREATE POLICY "Team admin full access quick_links"
    ON public.quick_links FOR ALL
    USING (public.is_team_admin())
    WITH CHECK (public.is_team_admin());

-- --- subjects ---
DROP POLICY IF EXISTS "Allow admin manage subjects" ON public.subjects;
DROP POLICY IF EXISTS "Team admin full access subjects" ON public.subjects;
CREATE POLICY "Team admin full access subjects"
    ON public.subjects FOR ALL
    USING (public.is_team_admin())
    WITH CHECK (public.is_team_admin());

-- --- schedules ---
DROP POLICY IF EXISTS "Allow admin manage schedules" ON public.schedules;
DROP POLICY IF EXISTS "Team admin full access schedules" ON public.schedules;
CREATE POLICY "Team admin full access schedules"
    ON public.schedules FOR ALL
    USING (public.is_team_admin())
    WITH CHECK (public.is_team_admin());

-- --- important_dates ---
DROP POLICY IF EXISTS "Allow admin manage important_dates" ON public.important_dates;
DROP POLICY IF EXISTS "Team admin full access important_dates" ON public.important_dates;
CREATE POLICY "Team admin full access important_dates"
    ON public.important_dates FOR ALL
    USING (public.is_team_admin())
    WITH CHECK (public.is_team_admin());

-- --- submissions ---
DROP POLICY IF EXISTS "Allow admin manage submissions" ON public.submissions;
DROP POLICY IF EXISTS "Team admin full access submissions" ON public.submissions;
CREATE POLICY "Team admin full access submissions"
    ON public.submissions FOR ALL
    USING (public.is_team_admin())
    WITH CHECK (public.is_team_admin());

-- --- attendance ---
DROP POLICY IF EXISTS "Allow admin manage attendance" ON public.attendance;
DROP POLICY IF EXISTS "Team admin full access attendance" ON public.attendance;
CREATE POLICY "Team admin full access attendance"
    ON public.attendance FOR ALL
    USING (public.is_team_admin())
    WITH CHECK (public.is_team_admin());

-- --- app_settings ---
DROP POLICY IF EXISTS "Allow admin manage settings" ON public.app_settings;
DROP POLICY IF EXISTS "Team admin full access app_settings" ON public.app_settings;
CREATE POLICY "Team admin full access app_settings"
    ON public.app_settings FOR ALL
    USING (public.is_team_admin())
    WITH CHECK (public.is_team_admin());

-- --- notifications_log ---
DROP POLICY IF EXISTS "Allow admin manage notifications" ON public.notifications_log;
DROP POLICY IF EXISTS "Team admin full access notifications_log" ON public.notifications_log;
CREATE POLICY "Team admin full access notifications_log"
    ON public.notifications_log FOR ALL
    USING (public.is_team_admin())
    WITH CHECK (public.is_team_admin());

-- --- settings ---
DROP POLICY IF EXISTS "Allow admin full access to settings" ON public.settings;
DROP POLICY IF EXISTS "Allow admin manage settings" ON public.settings;
DROP POLICY IF EXISTS "Team admin full access settings" ON public.settings;
CREATE POLICY "Team admin full access settings"
    ON public.settings FOR ALL
    USING (public.is_team_admin())
    WITH CHECK (public.is_team_admin());

-- --- team_members ---
DROP POLICY IF EXISTS "Allow admin full access to team_members" ON public.team_members;
DROP POLICY IF EXISTS "Team admin full access team_members" ON public.team_members;
CREATE POLICY "Team admin full access team_members"
    ON public.team_members FOR ALL
    USING (public.is_team_admin())
    WITH CHECK (public.is_team_admin());
-- السماح للأعضاء بقراءة بيانات الفريق (مطلوب لفحص is_team_admin من العميل)
DROP POLICY IF EXISTS "Allow authenticated read team_members" ON public.team_members;
DROP POLICY IF EXISTS "Team admin read team_members" ON public.team_members;
CREATE POLICY "Team admin read team_members"
    ON public.team_members FOR SELECT
    USING (public.is_team_admin());

-- --- push_subscriptions ---
DROP POLICY IF EXISTS "Allow admin read subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Team admin full access push_subscriptions" ON public.push_subscriptions;
CREATE POLICY "Team admin full access push_subscriptions"
    ON public.push_subscriptions FOR ALL
    USING (public.is_team_admin())
    WITH CHECK (public.is_team_admin());
-- ملاحظة: سياسة الإدخال العام "Allow public insert subscriptions" تبقى

-- ==========================================
-- 6) فهارس أداء للاستعلامات الساخنة (1000+ مستخدم متزامن)
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_announcements_pinned_created
    ON public.announcements(is_pinned DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_status_deadline
    ON public.tasks(status, deadline ASC);
CREATE INDEX IF NOT EXISTS idx_schedules_active_day
    ON public.schedules(is_active, day_of_week, start_time);
CREATE INDEX IF NOT EXISTS idx_inquiries_status_created
    ON public.inquiries(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quick_links_order
    ON public.quick_links(order_index);
CREATE INDEX IF NOT EXISTS idx_important_dates_date
    ON public.important_dates(date ASC);
CREATE INDEX IF NOT EXISTS idx_submissions_task
    ON public.submissions(task_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_subject_date
    ON public.attendance(subject_id, session_date DESC);
CREATE INDEX IF NOT EXISTS idx_team_members_user
    ON public.team_members(user_id);

-- ==========================================
-- 7) قفل جدول api_keys — service role فقط
-- (لوحة الأدمن تصل إليه عبر السيرفر بـ service key أصلاً)
-- ==========================================
DROP POLICY IF EXISTS "Allow admin full access to api_keys" ON public.api_keys;
DROP POLICY IF EXISTS "Allow authenticated admin full access to api_keys" ON public.api_keys;
DROP POLICY IF EXISTS "Allow service role full access to api_keys" ON public.api_keys;

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
-- لا سياسات → الوصول عبر service_role فقط (حماية قصوى للمفاتيح)

-- فهرس البحث عن المفتاح (لو موجود من migration سابق يتجاهل تلقائياً)
CREATE INDEX IF NOT EXISTS idx_api_keys_key_value
    ON public.api_keys(key_value) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_api_keys_revoked
    ON public.api_keys(revoked_at);

-- ==========================================
-- 8) إزالة جدول OTP القديم (تم إزالة OTP من الموقع نهائياً)
-- ==========================================
DROP TABLE IF EXISTS public.admin_otps CASCADE;
