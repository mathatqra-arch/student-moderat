import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import {
  verifyFirebaseIdToken,
  isFirebaseConfigured,
  getFirebaseProjectId,
} from "@/lib/firebase/verifier";

// ==========================================
// Firebase Verify Endpoint
// يستقبل Firebase idToken من العميل (بعد OTP Firebase)
// يتحقق منه server-side باستخدام Web Crypto API (Cloudflare Workers compatible)
// يلاقي المستخدم في Supabase، وينشئ session
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

function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/[\s\-()]/g, "").trim();
  if (cleaned.startsWith("+")) return cleaned;
  if (cleaned.startsWith("201") && cleaned.length === 12) return "+" + cleaned;
  if (cleaned.startsWith("01") && cleaned.length === 11) return "+2" + cleaned;
  return cleaned;
}

interface VerifyResponse {
  ok: boolean;
  error?: string;
  needs_password_change?: boolean;
  user?: { id: string; phone?: string; name?: string; role?: string };
  redirect_to?: string;
}

export async function POST(request: Request): Promise<NextResponse<VerifyResponse>> {
  try {
    // 1. التحقق من إعدادات Firebase
    if (!isFirebaseConfigured()) {
      return NextResponse.json(
        {
          ok: false,
          error: "Firebase غير مُهيّأ. استخدم OTP العادي (سيظهر الرمز على الشاشة).",
        },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { id_token } = body;

    if (!id_token) {
      return NextResponse.json(
        { ok: false, error: "Firebase id_token مطلوب" },
        { status: 400 }
      );
    }

    // 2. التحقق من Firebase idToken باستخدام Web Crypto API
    // (لا يعتمد على firebase-admin SDK، يعمل على Cloudflare Workers)
    const projectId = getFirebaseProjectId();
    if (!projectId) {
      return NextResponse.json(
        { ok: false, error: "Firebase project_id غير مُهيّأ" },
        { status: 500 }
      );
    }

    let decodedToken;
    try {
      decodedToken = await verifyFirebaseIdToken(id_token, { projectId });
    } catch (err: any) {
      console.error("Firebase token verification failed:", err.message);
      return NextResponse.json(
        { ok: false, error: `Firebase token غير صالح: ${err.message}` },
        { status: 401 }
      );
    }

    // 3. استخراج رقم الهاتف من الـ token
    const firebasePhone = decodedToken.phone_number;
    if (!firebasePhone) {
      return NextResponse.json(
        { ok: false, error: "Firebase token لا يحتوي على رقم هاتف" },
        { status: 400 }
      );
    }

    const normalizedPhone = normalizePhone(firebasePhone);

    // 4. البحث عن المستخدم في Supabase auth.users
    const supabase = getAdminClient();
    const { data: usersList, error: listError } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (listError) {
      console.error("Supabase list users failed:", listError);
      return NextResponse.json(
        { ok: false, error: "تعذّر البحث عن المستخدم" },
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
        { ok: false, error: "لا يوجد حساب أدمن بهذا الرقم" },
        { status: 404 }
      );
    }

    // 5. التحقق من team_members
    const { data: teamMember } = await supabase
      .from("team_members")
      .select("id, name, role")
      .eq("user_id", targetUser.id)
      .single();

    if (!teamMember) {
      return NextResponse.json(
        { ok: false, error: "هذا الحساب ليس لديه صلاحيات أدمن" },
        { status: 403 }
      );
    }

    // 6. إنشاء Supabase session عبر temp password
    const tempRandomPassword =
      "Tmp_" + Math.random().toString(36).slice(2, 12) + "!2026";

    const { error: pwdError } = await supabase.auth.admin.updateUserById(
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

    const cookieStore = await cookies();
    const supabaseClient = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
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
      await supabaseClient.auth.signInWithPassword({
        email: targetUser.email!,
        password: tempRandomPassword,
      });

    if (signInError || !signInData.session) {
      console.error("Supabase sign-in failed:", signInError);
      return NextResponse.json(
        { ok: false, error: "فشل إنشاء الجلسة بعد التحقق" },
        { status: 500 }
      );
    }

    // 7. تحقق إن كان يحتاج تغيير كلمة المرور
    const needsPasswordChange = targetUser.user_metadata?.needs_password_change === true;

    return NextResponse.json({
      ok: true,
      needs_password_change: needsPasswordChange,
      user: {
        id: targetUser.id,
        phone: targetUser.phone || undefined,
        name: teamMember.name,
        role: teamMember.role,
      },
      redirect_to: needsPasswordChange ? "/admin/login?step=set-password" : "/admin",
    });
  } catch (error: any) {
    console.error("Firebase verify error:", error);
    return NextResponse.json(
      { ok: false, error: "حدث خطأ داخلي: " + error.message },
      { status: 500 }
    );
  }
}
