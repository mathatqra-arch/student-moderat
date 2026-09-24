-- ================================================
-- منصة إدارة الدفعة - تحديث جدول api_keys (إضافة created_by + audit)
-- ================================================

-- إضافة عمود created_by لربط المفتاح بالمستخدم الذي أنشأه
ALTER TABLE public.api_keys
    ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- إضافة عمود last_used_ip للتدقيق الأمني
ALTER TABLE public.api_keys
    ADD COLUMN IF NOT EXISTS last_used_ip TEXT;

-- إضافة عمود revoked_at لحذف ناعم (soft delete)
ALTER TABLE public.api_keys
    ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;

-- فهرس لتحسين أداء البحث عن المفتاح
CREATE INDEX IF NOT EXISTS idx_api_keys_key_value ON public.api_keys(key_value) WHERE revoked_at IS NULL;

-- تحديث RLS policies
DROP POLICY IF EXISTS "Allow admin full access to api_keys" ON public.api_keys;

-- سياسة: الأدمن المصادق عليه فقط يقدر على كل العمليات
CREATE POLICY "Allow authenticated admin full access to api_keys"
    ON public.api_keys FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- دالة لتنظيف المفاتيح القديمة غير المستخدمة (للصيانة)
CREATE OR REPLACE FUNCTION public.cleanup_old_api_keys(p_days INT DEFAULT 90)
RETURNS INT AS $$
DECLARE
    deleted_rows INT;
BEGIN
    DELETE FROM public.api_keys
    WHERE last_used_at IS NOT NULL
      AND last_used_at < NOW() - (p_days || ' days')::INTERVAL;

    GET DIAGNOSTICS deleted_rows = ROW_COUNT;
    RETURN deleted_rows;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
