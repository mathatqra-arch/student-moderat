-- ================================================
-- منصة إدارة الدفعة v3.0 — Schema كامل
-- ================================================

-- 1. جدول المواد الدراسية (Subjects)
CREATE TABLE IF NOT EXISTS public.subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    code TEXT,
    instructor TEXT,
    color TEXT DEFAULT '#3b82f6',
    icon TEXT DEFAULT 'book',
    semester TEXT,
    credits INT DEFAULT 3,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- 2. جدول الجداول الأسبوعية (Schedules)
CREATE TABLE IF NOT EXISTS public.schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
    day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday, 6=Saturday
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    location TEXT,
    room TEXT,
    type TEXT DEFAULT 'lecture', -- lecture, lab, tutorial, exam
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. جدول المواعيد المهمة (Important Dates)
CREATE TABLE IF NOT EXISTS public.important_dates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ,
    type TEXT DEFAULT 'event', -- exam, deadline, holiday, event, registration
    subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
    is_pinned BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. جدول تسليمات الطلاب (Submissions)
CREATE TABLE IF NOT EXISTS public.submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
    student_name TEXT NOT NULL,
    student_phone TEXT,
    submission_url TEXT,
    notes TEXT,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status TEXT DEFAULT 'pending', -- pending, reviewed, accepted, rejected
    grade TEXT,
    feedback TEXT,
    reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ
);

-- 5. جدول الحضور (Attendance)
CREATE TABLE IF NOT EXISTS public.attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
    session_date DATE NOT NULL,
    total_students INT DEFAULT 0,
    present_count INT DEFAULT 0,
    absent_count INT DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. جدول الإعدادات (Settings - key/value store)
CREATE TABLE IF NOT EXISTS public.app_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. جدول الإشعارات (Notifications log)
CREATE TABLE IF NOT EXISTS public.notifications_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    body TEXT,
    type TEXT DEFAULT 'info', -- info, warning, success, error
    target_audience TEXT DEFAULT 'all', -- all, specific_users
    target_users TEXT[],
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sent_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- ==========================================
-- إضافة عمود order_index لعرض الجداول بالترتيب
-- ==========================================
ALTER TABLE public.quick_links ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'general';

-- ==========================================
-- RLS Policies
-- ==========================================
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.important_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications_log ENABLE ROW LEVEL SECURITY;

-- Subjects: public read, admin write
CREATE POLICY "Allow public read subjects" ON public.subjects FOR SELECT USING (true);
CREATE POLICY "Allow admin manage subjects" ON public.subjects FOR ALL USING (auth.role() = 'authenticated');

-- Schedules: public read, admin write
CREATE POLICY "Allow public read schedules" ON public.schedules FOR SELECT USING (true);
CREATE POLICY "Allow admin manage schedules" ON public.schedules FOR ALL USING (auth.role() = 'authenticated');

-- Important dates: public read, admin write
CREATE POLICY "Allow public read important_dates" ON public.important_dates FOR SELECT USING (true);
CREATE POLICY "Allow admin manage important_dates" ON public.important_dates FOR ALL USING (auth.role() = 'authenticated');

-- Submissions: public insert, admin read/write
CREATE POLICY "Allow public insert submissions" ON public.submissions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow admin manage submissions" ON public.submissions FOR ALL USING (auth.role() = 'authenticated');

-- Attendance: public read, admin write
CREATE POLICY "Allow public read attendance" ON public.attendance FOR SELECT USING (true);
CREATE POLICY "Allow admin manage attendance" ON public.attendance FOR ALL USING (auth.role() = 'authenticated');

-- Settings: admin only
CREATE POLICY "Allow admin manage settings" ON public.app_settings FOR ALL USING (auth.role() = 'authenticated');

-- Notifications log: admin only
CREATE POLICY "Allow admin manage notifications" ON public.notifications_log FOR ALL USING (auth.role() = 'authenticated');

-- ==========================================
-- بيانات افتراضية (Seed data)
-- ==========================================

-- مواد افتراضية
INSERT INTO public.subjects (name, code, instructor, color, icon) VALUES
    ('الذكاء الاصطناعي', 'CS401', 'د. أحمد محمد', '#3b82f6', 'brain'),
    ('قواعد البيانات', 'CS302', 'د. سارة علي', '#10b981', 'database'),
    ('الشبكات', 'CS303', 'د. خالد حسن', '#f59e0b', 'network'),
    ('هندسة البرمجيات', 'CS304', 'د. منى إبراهيم', '#8b5cf6', 'code'),
    ('أمن المعلومات', 'CS305', 'د. عمر فاروق', '#ef4444', 'shield')
ON CONFLICT DO NOTHING;

-- جدول أسبوعي افتراضي
INSERT INTO public.schedules (subject_id, day_of_week, start_time, end_time, location, room, type) VALUES
    ((SELECT id FROM public.subjects WHERE name = 'الذكاء الاصطناعي' LIMIT 1), 0, '09:00', '11:00', 'مبنى A', 'قاعة 101', 'lecture'),
    ((SELECT id FROM public.subjects WHERE name = 'قواعد البيانات' LIMIT 1), 1, '10:00', '12:00', 'مبنى B', 'قاعة 203', 'lecture'),
    ((SELECT id FROM public.subjects WHERE name = 'الشبكات' LIMIT 1), 2, '09:00', '11:00', 'مبنى A', 'قاعة 105', 'lecture'),
    ((SELECT id FROM public.subjects WHERE name = 'هندسة البرمجيات' LIMIT 1), 3, '13:00', '15:00', 'مبنى C', 'مختبر 1', 'lab'),
    ((SELECT id FROM public.subjects WHERE name = 'أمن المعلومات' LIMIT 1), 4, '11:00', '13:00', 'مبنى B', 'قاعة 110', 'lecture')
ON CONFLICT DO NOTHING;

-- مواعيد مهمة افتراضية
INSERT INTO public.important_dates (title, description, date, type, is_pinned) VALUES
    ('بداية الفصل الدراسي', 'بداية الفصل الدراسي الأول 2026', '2026-09-15T08:00:00Z', 'event', true),
    ('امتحان منتصف الفصل', 'امتحان منتصف الفصل لمادة الذكاء الاصطناعي', '2026-11-15T10:00:00Z', 'exam', true),
    ('آخر موعد لتسليم المشروع', 'مشروع قواعد البيانات النهائي', '2026-12-01T23:59:00Z', 'deadline', false),
    ('إجازة نصف الفصل', 'إجازة منتصف الفصل الدراسي', '2026-10-20T00:00:00Z', 'holiday', false)
ON CONFLICT DO NOTHING;
