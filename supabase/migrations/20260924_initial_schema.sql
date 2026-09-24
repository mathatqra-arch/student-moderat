-- ================================================
-- منصة إدارة الدفعة - قاعدة البيانات الكاملة والجداول والدوال (Supabase Full Schema & Functions)
-- ================================================

-- 1. جدول الإعلانات (Announcements)
CREATE TABLE IF NOT EXISTS public.announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'عام', -- 'عاجل', 'أكاديمي', 'هام', 'عام'
    is_pinned BOOLEAN NOT NULL DEFAULT false,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. جدول المهام والتكليفات (Tasks)
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    deadline TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'active', -- 'active', 'closed'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. جدول استفسارات الطلاب (Inquiries)
CREATE TABLE IF NOT EXISTS public.inquiries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    whatsapp_number TEXT NOT NULL,
    message TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'عام', -- 'أكاديمي', 'جدول', 'تكليف', 'عام'
    status TEXT NOT NULL DEFAULT 'new', -- 'new', 'in_progress', 'resolved', 'archived'
    ai_suggestion TEXT,
    assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. جدول الروابط السريعة والجداول (Quick Links)
CREATE TABLE IF NOT EXISTS public.quick_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'group', -- 'schedule', 'group', 'material', 'drive'
    icon TEXT DEFAULT 'link',
    order_index INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. جدول أعضاء الفريق والمشرفين (Team Members)
CREATE TABLE IF NOT EXISTS public.team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'assistant', -- 'leader', 'assistant'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. جدول الإعدادات والتكوين (Settings)
CREATE TABLE IF NOT EXISTS public.settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. جدول اشتراكات الإشعارات الفورية (Push Subscriptions)
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ================================================
-- دالّة وسكانس التحديث التلقائي للوقت (Triggers & Functions)
-- ================================================

-- دالة التحديث التلقائي لـ updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger على جدول الاستفسارات
DROP TRIGGER IF EXISTS trigger_set_inquiries_updated_at ON public.inquiries;
CREATE TRIGGER trigger_set_inquiries_updated_at
    BEFORE UPDATE ON public.inquiries
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at_timestamp();

-- ================================================
-- دوال الإحصائيات والصيانة المخزنة (RPC Functions)
-- ================================================

-- دالة حساب إحصائيات الطلبات للاستخدام المباشر في Supabase RPC
CREATE OR REPLACE FUNCTION public.get_inquiry_stats()
RETURNS TABLE (
    total_count BIGINT,
    new_count BIGINT,
    in_progress_count BIGINT,
    resolved_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT AS total_count,
        COUNT(*) FILTER (WHERE status = 'new')::BIGINT AS new_count,
        COUNT(*) FILTER (WHERE status = 'in_progress')::BIGINT AS in_progress_count,
        COUNT(*) FILTER (WHERE status = 'resolved')::BIGINT AS resolved_count
    FROM public.inquiries;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- دالة صيانة وتنظيف البيانات القديمة (حفظ المساحة التخزينية)
CREATE OR REPLACE FUNCTION public.clean_old_inquiries(p_days INT DEFAULT 30)
RETURNS INT AS $$
DECLARE
    deleted_rows INT;
BEGIN
    DELETE FROM public.inquiries
    WHERE status = 'resolved' OR status = 'archived'
      AND created_at < NOW() - (p_days || ' days')::INTERVAL;
    
    GET DIAGNOSTICS deleted_rows = ROW_COUNT;
    RETURN deleted_rows;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================
-- سياسات الأمان والحماية (Row Level Security - RLS)
-- ================================================

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quick_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- 1. Announcements Policies
CREATE POLICY "Allow public read access for announcements" ON public.announcements FOR SELECT USING (true);
CREATE POLICY "Allow admin full access for announcements" ON public.announcements FOR ALL USING (auth.role() = 'authenticated');

-- 2. Tasks Policies
CREATE POLICY "Allow public read access for tasks" ON public.tasks FOR SELECT USING (true);
CREATE POLICY "Allow admin full access for tasks" ON public.tasks FOR ALL USING (auth.role() = 'authenticated');

-- 3. Inquiries Policies (No Auth Insert للطلاب, Full Access للأدمن)
CREATE POLICY "Allow anonymous users to insert inquiries" ON public.inquiries FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow authenticated admin full access to inquiries" ON public.inquiries FOR ALL USING (auth.role() = 'authenticated');

-- 4. Quick Links Policies
CREATE POLICY "Allow public read access for quick_links" ON public.quick_links FOR SELECT USING (true);
CREATE POLICY "Allow admin full access for quick_links" ON public.quick_links FOR ALL USING (auth.role() = 'authenticated');

-- 5. Push Subscriptions Policies
CREATE POLICY "Allow public insert subscriptions" ON public.push_subscriptions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow admin read subscriptions" ON public.push_subscriptions FOR SELECT USING (auth.role() = 'authenticated');
