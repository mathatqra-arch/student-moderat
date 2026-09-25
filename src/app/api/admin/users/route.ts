import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

// ==========================================
// Admin Users Management API
// - GET:    استرجاع قائمة الأدمن + أذوناتهم
// - POST:   إنشاء أدمن جديد (phone + password + permissions)
// - PUT:    تحديث (تغيير كلمة مرور / تحديث أذونات)
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

function normalizeEgyptianPhone(phone: string): string {
  const cleaned = phone.replace(/[\s\-()]/g, "").trim();
  if (cleaned.startsWith("+")) return cleaned;
  if (cleaned.startsWith("201") && cleaned.length === 12) return "+" + cleaned;
  if (cleaned.startsWith("01") && cleaned.length === 11) return "+2" + cleaned;
  return cleaned;
}

// الأذونات الافتراضية لمشرف جديد (assistant)
const DEFAULT_PERMISSIONS = {
  inquiries: { view: true, reply: true, delete: false },
  announcements: { view: true, create: true, edit: true, delete: false },
  tasks: { view: true, create: true, edit: true, delete: false },
  team: { view: true, create: false, edit: false, delete: false },
  api_keys: { view: false, create: false, delete: false },
  mcp: { view: false, test: false },
  settings: { view: false, edit: false },
};

// أذونات الـ leader (كل شيء)
const LEADER_PERMISSIONS = {
  inquiries: { view: true, reply: true, delete: true },
  announcements: { view: true, create: true, edit: true, delete: true },
  tasks: { view: true, create: true, edit: true, delete: true },
  team: { view: true, create: true, edit: true, delete: true },
  api_keys: { view: true, create: true, delete: true },
  mcp: { view: true, test: true },
  settings: { view: true, edit: true },
};

// GET: قائمة الأدمن مع أذوناتهم
export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminClient = getAdminClient();

    // جلب قائمة المستخدمين من auth.users
    const { data: usersData, error: usersError } = await adminClient.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (usersError) throw usersError;

    // جلب بيانات team_members (مع الأذونات)
    const { data: teamMembers, error: teamError } = await adminClient
      .from("team_members")
      .select("*")
      .order("created_at", { ascending: false });

    if (teamError) throw teamError;

    // دمج البيانات
    const users = (usersData.users || []).map((u) => {
      const teamMember = teamMembers?.find((tm) => tm.user_id === u.id);
      return {
        id: u.id,
        phone: u.phone,
        email: u.email,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        name: teamMember?.name || null,
        role: teamMember?.role || null,
        permissions: teamMember?.permissions || null,
        team_member_id: teamMember?.id || null,
      };
    });

    // رتّب: team_members الأول، ثم الباقي
    const sortedUsers = users.sort((a, b) => {
      if (a.team_member_id && !b.team_member_id) return -1;
      if (!a.team_member_id && b.team_member_id) return 1;
      return 0;
    });

    return NextResponse.json({ users: sortedUsers });
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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, phone, role, password, permissions } = body;

    if (!name?.trim() || !phone?.trim() || !password?.trim()) {
      return NextResponse.json(
        { error: "الاسم، رقم الهاتف، وكلمة المرور مطلوبة" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" },
        { status: 400 }
      );
    }

    const normalizedPhone = normalizeEgyptianPhone(phone);
    const email = `admin+${Date.now().toString(36)}@batch-platform.local`;

    const adminClient = getAdminClient();

    // 1. إنشاء المستخدم في auth.users
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      phone: normalizedPhone,
      phone_confirm: true,
      email,
      email_confirm: true,
      password,
      user_metadata: {
        name: name.trim(),
        role: role || "assistant",
        full_name: name.trim(),
        needs_password_change: false, // المستخدم يدخل كلمة مروره الخاصة من البداية
      },
      app_metadata: {
        role: "admin",
        provider: "phone",
      },
    });

    if (createError || !newUser.user) {
      throw new Error(createError?.message || "فشل إنشاء المستخدم");
    }

    // 2. إضافته لجدول team_members مع الأذونات
    const userPermissions =
      role === "leader"
        ? LEADER_PERMISSIONS
        : permissions || DEFAULT_PERMISSIONS;

    const { error: teamError } = await adminClient
      .from("team_members")
      .insert([
        {
          user_id: newUser.user.id,
          name: name.trim(),
          role: role || "assistant",
          permissions: userPermissions,
        },
      ]);

    if (teamError) {
      await adminClient.auth.admin.deleteUser(newUser.user.id);
      throw new Error(`فشلت الإضافة لـ team_members: ${teamError.message}`);
    }

    return NextResponse.json({
      ok: true,
      user_id: newUser.user.id,
      phone: newUser.user.phone,
      message: "تم إنشاء الحساب بنجاح",
    });
  } catch (error: any) {
    console.error("POST /api/admin/users error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT: تحديث مستخدم (تغيير كلمة مرور / تحديث أذونات / تغيير role)
export async function PUT(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { user_id, password, permissions, role, name } = body;

    if (!user_id) {
      return NextResponse.json({ error: "user_id مطلوب" }, { status: 400 });
    }

    const adminClient = getAdminClient();

    // 1. تحديث كلمة المرور إن وُجدت
    if (password) {
      if (password.length < 6) {
        return NextResponse.json(
          { error: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" },
          { status: 400 }
        );
      }

      const { error: pwdError } = await adminClient.auth.admin.updateUserById(user_id, {
        password,
      });
      if (pwdError) throw pwdError;

      // تحديث password_changed_at
      await adminClient
        .from("team_members")
        .update({ password_changed_at: new Date().toISOString() })
        .eq("user_id", user_id);
    }

    // 2. تحديث الأذونات والـ role والاسم في team_members
    const updateData: any = {};
    if (permissions) {
      // لو الـ role = leader، نضمن إنه عنده كل الأذونات
      updateData.permissions = role === "leader" ? LEADER_PERMISSIONS : permissions;
    }
    if (role) {
      updateData.role = role;
      if (role === "leader" && !permissions) {
        updateData.permissions = LEADER_PERMISSIONS;
      }
    }
    if (name) {
      updateData.name = name.trim();
    }

    if (Object.keys(updateData).length > 0) {
      const { error: teamError } = await adminClient
        .from("team_members")
        .update(updateData)
        .eq("user_id", user_id);

      if (teamError) throw teamError;
    }

    return NextResponse.json({
      ok: true,
      message: "تم تحديث المستخدم بنجاح",
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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { user_id } = body;

    if (!user_id) {
      return NextResponse.json({ error: "user_id مطلوب" }, { status: 400 });
    }

    if (user_id === user.id) {
      return NextResponse.json(
        { error: "لا يمكنك حذف حسابك أثناء تسجيل الدخول به" },
        { status: 400 }
      );
    }

    const adminClient = getAdminClient();

    // التحقق من عدم حذف الـ leader الأخير
    const { data: targetMember } = await adminClient
      .from("team_members")
      .select("role")
      .eq("user_id", user_id)
      .single();

    if (targetMember?.role === "leader") {
      const { count } = await adminClient
        .from("team_members")
        .select("*", { count: "exact", head: true })
        .eq("role", "leader");

      if ((count || 0) <= 1) {
        return NextResponse.json(
          { error: "لا يمكن حذف آخر leader في النظام" },
          { status: 400 }
        );
      }
    }

    // 1. حذف من team_members
    const { error: teamError } = await adminClient
      .from("team_members")
      .delete()
      .eq("user_id", user_id);
    if (teamError) console.warn("team_members delete:", teamError);

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
