-- ================================================
-- إضافة أعمدة المجموعات والأنواع لجدول schedules
-- ================================================

-- إضافة عمود group (المجموعة: أ، ب، ج، د، all)
ALTER TABLE public.schedules
    ADD COLUMN IF NOT EXISTS "group" TEXT DEFAULT 'all';

-- إضافة عمود lecture_type (نوع الحضور: university، online، hybrid)
ALTER TABLE public.schedules
    ADD COLUMN IF NOT EXISTS lecture_type TEXT DEFAULT 'university';

-- إضافة عمود notes للملاحظات الإضافية
ALTER TABLE public.schedules
    ADD COLUMN IF NOT EXISTS notes TEXT;

-- تحديث البيانات الموجودة
UPDATE public.schedules
SET "group" = 'all', lecture_type = 'university'
WHERE "group" IS NULL OR lecture_type IS NULL;

-- إضافة فهارس
CREATE INDEX IF NOT EXISTS idx_schedules_group ON public.schedules("group");
CREATE INDEX IF NOT EXISTS idx_schedules_lecture_type ON public.schedules(lecture_type);

-- إضافة بيانات تجريبية للمجموعات
INSERT INTO public.schedules (subject_id, day_of_week, start_time, end_time, room, type, "group", lecture_type, is_active)
VALUES
    -- محاضرة جامعة - مجموعة أ
    ((SELECT id FROM public.subjects WHERE name = 'الذكاء الاصطناعي' LIMIT 1), 0, '09:00', '11:00', 'قاعة 101', 'lecture', 'أ', 'university', true),
    -- محاضرة جامعة - مجموعة ب
    ((SELECT id FROM public.subjects WHERE name = 'الذكاء الاصطناعي' LIMIT 1), 0, '11:00', '13:00', 'قاعة 101', 'lecture', 'ب', 'university', true),
    -- محاضرة أونلاين - كل المجموعات
    ((SELECT id FROM public.subjects WHERE name = 'قواعد البيانات' LIMIT 1), 1, '10:00', '12:00', 'أونلاين', 'lecture', 'all', 'online', true),
    -- سكشن جامعة - مجموعة أ
    ((SELECT id FROM public.subjects WHERE name = 'قواعد البيانات' LIMIT 1), 2, '09:00', '10:00', 'مختبر 1', 'tutorial', 'أ', 'university', true),
    -- سكشن جامعة - مجموعة ب
    ((SELECT id FROM public.subjects WHERE name = 'قواعد البيانات' LIMIT 1), 2, '10:00', '11:00', 'مختبر 1', 'tutorial', 'ب', 'university', true),
    -- سكشن أونلاين - كل المجموعات
    ((SELECT id FROM public.subjects WHERE name = 'الشبكات' LIMIT 1), 3, '13:00', '14:00', 'أونلاين', 'tutorial', 'all', 'online', true),
    -- معمل جامعة - مجموعة ج
    ((SELECT id FROM public.subjects WHERE name = 'هندسة البرمجيات' LIMIT 1), 4, '11:00', '13:00', 'مختبر 2', 'lab', 'ج', 'university', true),
    -- معمل جامعة - مجموعة د
    ((SELECT id FROM public.subjects WHERE name = 'هندسة البرمجيات' LIMIT 1), 4, '13:00', '15:00', 'مختبر 2', 'lab', 'د', 'university', true)
ON CONFLICT DO NOTHING;
