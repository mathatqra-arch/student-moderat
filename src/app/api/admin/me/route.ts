import { NextResponse } from "next/server";
import { getCurrentAdminCaller } from "@/lib/admin-permissions";

// ==========================================
// GET /api/admin/me
// بروفايل الأدمن الحالي: الاسم + الدور + الصلاحيات
// تستخدمه لوحة الأدمن لفلترة التابات حسب صلاحيات كل عضو
// ==========================================

export async function GET() {
  try {
    const { user, profile, configError } = await getCurrentAdminCaller();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized: تسجيل دخول الأدمن مطلوب" },
        { status: 401 }
      );
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

    return NextResponse.json({
      id: profile.userId,
      name: profile.name,
      role: profile.role,
      permissions: profile.permissions,
    });
  } catch (error: any) {
    console.error("GET /api/admin/me error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
