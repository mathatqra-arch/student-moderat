import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ==========================================
// Admin OTP Send Endpoint
// يستقبل رقم الهاتف، يولّد رمز 6 أرقام، يخزّنه، ويعيده للعميل
// (في الإنتاج: سيرسل عبر SMS provider بدلاً من إرجاعه)
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
const OTP_RATE_LIMIT_SECONDS = 60; // دقيقة بين كل طلب

export async function POST(request: Request) {
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

    // 1. التحقق من وجود مستخدم بهذا الرقم في auth.users
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

    // 2. التحقق من أن المستخدم موجود في team_members
    const { data: teamMember, error: teamError } = await adminClient
      .from("team_members")
      .select("id, name, role")
      .eq("user_id", targetUser.id)
      .single();

    if (teamError || !teamMember) {
      return NextResponse.json(
        { ok: false, error: "هذا الحساب ليس لديه صلاحيات أدمن." },
        { status: 403 }
      );
    }

    // 3. التحقق من rate limit (لا يوجد OTP صادر خلال آخر دقيقة)
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

    // 4. توليد رمز OTP
    const code = generateOTP();
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString();

    // 5. إبطال أي رموز سابقة غير مستخدمة لهذا الرقم
    await adminClient
      .from("admin_otps")
      .update({ used: true })
      .eq("phone", normalizedPhone)
      .eq("used", false);

    // 6. تخزين الرمز الجديد
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
        { ok: false, error: "تعذّر تخزين رمز التحقق" },
        { status: 500 }
      );
    }

    // 7. في الإنتاج: أرسل الرمز عبر SMS provider هنا
    // مثال: await sendSMS(normalizedPhone, `رمز التحقق الخاص بك هو: ${code}`)
    // حالياً: نُرجع الرمز في الاستجابة (للتطوير والاختبار فقط)
    const isDev = process.env.NODE_ENV === "development" || !process.env.SMS_PROVIDER_CONFIGURED;

    return NextResponse.json({
      ok: true,
      message: isDev
        ? `تم إرسال رمز التحقق (وضع التطوير: الرمز معروض هنا)`
        : `تم إرسال رمز التحقق إلى رقمك`,
      expires_in: OTP_TTL_MINUTES * 60,
      ...(isDev ? { code } : {}), // أرجع الرمز في وضع التطوير فقط
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
