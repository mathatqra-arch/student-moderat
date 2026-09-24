import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

// ==========================================
// Admin Phone Login Endpoint
// يستقبل phone + password ويحوّله server-side إلى email+password
// لأن Phone logins معطّلة في Supabase Dashboard افتراضياً
// ==========================================

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://apcxwxnkntegbkimsmty.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || "";

// عميل بـ service_role للبحث في auth.users
function getAdminClient() {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY غير مُهيّأ");
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// تحويل رقم مصري محلي إلى صيغة E.164
// 01040945655 → +201040945655
// 201040945655 → +201040945655
// +201040945655 → +201040945655
function normalizeEgyptianPhone(phone: string): string {
  const cleaned = phone.replace(/[\s\-()]/g, "").trim();
  if (cleaned.startsWith("+")) return cleaned;
  if (cleaned.startsWith("201") && cleaned.length === 12) return "+" + cleaned;
  if (cleaned.startsWith("01") && cleaned.length === 11) return "+2" + cleaned;
  if (cleaned.startsWith("2010") || cleaned.startsWith("2011") || cleaned.startsWith("2012") || cleaned.startsWith("2015")) {
    return "+" + cleaned;
  }
  return cleaned;
}

interface LoginResponse {
  ok: boolean;
  error?: string;
  user?: {
    id: string;
    phone?: string;
    email?: string;
    name?: string;
    role?: string;
  };
}

export async function POST(request: Request): Promise<NextResponse<LoginResponse>> {
  try {
    const body = await request.json();
    const phoneInput: string = (body.phone || "").trim();
    const password: string = body.password || "";

    if (!phoneInput || !password) {
      return NextResponse.json(
        { ok: false, error: "رقم الهاتف وكلمة المرور مطلوبان" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { ok: false, error: "كلمة المرور قصيرة جداً (6 أحرف على الأقل)" },
        { status: 400 }
      );
    }

    const normalizedPhone = normalizeEgyptianPhone(phoneInput);
    const adminClient = getAdminClient();

    // 1. البحث عن المستخدم في auth.users عبر Admin API
    const userSearch = await adminClient.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (userSearch.error) {
      console.error("Admin user search failed:", userSearch.error);
      return NextResponse.json(
        { ok: false, error: "تعذّر البحث عن المستخدم" },
        { status: 500 }
      );
    }

    // ابحث عن المستخدم برقم الهاتف (مطابقة مرنة)
    const targetUser = userSearch.data.users.find((u) => {
      if (!u.phone) return false;
      const userPhone = u.phone.replace(/^\+/, "");
      const inputPhone = normalizedPhone.replace(/^\+/, "");
      return (
        u.phone === normalizedPhone ||
        userPhone === inputPhone ||
        userPhone === inputPhone.replace(/^\+2/, "") ||
        u.phone === "+" + inputPhone
      );
    });

    if (!targetUser) {
      return NextResponse.json(
        {
          ok: false,
          error: "لا يوجد حساب أدمن مرتبط بهذا الرقم. تواصل مع المشرف الرئيسي.",
        },
        { status: 404 }
      );
    }

    if (!targetUser.email) {
      return NextResponse.json(
        { ok: false, error: "حساب الأدمن غير مُهيّأ بشكل صحيح (لا يوجد email داخلي)" },
        { status: 500 }
      );
    }

    // 2. تحقق أن المستخدم موجود في team_members (admin verification)
    const { data: teamMember, error: teamError } = await adminClient
      .from("team_members")
      .select("id, name, role")
      .eq("user_id", targetUser.id)
      .single();

    if (teamError || !teamMember) {
      console.warn(`User ${targetUser.id} (${targetUser.phone}) is not in team_members table`);
      return NextResponse.json(
        {
          ok: false,
          error: "هذا الحساب ليس لديه صلاحيات أدمن. تواصل مع المشرف الرئيسي.",
        },
        { status: 403 }
      );
    }

    // 3. تسجيل الدخول بـ email + password (server-side)
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

    const { data: signInData, error: signInError } =
      await supabase.auth.signInWithPassword({
        email: targetUser.email,
        password,
      });

    if (signInError || !signInData.session) {
      return NextResponse.json(
        {
          ok: false,
          error:
            signInError?.message === "Invalid login credentials"
              ? "كلمة المرور غير صحيحة"
              : signInError?.message || "فشل تسجيل الدخول",
        },
        { status: 401 }
      );
    }

    // 4. نجاح! أرجع بيانات المستخدم (بدون توكن حساس)
    return NextResponse.json({
      ok: true,
      user: {
        id: signInData.user.id,
        phone: signInData.user.phone || undefined,
        email: undefined, // لا نُرجع الـ email الداخلي للعميل
        name: teamMember.name,
        role: teamMember.role,
      },
    });
  } catch (error: any) {
    console.error("Admin login error:", error);
    return NextResponse.json(
      { ok: false, error: "حدث خطأ داخلي. حاول مرة أخرى." },
      { status: 500 }
    );
  }
}
