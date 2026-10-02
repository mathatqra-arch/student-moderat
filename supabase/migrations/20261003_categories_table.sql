-- ================================================
-- التصنيفات الديناميكية (categories) — الإعلانات والاستفسارات
-- ================================================
-- قبل الملف ده: التصنيفات كانت مكتوبة يدوي في الكود (عاجل/أكاديمي/هام/عام
-- وأكاديمي/جدول/تكليف/عام) — الأدمن مش يقدر يضيف أو يعدل أو يحذف.
--
-- بعد الملف ده: جدول categories واحد للنوعين:
--   type = 'announcement' → تصنيفات الإعلانات
--   type = 'inquiry'      → تصنيفات الاستفسارات
-- الأدمن يديرها من لوحة التحكم والـ MCP، والطلاب يقراوها فقط.
--
-- الصلاحيات (RLS) — نفس نظام has_admin_permission الموجود:
--   القراءة: للجميع (الطلاب محتاجينها للفورم والفلاتر)
--   الإضافة/التعديل/الحذف: مربوطة بمورد التصنيف نفسه:
--     announcement → announcements.create / announcements.edit / announcements.delete
--     inquiry      → inquiries.create / inquiries.edit / inquiries.delete
--
-- ⚠️ شغّله في Supabase SQL Editor (ملف واحد، بترتيبه)
-- ✅ آمن: مش بيلمس أي جدول موجود — إضافة فقط
-- ================================================

-- ==========================================
-- 1) جدول التصنيفات
-- ==========================================
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL CHECK (type IN ('announcement', 'inquiry')),
    name TEXT NOT NULL,
    color TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (type, name)
);

CREATE INDEX IF NOT EXISTS idx_categories_type_order
    ON public.categories (type, sort_order, name);

-- ==========================================
-- 2) البذور — نفس التصنيفات الحالية عشان الانتقال يكون سلس
-- (ON CONFLICT DO NOTHING → آمن لإعادة التشغيل)
-- ==========================================
INSERT INTO public.categories (type, name, sort_order) VALUES
    ('announcement', 'عاجل', 1),
    ('announcement', 'أكاديمي', 2),
    ('announcement', 'هام', 3),
    ('announcement', 'عام', 4),
    ('inquiry', 'أكاديمي', 1),
    ('inquiry', 'جدول', 2),
    ('inquiry', 'تكليف', 3),
    ('inquiry', 'عام', 4)
ON CONFLICT (type, name) DO NOTHING;

-- ==========================================
-- 3) RLS
-- ==========================================
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- القراءة: للجميع (الطلاب بيقراوها للفورم وفلاتر الإعلانات — داتا عامة غير حساسة)
DROP POLICY IF EXISTS "Public read categories" ON public.categories;
CREATE POLICY "Public read categories"
    ON public.categories FOR SELECT
    USING (true);

-- الإضافة: حسب مورد التصنيف (announcement → announcements.create، inquiry → inquiries.create)
DROP POLICY IF EXISTS "Team admin create categories" ON public.categories;
CREATE POLICY "Team admin create categories"
    ON public.categories FOR INSERT TO authenticated
    WITH CHECK (
        public.has_admin_permission(
            auth.uid(),
            CASE WHEN type = 'announcement' THEN 'announcements' ELSE 'inquiries' END,
            'create'
        )
    );

-- التعديل (الاسم/اللون/الترتيب/التفعيل)
DROP POLICY IF EXISTS "Team admin edit categories" ON public.categories;
CREATE POLICY "Team admin edit categories"
    ON public.categories FOR UPDATE TO authenticated
    USING (
        public.has_admin_permission(
            auth.uid(),
            CASE WHEN type = 'announcement' THEN 'announcements' ELSE 'inquiries' END,
            'edit'
        )
    )
    WITH CHECK (
        public.has_admin_permission(
            auth.uid(),
            CASE WHEN type = 'announcement' THEN 'announcements' ELSE 'inquiries' END,
            'edit'
        )
    );

-- الحذف
DROP POLICY IF EXISTS "Team admin delete categories" ON public.categories;
CREATE POLICY "Team admin delete categories"
    ON public.categories FOR DELETE TO authenticated
    USING (
        public.has_admin_permission(
            auth.uid(),
            CASE WHEN type = 'announcement' THEN 'announcements' ELSE 'inquiries' END,
            'delete'
        )
    );

-- ==========================================
-- 4) إذنا create/edit لمورد inquiries — كانوا مش موجودين
-- (إدارة تصنيفات الاستفسارات محتاجاهم — الليدر مش متأثر لأنه بيتجاوز)
-- ==========================================
ALTER TABLE public.team_members
    ALTER COLUMN permissions SET DEFAULT '{
        "inquiries": {"view": true, "reply": true, "create": false, "edit": false, "delete": false},
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

-- backfill: إضافة المفاتيح الناقصة فقط (|| مش بيعدّل الموجود) — آمن
UPDATE public.team_members
SET permissions = permissions || '{"inquiries": {"create": false, "edit": false}}'::jsonb
WHERE role IS DISTINCT FROM 'leader'
  AND (permissions->'inquiries'->>'create') IS NULL;

-- ==========================================
-- 5) تحقق سريع (اختياري):
-- SELECT type, name, sort_order FROM public.categories ORDER BY type, sort_order;
-- SELECT tablename, policyname, cmd FROM pg_policies WHERE tablename = 'categories';
-- ==========================================
