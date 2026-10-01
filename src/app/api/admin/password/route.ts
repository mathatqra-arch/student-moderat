import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { missingServerConfig, configErrorResponse } from "@/lib/server-config";

// ==========================================
// Admin Password Set/Change Endpoint
// يستخدم لتعيين كلمة مرور جديدة بعد أول OTP login
// أو لتغيير كلمة المرور في أي وقت
// ==========================================

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://apcxwxnkntegbkimsmty.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function getAdminClient() {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY غير مُهيّأ");
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

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
          // ignore
        }
      },
    },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function POST(request: Request) {
  // فحص إعدادات السيرفر — 503 واضحة بدل 500 غامضة
  if (missingServerConfig()) {
    return configErrorResponse("admin/password");
  }

  try {
    // Rate Limit — 5 محاولات تغيير كل 10 دقائق لكل IP
    const limited = await enforceRateLimit(request, RATE_LIMITS.passwordChange);
    if (limited) return limited;

    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized: يجب تسجيل الدخول أولاً" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { new_password, current_password } = body;

    if (!new_password || typeof new_password !== "string" || new_password.length < 8) {
      return NextResponse.json(
        { error: "كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل" },
        { status: 400 }
      );
    }

    if (new_password.length > 72) {
      return NextResponse.json(
        { error: "كلمة المرور طويلة جداً (الحد الأقصى 72 حرفاً)" },
        { status: 400 }
      );
    }

    if (/^0+$/.test(new_password) || /^(.)\1{3,}$/.test(new_password)) {
      return NextResponse.json(
        { error: "كلمة المرور ضعيفة جداً — لا يمكن استخدام أرقام/حروف متكررة" },
        { status: 400 }
      );
    }

    // أمان: التحقق من كلمة المرور الحالية قبل التغيير —
    // أي جلسة مسروقة/جهاز مفتوح لا يستطيع تغيير كلمة المرور بدون معرفتها
    // استثناء واحد: أول تعيين بعد OTP (needs_password_change) — مفيش كلمة مرور فعلية لسه
    const firstTimeSetup = user.user_metadata?.needs_password_change === true;

    if (!firstTimeSetup) {
      if (!current_password || typeof current_password !== "string") {
        return NextResponse.json(
          { error: "اكتب كلمة المرور الحالية أولاً" },
          { status: 400 }
        );
      }

      if (!user.phone) {
        return NextResponse.json(
          { error: "لا يمكن التحقق من هويتك — الحساب غير مرتبط برقم هاتف" },
          { status: 400 }
        );
      }

      // تحقق صامت: تسجيل دخول مؤقت برقم الهاتف + كلمة المرور الحالية (بدون حفظ جلسة)
      const verifyClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { error: verifyError } = await verifyClient.auth.signInWithPassword({
        phone: user.phone,
        password: current_password,
      });

      if (verifyError) {
        return NextResponse.json(
          { error: "كلمة المرور الحالية غير صحيحة" },
          { status: 400 }
        );
      }
    }

    const adminClient = getAdminClient();

    // تحديث كلمة المرور + إزالة علامة needs_password_change
    const { error: updateError } = await adminClient.auth.admin.updateUserById(user.id, {
      password: new_password,
      user_metadata: {
        ...(user.user_metadata || {}),
        needs_password_change: false,
        password_set_at: new Date().toISOString(),
      },
    });

    if (updateError) {
      return NextResponse.json(
        { error: "فشل تحديث كلمة المرور: " + updateError.message },
        { status: 500 }
      );
    }

    // تحديث password_changed_at في team_members للاتساق مع مسار الأدمن
    await adminClient
      .from("team_members")
      .update({ password_changed_at: new Date().toISOString() })
      .eq("user_id", user.id);

    return NextResponse.json({
      ok: true,
      message: "تم تغيير كلمة المرور بنجاح. استخدمها في المرات القادمة مع رقم هاتفك.",
    });
  } catch (error: any) {
    console.error("Password set error:", error);
    return NextResponse.json(
      { error: "حدث خطأ: " + error.message },
      { status: 500 }
    );
  }
}
