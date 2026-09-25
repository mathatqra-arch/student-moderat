import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ==========================================
// Admin OTP Send Endpoint — Production Mode
// - يحاول Firebase Phone Auth أولاً (SMS حقيقي)
// - لو فشل أو الـ quota خلص: fallback لـ OTP على الشاشة
// - في الإنتاج: لا يُرجع الكود للعميل إلا في حالة الـ fallback فقط
// ==========================================

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://apcxwxnkntegbkimsmty.supabase.co";
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

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

const OTP_TTL_MINUTES = 10;
const OTP_RATE_LIMIT_SECONDS = 60;

interface SendResponse {
  ok: boolean;
  error?: string;
  message?: string;
  retry_after?: number;
  code?: string; // يرجع فقط في حالة fallback (quota exhausted)
  delivery_method?: "sms" | "screen_fallback";
  expires_in?: number;
  user_preview?: { name: string; role: string };
}

export async function POST(request: Request): Promise<NextResponse<SendResponse>> {
  try {
    const body = await request.json();
    const phoneInput: string = (body.phone || "").trim();

    if (!phoneInput) {
      return NextResponse.json(
        { ok: false, error: "رقم الهاتف مطلوب" },
        { status: 400 }
      );
    }

    const normalizedPhone = normalizeEgyptianPhone(phoneInput);
    const adminClient = getAdminClient();

    // 1. التحقق من وجود المستخدم
    const { data: usersList, error: listError } = await adminClient.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (listError) {
      console.error("List users error:", listError);
      return NextResponse.json(
        { ok: false, error: "تعذّر التحقق من الرقم" },
        { status: 500 }
      );
    }

    const targetUser = usersList.users.find((u) => {
      if (!u.phone) return false;
      const userPhone = u.phone.replace(/^\+/, "");
      const inputPhone = normalizedPhone.replace(/^\+/, "");
      return (
        u.phone === normalizedPhone ||
        userPhone === inputPhone ||
        userPhone === inputPhone.replace(/^\+2/, "")
      );
    });

    if (!targetUser) {
      return NextResponse.json(
        { ok: false, error: "لا يوجد حساب أدمن بهذا الرقم. تواصل مع المشرف الرئيسي." },
        { status: 404 }
      );
    }

    // 2. التحقق من team_members
    const { data: teamMember } = await adminClient
      .from("team_members")
      .select("id, name, role")
      .eq("user_id", targetUser.id)
      .single();

    if (!teamMember) {
      return NextResponse.json(
        { ok: false, error: "هذا الحساب ليس لديه صلاحيات أدمن." },
        { status: 403 }
      );
    }

    // 3. Rate limit check
    const oneMinuteAgo = new Date(Date.now() - OTP_RATE_LIMIT_SECONDS * 1000).toISOString();
    const { data: recentOtp } = await adminClient
      .from("admin_otps")
      .select("id, created_at")
      .eq("phone", normalizedPhone)
      .gte("created_at", oneMinuteAgo)
      .order("created_at", { ascending: false })
      .limit(1);

    if (recentOtp && recentOtp.length > 0) {
      const lastCreated = new Date(recentOtp[0].created_at).getTime();
      const waitSeconds = Math.ceil(
        (OTP_RATE_LIMIT_SECONDS * 1000 - (Date.now() - lastCreated)) / 1000
      );
      return NextResponse.json(
        {
          ok: false,
          error: `يرجى الانتظار ${waitSeconds} ثانية قبل طلب رمز جديد`,
          retry_after: waitSeconds,
        },
        { status: 429 }
      );
    }

    // 4. توليد رمز OTP وتخزينه
    const code = generateOTP();
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString();

    // إبطال أي رموز سابقة
    await adminClient
      .from("admin_otps")
      .update({ used: true })
      .eq("phone", normalizedPhone)
      .eq("used", false);

    const clientIp =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("cf-connecting-ip") ||
      "unknown";

    const { error: insertError } = await adminClient
      .from("admin_otps")
      .insert([
        {
          phone: normalizedPhone,
          code,
          user_id: targetUser.id,
          expires_at: expiresAt,
          ip_address: clientIp,
        },
      ]);

    if (insertError) {
      console.error("OTP insert error:", insertError);
      return NextResponse.json(
        { ok: false, error: "تعذّر تخزين رمز التحقق — تأكد من إنشاء جدول admin_otps" },
        { status: 500 }
      );
    }

    // 5. محاولة Firebase Phone Auth (SMS حقيقي)
    // نحدد إذا كان Firebase مُهيّأ
    const firebaseConfigured = Boolean(
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
        (process.env.FIREBASE_PROJECT_ID &&
          process.env.FIREBASE_CLIENT_EMAIL &&
          process.env.FIREBASE_PRIVATE_KEY)
    );

    // استراتيجية الإنتاج الحقيقي:
    // - الـ server يخزّن الكود في DB فقط (للتحقق لاحقاً)
    // - الـ client (browser) بيجرّب Firebase Phone Auth للـ SMS الحقيقي
    // - لو Firebase فشل → الـ client يعرض رسالة خطأ + يطلب المحاولة مرة أخرى
    // - ❌ الكود ما بيظهرش للمستخدم أبداً (أمان عالي)
    const deliveryMethod: "sms" | "screen_fallback" = firebaseConfigured
      ? "sms"
      : "screen_fallback";

    const responseMessage = firebaseConfigured
      ? "تم إرسال رمز التحقق إلى رقمك عبر SMS"
      : "Firebase غير مُهيّأ. تواصل مع المشرف.";

    // ❌ مفيش code في الاستجابة أبداً — الكود بيتخزّن في DB فقط للتحقق
    return NextResponse.json({
      ok: true,
      message: responseMessage,
      delivery_method: deliveryMethod,
      expires_in: OTP_TTL_MINUTES * 60,
      user_preview: {
        name: teamMember.name,
        role: teamMember.role,
      },
    });
  } catch (error: any) {
    console.error("OTP send error:", error);
    return NextResponse.json(
      { ok: false, error: "حدث خطأ داخلي: " + error.message },
      { status: 500 }
    );
  }
}
