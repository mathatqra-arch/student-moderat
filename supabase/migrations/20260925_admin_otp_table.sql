-- ================================================
-- منصة إدارة الدفعة - نظام OTP للمصادقة بالهاتف
-- ================================================

-- جدول رموز OTP المؤقتة
CREATE TABLE IF NOT EXISTS public.admin_otps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone TEXT NOT NULL,
    code TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN NOT NULL DEFAULT FALSE,
    attempts INT NOT NULL DEFAULT 0,
    ip_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- فهرس للبحث السريع
CREATE INDEX IF NOT EXISTS idx_admin_otps_phone_used ON public.admin_otps(phone, used, expires_at DESC);

-- تفعيل RLS
ALTER TABLE public.admin_otps ENABLE ROW LEVEL SECURITY;

-- سياسات: فقط service_role يقدر يقرأ/يكتب (لأن العميل يستخدم API routes)
CREATE POLICY "Allow service role full access to admin_otps"
    ON public.admin_otps FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- دالة لتنظيف رموز OTP المنتهية (صيانة دورية)
CREATE OR REPLACE FUNCTION public.cleanup_expired_otps()
RETURNS INT AS $$
DECLARE
    deleted_rows INT;
BEGIN
    DELETE FROM public.admin_otps
    WHERE expires_at < NOW() OR used = TRUE AND created_at < NOW() - INTERVAL '1 day';

    GET DIAGNOSTICS deleted_rows = ROW_COUNT;
    RETURN deleted_rows;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- دالة للتحقق مما إذا كان المستخدم يحتاج لتغيير كلمة المرور
-- (تستخدم password placeholder 000000)
-- ملاحظة: لا يمكن مقارنة كلمة المرور من SQL، لذا نستخدم app_metadata
CREATE OR REPLACE FUNCTION public.mark_user_needs_password_change(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE auth.users
    SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"needs_password_change": true}'::jsonb
    WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.clear_user_needs_password_change(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE auth.users
    SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"needs_password_change": false}'::jsonb
    WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
