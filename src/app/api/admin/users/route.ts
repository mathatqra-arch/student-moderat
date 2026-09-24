import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

// ==========================================
// Admin Users Management API
// - GET:    استرجاع قائمة الأدمن (phone + name)
// - POST:   إنشاء أدمن جديد برقم هاتف
// - PUT:    تحديث (تغيير كلمة مرور)
// - DELETE: حذف حساب أدمن
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

// تحويل رقم مصري إلى E.164
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

// توليد كلمة مرور عشوائية قوية
function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#$";
  let pwd = "";
  for (let i = 0; i < 12; i++) {
    pwd += chars[Math.floor(Math.random() * chars.length)];
  }
  return pwd;
}

// GET: قائمة الأدمن (phone + name)
export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized: تسجيل دخول الأدمن مطلوب" },
        { status: 401 }
      );
    }

    const adminClient = getAdminClient();
    const { data, error } = await adminClient.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (error) throw error;

    const users = (data.users || []).map((u) => ({
      id: u.id,
      phone: u.phone,
      email: u.email,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
    }));

    return NextResponse.json({ users });
  } catch (error: any) {
    console.error("GET /api/admin/users error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: إنشاء أدمن جديد
export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized: تسجيل دخول الأدمن مطلوب" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name, phone, role, password } = body;

    if (!name?.trim() || !phone?.trim()) {
      return NextResponse.json(
        { error: "الاسم ورقم الهاتف مطلوبان" },
        { status: 400 }
      );
    }

    const normalizedPhone = normalizeEgyptianPhone(phone);
    const actualPassword = password?.trim() || generatePassword();
    const email = `admin+${Date.now().toString(36)}@batch-platform.local`;

    const adminClient = getAdminClient();

    // 1. إنشاء المستخدم في auth.users
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      phone: normalizedPhone,
      phone_confirm: true,
      email,
      email_confirm: true,
      password: actualPassword,
      user_metadata: {
        name: name.trim(),
        role: role || "assistant",
        full_name: name.trim(),
      },
      app_metadata: {
        role: "admin",
        provider: "phone",
      },
    });

    if (createError || !newUser.user) {
      throw new Error(createError?.message || "فشل إنشاء المستخدم");
    }

    // 2. إضافته لجدول team_members
    const { error: teamError } = await adminClient
      .from("team_members")
      .insert([
        {
          user_id: newUser.user.id,
          name: name.trim(),
          role: role || "assistant",
        },
      ]);

    if (teamError) {
      // rollback: حذف المستخدم إذا فشلت إضافته لـ team_members
      await adminClient.auth.admin.deleteUser(newUser.user.id);
      throw new Error(`فشلت الإضافة لجدول team_members: ${teamError.message}`);
    }

    return NextResponse.json({
      ok: true,
      user_id: newUser.user.id,
      phone: newUser.user.phone,
      password: password ? undefined : actualPassword, // أرجع كلمة المرور فقط لو كانت مولّدة تلقائياً
      message: password
        ? "تم إنشاء الحساب بنجاح"
        : "تم إنشاء الحساب بنجاح. احفظ كلمة المرور المولّدة.",
    });
  } catch (error: any) {
    console.error("POST /api/admin/users error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT: تحديث (تغيير كلمة مرور)
export async function PUT(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized: تسجيل دخول الأدمن مطلوب" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { user_id, password } = body;

    if (!user_id || !password) {
      return NextResponse.json(
        { error: "user_id و password مطلوبان" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" },
        { status: 400 }
      );
    }

    const adminClient = getAdminClient();
    const { error } = await adminClient.auth.admin.updateUserById(user_id, {
      password,
    });

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      message: "تم تحديث كلمة المرور بنجاح",
    });
  } catch (error: any) {
    console.error("PUT /api/admin/users error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: حذف حساب أدمن
export async function DELETE(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized: تسجيل دخول الأدمن مطلوب" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { user_id } = body;

    if (!user_id) {
      return NextResponse.json(
        { error: "user_id مطلوب" },
        { status: 400 }
      );
    }

    // منع حذف نفسك
    if (user_id === user.id) {
      return NextResponse.json(
        { error: "لا يمكنك حذف حسابك أثناء تسجيل الدخول به" },
        { status: 400 }
      );
    }

    const adminClient = getAdminClient();

    // 1. حذف من team_members
    const { error: teamError } = await adminClient
      .from("team_members")
      .delete()
      .eq("user_id", user_id);

    if (teamError) {
      console.warn("Failed to delete from team_members:", teamError);
    }

    // 2. حذف من auth.users
    const { error: authError } = await adminClient.auth.admin.deleteUser(user_id);

    if (authError) throw authError;

    return NextResponse.json({
      ok: true,
      message: "تم حذف الحساب نهائياً",
    });
  } catch (error: any) {
    console.error("DELETE /api/admin/users error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
