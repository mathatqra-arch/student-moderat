import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getCurrentAdminCaller, profileCan } from "@/lib/admin-permissions";
import { DEFAULT_PERMISSIONS, LEADER_PERMISSIONS } from "@/lib/permissions";

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

// الأذونات الافتراضية والأذونات الكاملة للمشرف — من المصدر الموحد في lib/permissions
// (DEFAULT_PERMISSIONS و LEADER_PERMISSIONS)

// ==========================================
// نطاق الرؤية الهرمي (hierarchy scoping):
// - الأدمن الرئيسي (super_admin): المتحكم الوحيد — يشوف الكل ويدير الكل،
//   ولا يراه ولا يُمَس من أي حساب آخر مهما كان دوره
// - الليدر (leader): يشوف شجرته فقط (نفسه + كل من تحته) —
//   لا يرى الأدمن الرئيسي ولا شجرات الليدرات الآخرين إطلاقاً
// - باقي الأدمنة: يشوفوا نفسهم + الحسابات اللي ضافوها تحتو (سلسلة parent_id)
// - الحساب بيتبوّى تحت اللي ضافه (parent_id) عند الإنشاء
// ==========================================

// كل أعضاء الفريق ضمن نسل عضو معيّن (نفسه + سلسلة parent_id بالكامل)
function collectVisibleMemberIds(
  selfMemberId: string | null,
  members: Array<{ id: string; parent_id: string | null }>
): Set<string> {
  const visible = new Set<string>();
  if (!selfMemberId) return visible;
  visible.add(selfMemberId);

  // خريطة: parent_id → قائمة الأبناء
  const childrenOf = new Map<string, string[]>();
  for (const m of members) {
    if (m.parent_id) {
      const arr = childrenOf.get(m.parent_id);
      if (arr) arr.push(m.id);
      else childrenOf.set(m.parent_id, [m.id]);
    }
  }

  // BFS من نفسي لكل النسل
  const queue = [selfMemberId];
  while (queue.length > 0) {
    const current = queue.shift() as string;
    for (const childId of childrenOf.get(current) || []) {
      if (!visible.has(childId)) {
        visible.add(childId);
        queue.push(childId);
      }
    }
  }
  return visible;
}

// هل العضو الهدف ضمن نسل سلف معيّن؟ (نمشي لفوق في parent_id مع حماية من الحلقات)
function isDescendantOf(
  targetMemberId: string,
  ancestorMemberId: string,
  members: Array<{ id: string; parent_id: string | null }>
): boolean {
  const byId = new Map(members.map((m) => [m.id, m]));
  let current = byId.get(targetMemberId);
  const seen = new Set<string>();
  while (current) {
    if (current.id === ancestorMemberId) return true;
    if (seen.has(current.id)) return false; // حلقة — نوقف
    seen.add(current.id);
    current = current.parent_id ? byId.get(current.parent_id) : undefined;
  }
  return false;
}

// بوابة صلاحية موحدة — ترجع null لو مسموح، أو NextResponse 401/403 لو مرفوض
async function requirePermission(resource: string, action: string) {
  const { user, profile, configError } = await getCurrentAdminCaller();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (configError) {
    return NextResponse.json({ error: configError }, { status: 500 });
  }
  if (!profile) {
    return NextResponse.json(
      { error: "حسابك غير مرتبط بفريق الإدارة" },
      { status: 403 }
    );
  }
  if (!profileCan(profile, resource, action)) {
    return NextResponse.json(
      { error: "معندكش صلاحية للعملية دي — كلم الليدر المسؤول" },
      { status: 403 }
    );
  }
  return { user, profile } as const;
}

// GET: قائمة الأدمن مع أذوناتهم — مُقيّدة حسب الـ hierarchy
export async function GET() {
  try {
    const gate = await requirePermission("team", "view");
    if (gate instanceof NextResponse) return gate;
    const user = gate.user;
    const profile = gate.profile;

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

    const members = teamMembers || [];

    // نطاق الرؤية: الأدمن الرئيسي (super_admin) يشوف الكل،
    // غيره (حتى الليدر) يشوف نفسه + الناس اللي تحتو في الشجرة فقط
    // → الأدمن الرئيسي غير مرئي لأي حساب آخر مهما كان دوره
    let visibleMemberIds: Set<string> | null = null;
    if (profile.role !== "super_admin") {
      visibleMemberIds = collectVisibleMemberIds(profile.teamMemberId, members);
    }

    // دمج البيانات
    const users = (usersData.users || []).map((u) => {
      const teamMember = members.find((tm) => tm.user_id === u.id);
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
        parent_id: teamMember?.parent_id || null,
      };
    });

    // فلترة حسب النطاق (غير الأدمن الرئيسي): فقط أعضاء الفريق ضمن شجرته
    // + حجب صريح للأدمن الرئيسي (دفاع عميق — مهما حدث في الشجرة يظل مخفياً)
    const scopedUsers = visibleMemberIds
      ? users.filter(
          (u) =>
            u.role !== "super_admin" &&
            u.team_member_id &&
            visibleMemberIds!.has(u.team_member_id)
        )
      : users;

    // رتّب: team_members الأول، ثم الباقي
    const sortedUsers = scopedUsers.sort((a, b) => {
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
    const gate = await requirePermission("team", "create");
    if (gate instanceof NextResponse) return gate;
    const user = gate.user;
    const profile = gate.profile;

    const body = await request.json();
    const { name, phone, role, password, permissions } = body;

    if (!name?.trim() || !phone?.trim() || !password?.trim()) {
      return NextResponse.json(
        { error: "الاسم، رقم الهاتف، وكلمة المرور مطلوبة" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "كلمة المرور يجب أن تكون 8 أحرف على الأقل" },
        { status: 400 }
      );
    }

    // الدور super_admin محجوز — الأدمن الرئيسي واحد فقط (يُنشأ من السكربت فقط)
    if (role === "super_admin") {
      return NextResponse.json(
        { error: "الأدمن الرئيسي واحد فقط في النظام — لا يمكن إنشاء غيره" },
        { status: 403 }
      );
    }

    // منع غير الأدمن الرئيسي من إنشاء حسابات leader (تثبيت للصلاحيات)
    if (role === "leader" && profile.role !== "super_admin") {
      return NextResponse.json(
        { error: "مسموح فقط للأدمن الرئيسي بإنشاء حسابات leader" },
        { status: 403 }
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

    // 2. إضافته لجدول team_members مع الأذونات — مربوط تحت اللي ضافه (parent_id)
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
          parent_id: profile.teamMemberId,
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
    const gate = await requirePermission("team", "edit");
    if (gate instanceof NextResponse) return gate;
    const user = gate.user;
    const profile = gate.profile;

    const body = await request.json();
    const { user_id, password, permissions, role, name } = body;

    if (!user_id) {
      return NextResponse.json({ error: "user_id مطلوب" }, { status: 400 });
    }

    const adminClient = getAdminClient();

    // حماية النطاق: غير الأدمن الرئيسي يعدّل نفسه (بدون دور/صلاحيات) أو شجرته فقط
    // (الليدر كذلك — شجرته هو، مش شجرات الليدرات الآخرين ولا الأدمن الرئيسي)
    if (profile.role !== "super_admin") {
      const { data: targetMember } = await adminClient
        .from("team_members")
        .select("id, user_id, parent_id, role")
        .eq("user_id", user_id)
        .maybeSingle();

      if (!targetMember) {
        return NextResponse.json(
          { error: "الحساب ده مش موجود في فريق الإدارة" },
          { status: 403 }
        );
      }

      // حجب صريح: الأدمن الرئيسي لا يُمَس من أي حساب آخر مهما كان دوره
      if (targetMember.role === "super_admin") {
        return NextResponse.json(
          { error: "الأدمن الرئيسي لا يمكن تعديله من أي حساب آخر" },
          { status: 403 }
        );
      }

      if (targetMember.user_id === profile.userId) {
        // تعديل النفس: الاسم وكلمة المرور بس — الدور والصلاحيات للأدمن الرئيسي
        if (permissions || role) {
          return NextResponse.json(
            { error: "مش تقدر تغيّر دورك أو صلاحياتك بنفسك — كلم الأدمن الرئيسي" },
            { status: 400 }
          );
        }
      } else {
        if (!profile.teamMemberId) {
          return NextResponse.json(
            { error: "حسابك غير مرتبط بفريق الإدارة" },
            { status: 403 }
          );
        }
        const { data: allMembers } = await adminClient
          .from("team_members")
          .select("id, parent_id");
        if (
          !isDescendantOf(targetMember.id, profile.teamMemberId, allMembers || [])
        ) {
          return NextResponse.json(
            { error: "الحساب ده مش من الحسابات اللي ضفتها — مش مسموح تعدّله" },
            { status: 403 }
          );
        }
      }

      // غير الأدمن الرئيسي ممنوع يعيّن أحد leader
      if (role === "leader") {
        return NextResponse.json(
          { error: "مسموح فقط للأدمن الرئيسي بتعيين دور leader" },
          { status: 403 }
        );
      }
    }

    // الدور super_admin محجوز — لا يُمنح من الـ API إطلاقاً
    // والأدمن الرئيسي لا يغيّر دوره بنفسه (حماية الجذر)
    if (role === "super_admin") {
      return NextResponse.json(
        { error: "الأدمن الرئيسي واحد فقط في النظام — دوره ثابت ولا يمكن منحه أو تغييره" },
        { status: 403 }
      );
    }
    if (role && user_id === user.id) {
      return NextResponse.json(
        { error: "لا يمكنك تغيير دورك أثناء تسجيل الدخول به" },
        { status: 400 }
      );
    }

    // 1. تحديث كلمة المرور إن وُجدت
    if (password) {
      if (password.length < 8) {
        return NextResponse.json(
          { error: "كلمة المرور يجب أن تكون 8 أحرف على الأقل" },
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
    const gate = await requirePermission("team", "delete");
    if (gate instanceof NextResponse) return gate;
    const user = gate.user;
    const profile = gate.profile;

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
      .select("id, role, parent_id")
      .eq("user_id", user_id)
      .single();

    // حماية النطاق: غير الأدمن الرئيسي يحذف من ضمن شجرته فقط
    // (الليدر كذلك — لا يصل لحسابات الليدرات الآخرين ولا للأدمن الرئيسي)
    if (profile.role !== "super_admin") {
      const { data: allMembers } = await adminClient
        .from("team_members")
        .select("id, parent_id");
      if (
        !targetMember ||
        !profile.teamMemberId ||
        !isDescendantOf(targetMember.id, profile.teamMemberId, allMembers || [])
      ) {
        return NextResponse.json(
          { error: "الحساب ده مش من الحسابات اللي ضفتها — مش مسموح تحذفه" },
          { status: 403 }
        );
      }

      // حجب صريح: الأدمن الرئيسي لا يُحذف من أي حساب آخر
      if (targetMember.role === "super_admin") {
        return NextResponse.json(
          { error: "الأدمن الرئيسي لا يمكن حذفه" },
          { status: 403 }
        );
      }
    }

    // حماية آخر leader — لا تنطبق على الأدمن الرئيسي (هو المتحكم الوحيد)
    if (targetMember?.role === "leader" && profile.role !== "super_admin") {
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
