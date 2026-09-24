-- ================================================
-- منصة إدارة الدفعة - إضافة جدول مفاتيح API والتصاريح (API Keys Table)
-- ================================================

CREATE TABLE IF NOT EXISTS public.api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    key_preview TEXT NOT NULL,
    key_value TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ
);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow admin full access to api_keys" 
    ON public.api_keys FOR ALL USING (auth.role() = 'authenticated');
