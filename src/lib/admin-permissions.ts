// ==========================================
// التحقق من صلاحيات الأدمن على السيرفر (API routes فقط)
// - يجيب المستخدم الحالي من الجلسة (cookies → Supabase Auth)
// - يجيب بروفايله من team_members عبر service role
// - profileCan يفحص الإذن (super_admin و leader يتجاوزون)
// - الأدمن المطلق (super_admin): شفاء ذاتي لدوره لو اتبدّأ
// ==========================================

import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { normalizePermissions, PermissionMap, LEADER_PERMISSIONS } from "./permissions";
import { isAbsoluteAdminPhone } from "./absolute-admin";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://apcxwxnkntegbkimsmty.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export interface AdminProfile {
  userId: string;
  teamMemberId: string | null;
  name: string | null;
  role: string;
  permissions: PermissionMap;
}

export interface AdminCaller {
  user: { id: string; phone?: string | null; email?: string | null } | null;
  profile: AdminProfile | null;
  /** خطأ تهيئة السيرفر (service role مفقود مثلاً) */
  configError: string | null;
}

async function getAuthUser() {
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
          // ignore (Server Component context)
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * يرجع المستخدم الحالي + بروفايله من team_members (عبر service role)
 * - user = null → غير مسجل (401)
 * - profile = null → مسجل لكنه ليس من فريق الإدارة (403)
 */
export async function getCurrentAdminCaller(): Promise<AdminCaller> {
  try {
    const user = await getAuthUser();
    if (!user) return { user: null, profile: null, configError: null };

    if (!SUPABASE_SERVICE_ROLE_KEY) {
      return { user, profile: null, configError: "SUPABASE_SERVICE_ROLE_KEY غير مُهيّأ" };
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data, error } = await admin
      .from("team_members")
      .select("id, name, role, permissions")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error || !data) {
      // ليس عضو فريق → profile = null (403)
      return { user, profile: null, configError: null };
    }

    // ≡≡≡ الأدمن المطلق (super_admin) — شفاء ذاتي ≡≡≡
    // لو دور الحساب اتبدّأ من أي جهة، الرقم المطابق بيرجع super_admin
    // فوراً في الذاكرة + إصلاح دائم في القاعدة (best-effort)
    let effectiveRole = data.role || "assistant";
    let effectivePermissions = normalizePermissions(data.permissions);
    if (isAbsoluteAdminPhone(user.phone) && effectiveRole !== "super_admin") {
      effectiveRole = "super_admin";
      effectivePermissions = normalizePermissions(LEADER_PERMISSIONS);
      try {
        await admin
          .from("team_members")
          .update({ role: "super_admin", permissions: LEADER_PERMISSIONS })
          .eq("user_id", user.id);
      } catch (healError) {
        console.warn("absolute-admin self-heal failed:", healError);
      }
    }

    return {
      user,
      profile: {
        userId: user.id,
        teamMemberId: data.id ?? null,
        name: data.name ?? null,
        role: effectiveRole,
        permissions: effectivePermissions,
      },
      configError: null,
    };
  } catch (err: any) {
    return { user: null, profile: null, configError: err?.message || "خطأ غير متوقع" };
  }
}

/** فحص إذن — super_admin و leader يتجاوزون كل الفحوصات */
export function profileCan(
  profile: AdminProfile | null,
  resource: string,
  action: string
): boolean {
  if (!profile) return false;
  if (profile.role === "super_admin" || profile.role === "leader") return true;
  return !!profile.permissions?.[resource]?.[action];
}
