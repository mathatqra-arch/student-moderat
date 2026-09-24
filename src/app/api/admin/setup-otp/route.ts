import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ==========================================
// Setup Endpoint: يتحقق من وجود جدول admin_otps
// إن لم يكن موجوداً، يرجع SQL للمستخدم لإنشائه يدوياً
// ==========================================

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://apcxwxnkntegbkimsmty.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function getAdminClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function GET() {
  try {
    const supabase = getAdminClient();

    const { error: testError } = await supabase
      .from("admin_otps")
      .select("id")
      .limit(1);

    if (testError && testError.code === "PGRST205") {
      return NextResponse.json({
        ok: false,
        needs_manual_setup: true,
        message: "جدول admin_otps غير موجود. شغّل SQL التالي في Supabase SQL Editor:",
        sql_editor_url: "https://supabase.com/dashboard/project/apcxwxnkntegbkimsmty/sql/new",
        sql: `CREATE TABLE IF NOT EXISTS public.admin_otps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone TEXT NOT NULL,
    code TEXT NOT NULL,
    user_id UUID,
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN NOT NULL DEFAULT FALSE,
    attempts INT NOT NULL DEFAULT 0,
    ip_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_otps_phone_used
    ON public.admin_otps(phone, used, expires_at DESC);

ALTER TABLE public.admin_otps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow service role full access to admin_otps"
    ON public.admin_otps;

CREATE POLICY "Allow service role full access to admin_otps"
    ON public.admin_otps FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');`,
      });
    }

    if (testError) {
      throw testError;
    }

    return NextResponse.json({
      ok: true,
      message: "جدول admin_otps موجود ويعمل",
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}
