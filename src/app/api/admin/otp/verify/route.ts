import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

// ==========================================
// Admin OTP Verify Endpoint
// يتحقق من الرمز، ينشئ session، ويعلم ما إذا كان يجب تغيير كلمة المرور
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

function normalizeEgyptianPhone(phone: string): string {
  const cleaned = phone.replace(/[\s\-()]/g, "").trim();
  if (cleaned.startsWith("+")) return cleaned;
  if (cleaned.startsWith("201") && cleaned.length === 12) return "+" + cleaned;
  if (cleaned.startsWith("01") && cleaned.length === 11) return "+2" + cleaned;
  return cleaned;
}

const MAX_ATTEMPTS = 5;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const phoneInput: string = (body.phone || "").trim();
    const code: string = (body.code || "").trim();

    if (!phoneInput || !code) {
      return NextResponse.json(
        { ok: false, error: "رقم الهاتف والرمز مطلوبان" },
        { status: 400 }
      );
    }

    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json(
        { ok: false, error: "الرمز يجب أن يكون 6 أرقام" },
        { status: 400 }
      );
    }

    const normalizedPhone = normalizeEgyptianPhone(phoneInput);
    const adminClient = getAdminClient();

    // 1. البحث عن أحدث OTP غير مستخدم لهذا الرقم
    const { data: otps, error: otpError } = await adminClient
      .from("admin_otps")
      .select("*")
      .eq("phone", normalizedPhone)
      .eq("used", false)
      .order("created_at", { ascending: false })
      .limit(1);

    if (otpError) throw otpError;

    if (!otps || otps.length === 0) {
      return NextResponse.json(
        { ok: false, error: "لا يوجد رمز نشط. اطلب رمزاً جديداً." },
        { status: 404 }
      );
    }

    const otp = otps[0];

    // 2. التحقق من انتهاء الصلاحية
    if (new Date(otp.expires_at).getTime() < Date.now()) {
      await adminClient
        .from("admin_otps")
        .update({ used: true })
        .eq("id", otp.id);

      return NextResponse.json(
        { ok: false, error: "انتهت صلاحية الرمز. اطلب رمزاً جديداً." },
        { status: 410 }
      );
    }

    // 3. التحقق من عدد المحاولات
    if (otp.attempts >= MAX_ATTEMPTS) {
      await adminClient
        .from("admin_otps")
        .update({ used: true })
        .eq("id", otp.id);

      return NextResponse.json(
        { ok: false, error: `تجاوزت الحد الأقصى من المحاولات (${MAX_ATTEMPTS}). اطلب رمزاً جديداً.` },
        { status: 429 }
      );
    }

    // 4. التحقق من صحة الرمز
    if (otp.code !== code) {
      await adminClient
        .from("admin_otps")
        .update({ attempts: otp.attempts + 1 })
        .eq("id", otp.id);

      const remaining = MAX_ATTEMPTS - (otp.attempts + 1);
      return NextResponse.json(
        {
          ok: false,
          error: `الرمز غير صحيح. ${remaining} محاولات متبقية.`,
          attempts_remaining: remaining,
        },
        { status: 401 }
      );
    }

    // 5. الرمز صحيح — علّمه كمستخدم
    await adminClient
      .from("admin_otps")
      .update({ used: true })
      .eq("id", otp.id);

    // 6. ابحث عن المستخدم صاحب الـ OTP
    let targetUser: any = null;
    try {
      const { data: userData } = await adminClient.auth.admin.getUserById(otp.user_id);
      targetUser = userData?.user || null;
    } catch {
      targetUser = null;
    }

    // fallback: ابحث في القائمة
    if (!targetUser) {
      const { data: usersList } = await adminClient.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });
      targetUser = usersList.users.find((u) => u.id === otp.user_id) || null;
    }

    if (!targetUser) {
      return NextResponse.json(
        { ok: false, error: "المستخدم غير موجود" },
        { status: 404 }
      );
    }

    // 7. ابحث عن team_member
    const { data: teamMember } = await adminClient
      .from("team_members")
      .select("id, name, role")
      .eq("user_id", targetUser.id)
      .single();

    if (!teamMember) {
      return NextResponse.json(
        { ok: false, error: "الحساب ليس لديه صلاحيات أدمن" },
        { status: 403 }
      );
    }

    // 8. أنشئ session عبر تعيين كلمة مرور مؤقتة + تسجيل الدخول بها
    // نولّد كلمة مرور عشوائية قوية، نحدّث بها المستخدم، ثم نسجّل الدخول
    const tempRandomPassword =
      "Tmp_" + Math.random().toString(36).slice(2, 12) + "!2026";

    const { error: pwdError } = await adminClient.auth.admin.updateUserById(
      targetUser.id,
      { password: tempRandomPassword }
    );

    if (pwdError) {
      console.error("Temp password set failed:", pwdError);
      return NextResponse.json(
        { ok: false, error: "تعذّر إنشاء الجلسة" },
        { status: 500 }
      );
    }

    // تسجيل الدخول بـ email + temp password لإنشاء session
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

    const { data: signInData, error: signInError } =
      await supabase.auth.signInWithPassword({
        email: targetUser.email,
        password: tempRandomPassword,
      });

    if (signInError || !signInData.session) {
      console.error("Sign-in failed:", signInError);
      return NextResponse.json(
        { ok: false, error: "فشل تسجيل الدخول بعد التحقق" },
        { status: 500 }
      );
    }

    // 9. تحقق إن كان المستخدم يحتاج تغيير كلمة المرور
    const needsPasswordChange = targetUser.user_metadata?.needs_password_change === true;

    return NextResponse.json({
      ok: true,
      needs_password_change: needsPasswordChange,
      user: {
        id: targetUser.id,
        phone: targetUser.phone,
        name: teamMember.name,
        role: teamMember.role,
      },
      redirect_to: needsPasswordChange ? "/admin/login?step=set-password" : "/admin",
    });
  } catch (error: any) {
    console.error("OTP verify error:", error);
    return NextResponse.json(
      { ok: false, error: "حدث خطأ داخلي: " + error.message },
      { status: 500 }
    );
  }
}
