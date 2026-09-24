import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import crypto from "crypto";

// ==========================================
// API Keys Management - محمي بـ Supabase Auth
// ==========================================

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://apcxwxnkntegbkimsmty.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || "";

// عميل بـ service role للوصول الكامل لجدول api_keys
function getSupabaseAdminClient() {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

// تحقق من جلسة الأدمن (المستخدم المسجّل دخوله)
async function getAuthenticatedUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options as any)
          );
        } catch {
          // called from Server Component — ignore
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

// GET: استرجاع كل المفاتيح (بدون قيمة كاملة)
export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized: تسجيل دخول الأدمن مطلوب" },
        { status: 401 }
      );
    }

    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("api_keys")
      .select("id, name, key_preview, created_at, last_used_at")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ keys: data || [] });
  } catch (error: any) {
    console.error("GET /api/admin/keys error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: توليد مفتاح API جديد
export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized: تسجيل دخول الأدمن مطلوب" },
        { status: 401 }
      );
    }

    const { name } = await request.json();
    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "يرجى كتابة اسم للمفتاح (مثل: مفتاح ChatGPT الرئيسي)" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdminClient();

    // توليد مفتاح عشوائي آمن (32 bytes hex = 64 char)
    const rawRandom = crypto.randomBytes(32).toString("hex");
    const fullKeyValue = `bmp_key_${rawRandom}`;
    const keyPreview = `bmp_key_…${fullKeyValue.slice(-6)}`;

    const { data, error } = await supabase
      .from("api_keys")
      .insert([
        {
          name: name.trim(),
          key_preview: keyPreview,
          key_value: fullKeyValue,
          created_by: user.id,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      apiKey: fullKeyValue,
      keyData: data,
      warning: "احفظ هذا المفتاح الآن — لن يُعرض مرة أخرى.",
    });
  } catch (error: any) {
    console.error("POST /api/admin/keys error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: حذف مفتاح
export async function DELETE(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized: تسجيل دخول الأدمن مطلوب" },
        { status: 401 }
      );
    }

    const { id } = await request.json();
    if (!id) {
      return NextResponse.json({ error: "معرف المفتاح مطلوب" }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    const { error } = await supabase.from("api_keys").delete().eq("id", id);
    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: "تم إلغاء المفتاح بنجاح — لن يعود صالحاً للاستخدام.",
    });
  } catch (error: any) {
    console.error("DELETE /api/admin/keys error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
