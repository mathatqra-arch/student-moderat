-- ============================================
-- تصحيح البيانات القديمة (Legacy Data Repair)
-- المشكلة: جلسات مخزّن "المكان" فيها كلمة "أونلاين" بينما lecture_type = university
-- النتيجة: mode_ar يعرض "في الكلية" خطأً رغم أن الحصة أونلاين
-- الحل:
--   1) الروابط (http/https) المحفوظة بالخطأ في room/location تُنقل إلى link وتصبح الجلسة أونلاين
--   2) الجلسات التي مكانها نص "أونلاين/online" (بدون رابط) يصبح نوعها online ويُمسح المكان الزائف
-- ملاحظات:
--   - آمنة للتكرار (idempotent): التشغيل الثاني لن يغيّر شيئاً
--   - لا تلمس الجلسات الحضورية الصحيحة (مكانها قاعة/مبنى فعلي)
-- ============================================

-- 1) رابط مخفي داخل room/location → انقله إلى link واجعل الجلسة أونلاين
UPDATE public.schedules
SET link = COALESCE(NULLIF(btrim(room), ''), NULLIF(btrim(location), '')),
    room = NULL,
    location = NULL,
    lecture_type = 'online'
WHERE COALESCE(lecture_type, '') <> 'online'
  AND (lower(COALESCE(room, '')) LIKE 'http%'
       OR lower(COALESCE(location, '')) LIKE 'http%');

-- 2) المكان نص "أونلاين" (أي لغة وأي حالة أحرف) بدون رابط → اجعل النوع أونلاين وامسح المكان الزائف
UPDATE public.schedules
SET lecture_type = 'online',
    room = NULL,
    location = NULL
WHERE COALESCE(lecture_type, '') <> 'online'
  AND (lower(COALESCE(room, '')) ~ '(أونلاين|اونلاين|online)'
       OR lower(COALESCE(location, '')) ~ '(أونلاين|اونلاين|online)');

-- تحقق بعد التشغيل (اختياري — شغّله منفصلاً في SQL Editor):
-- SELECT id, lecture_type, room, location, link
-- FROM public.schedules
-- WHERE COALESCE(room,'') ~ '(أونلاين|اونلاين|online)'
--    OR COALESCE(location,'') ~ '(أونلاين|اونلاين|online)';
-- المتوقع: 0 صفوف — كل الجلسات الأونلاين أصبحت lecture_type = 'online' والروابط في link
