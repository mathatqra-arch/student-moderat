-- ============================================
-- 20260930_schedule_link.sql
-- إضافة عمود link لجدول الجدول الأسبوعي (schedules)
-- الهدف: فصل رابط الحصة الأونلاين (Zoom/Meet) عن القاعة/العنوان
-- بدلاً من تخزين الرابط داخل location أو room أو notes.
-- idempotent: آمن لإعادة التشغيل.
-- ============================================

ALTER TABLE public.schedules
    ADD COLUMN IF NOT EXISTS link TEXT;

COMMENT ON COLUMN public.schedules.link IS
    'رابط الحصة الأونلاين (https://...) — يُستخدم للجلسات online/hybrid. فارغ = حضوري في القاعة.';
