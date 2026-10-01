// ==========================================
// التحقق من صلاحيات الأدمن على السيرفر (API routes فقط)
// - يجيب المستخدم الحالي من الجلسة (cookies → Supabase Auth)
// - يجيب بروفايله من team_members عبر service role
// - profileCan يفحص الإذن (الـ leader يتجاوز)
// ==========================================

import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { normalizePermissions, PermissionMap } from "./permissions";

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

    return {
      user,
      profile: {
        userId: user.id,
        teamMemberId: data.id ?? null,
        name: data.name ?? null,
        role: data.role || "assistant",
        permissions: normalizePermissions(data.permissions),
      },
      configError: null,
    };
  } catch (err: any) {
    return { user: null, profile: null, configError: err?.message || "خطأ غير متوقع" };
  }
}

/** فحص إذن — الـ leader يتجاوز كل الفحوصات */
export function profileCan(
  profile: AdminProfile | null,
  resource: string,
  action: string
): boolean {
  if (!profile) return false;
  if (profile.role === "leader") return true;
  return !!profile.permissions?.[resource]?.[action];
}
