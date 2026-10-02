import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { missingServerConfig, configErrorResponse } from "@/lib/server-config";
import { LEADER_PERMISSIONS } from "@/lib/permissions";
import { isAbsoluteAdminPhone } from "@/lib/absolute-admin";

// ==========================================
// Admin Login Endpoint — Phone + Password
// محصّن ضد: Brute Force (rate limit) + User Enumeration (رسائل موحدة)
// ==========================================

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://apcxwxnkntegbkimsmty.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || "";

// رسالة موحدة — لا نكشف هل الرقم موجود أم كلمة المرور خاطئة
const GENERIC_LOGIN_ERROR = "بيانات الدخول غير صحيحة";

// ==========================================
// كاش البحث phone → email (5 دقائق) — لتخفيف listUsers(1000) المكلف
// تحت حمل 1000+ مستخدم، محاولات الدخول المتكررة لا تضرب Admin API كل مرة
// ==========================================
const USER_LOOKUP_CACHE = new Map<
  string,
  { email: string; userId: string; needsPasswordChange: boolean; expiresAt: number }
>();
const USER_CACHE_TTL_MS = 5 * 60 * 1000;
const USER_CACHE_MAX = 200;

function cacheUserLookup(phone: string, entry: { email: string; userId: string; needsPasswordChange: boolean }) {
  if (USER_CACHE_MAX && USER_LOOKUP_CACHE.size >= USER_CACHE_MAX) {
    // أحذف الأقدم
    const oldest = USER_LOOKUP_CACHE.keys().next().value;
    if (oldest) USER_LOOKUP_CACHE.delete(oldest);
  }
  USER_LOOKUP_CACHE.set(phone, { ...entry, expiresAt: Date.now() + USER_CACHE_TTL_MS });
}

function getCachedUserLookup(phone: string) {
  const hit = USER_LOOKUP_CACHE.get(phone);
  if (!hit) return null;
  if (hit.expiresAt < Date.now()) {
    USER_LOOKUP_CACHE.delete(phone);
    return null;
  }
  return hit;
}

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

interface LoginResponse {
  ok: boolean;
  error?: string;
  user?: {
    id: string;
    phone?: string;
    name?: string;
    role?: string;
    needs_password_change?: boolean;
  };
}

export async function POST(request: Request): Promise<NextResponse<LoginResponse>> {
  // -1. فحص إعدادات السيرفر — 503 واضحة بدل 500 غامضة
  if (missingServerConfig()) {
    return configErrorResponse("admin/login") as NextResponse<LoginResponse>;
  }

  // 0. Rate Limit — 10 محاولات كل 5 دقائق لكل IP
  const limited = await enforceRateLimit(request, RATE_LIMITS.login);
  if (limited) return limited as NextResponse<LoginResponse>;

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

    const normalizedPhone = normalizeEgyptianPhone(phoneInput);
    const adminClient = getAdminClient();

    // 1. البحث عن المستخدم — من الكاش أولاً ثم Admin API
    let targetEmail: string | undefined;
    let targetId: string | undefined;
    let needsPasswordChange = false;

    const cached = getCachedUserLookup(normalizedPhone);
    if (cached) {
      targetEmail = cached.email;
      targetId = cached.userId;
      needsPasswordChange = cached.needsPasswordChange;
    } else {
      const { data: usersData, error: listError } = await adminClient.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });

      if (listError) {
        console.error("Admin user search failed:", listError);
        return NextResponse.json(
          { ok: false, error: "تعذّر التحقق من بيانات الدخول" },
          { status: 500 }
        );
      }

      const targetUser = usersData.users.find((u) => {
        if (!u.phone) return false;
        const userPhone = u.phone.replace(/^\+/, "");
        const inputPhone = normalizedPhone.replace(/^\+/, "");
        return (
          u.phone === normalizedPhone ||
          userPhone === inputPhone ||
          userPhone === inputPhone.replace(/^\+2/, "")
        );
      });

      if (targetUser?.email) {
        targetEmail = targetUser.email;
        targetId = targetUser.id;
        needsPasswordChange = targetUser.user_metadata?.needs_password_change === true;
        cacheUserLookup(normalizedPhone, {
          email: targetEmail,
          userId: targetId,
          needsPasswordChange,
        });
      }
    }

    // رسالة موحدة — لا نكشف وجود الحساب أم لا
    if (!targetEmail) {
      return NextResponse.json(
        { ok: false, error: GENERIC_LOGIN_ERROR },
        { status: 401 }
      );
    }

    // 2. التحقق من team_members
    const { data: teamMember, error: teamError } = await adminClient
      .from("team_members")
      .select("id, name, role, permissions")
      .eq("user_id", targetId)
      .single();

    if (teamError || !teamMember) {
      return NextResponse.json(
        { ok: false, error: GENERIC_LOGIN_ERROR },
        { status: 401 }
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
            // ignore
          }
        },
      },
    });

    const { data: signInData, error: signInError } =
      await supabase.auth.signInWithPassword({
        email: targetEmail,
        password,
      });

    if (signInError || !signInData.session) {
      return NextResponse.json(
        { ok: false, error: GENERIC_LOGIN_ERROR },
        { status: 401 }
      );
    }

    // 4. الأدمن المطلق (super_admin) — ترقية ذاتية عند الدخول
    //    الرقم المطابق بيرقى دورّه في القاعدة فوراً (من السيرفر فقط)
    //    فتفعّل حمايّاته وإخفاؤه عن كل الحسابات الأخرى من أول جلسة
    let effectiveRole: string = teamMember.role;
    if (isAbsoluteAdminPhone(signInData.user.phone) && effectiveRole !== "super_admin") {
      effectiveRole = "super_admin";
      try {
        await adminClient
          .from("team_members")
          .update({ role: "super_admin", permissions: LEADER_PERMISSIONS })
          .eq("user_id", targetId);
      } catch (promoteError) {
        console.warn("absolute-admin promotion failed:", promoteError);
      }
    }

    // 5. النجاح
    return NextResponse.json({
      ok: true,
      user: {
        id: signInData.user.id,
        phone: signInData.user.phone || undefined,
        name: teamMember.name,
        role: effectiveRole,
        needs_password_change: needsPasswordChange,
      },
    });
  } catch (error: any) {
    console.error("Admin login error:", error);
    return NextResponse.json(
      { ok: false, error: "حدث خطأ داخلي" },
      { status: 500 }
    );
  }
}
