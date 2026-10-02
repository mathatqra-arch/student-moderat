// ==========================================
// نظام الصلاحيات — مصدر واحد للحقيقة (Frontend + API)
// يطابق نموذج team_members.permissions في قاعدة البيانات
// (supabase/migrations/20260925_admin_permissions.sql)
// الـ leader يتجاوز كل الفحوصات — الباقي حسب JSON الصلاحيات
// ==========================================

export type PermissionActionMap = Record<string, boolean>;
export type PermissionMap = Record<string, PermissionActionMap>;

export interface ResourceConfig {
  label: string;
  actions: { key: string; label: string }[];
  defaults: PermissionActionMap;
}

const A = {
  view: { key: "view", label: "عرض" },
  create: { key: "create", label: "إضافة" },
  edit: { key: "edit", label: "تعديل" },
  delete: { key: "delete", label: "حذف" },
  reply: { key: "reply", label: "رد/تحديث الحالة" },
  review: { key: "review", label: "مراجعة" },
  test: { key: "test", label: "اختبار" },
};

export const RESOURCES: Record<string, ResourceConfig> = {
  inquiries: {
    label: "الاستفسارات",
    // إضافة/تعديل هنا خاصة بإدارة تصنيفات الاستفسارات (مش إضافة استفسارات)
    actions: [A.view, A.reply, A.create, A.edit, A.delete],
    defaults: { view: true, reply: true, create: false, edit: false, delete: false },
  },
  announcements: {
    label: "الإعلانات",
    actions: [A.view, A.create, A.edit, A.delete],
    defaults: { view: true, create: true, edit: true, delete: false },
  },
  tasks: {
    label: "التكليفات والمهام",
    actions: [A.view, A.create, A.edit, A.delete],
    defaults: { view: true, create: true, edit: true, delete: false },
  },
  schedules: {
    label: "الجداول",
    actions: [A.view, A.create, A.edit, A.delete],
    defaults: { view: true, create: false, edit: false, delete: false },
  },
  subjects: {
    label: "المواد الدراسية",
    actions: [A.view, A.create, A.edit, A.delete],
    defaults: { view: true, create: false, edit: false, delete: false },
  },
  important_dates: {
    label: "التواريخ المهمة",
    actions: [A.view, A.create, A.edit, A.delete],
    defaults: { view: true, create: false, edit: false, delete: false },
  },
  submissions: {
    label: "التسليمات",
    actions: [A.view, A.review],
    defaults: { view: true, review: false },
  },
  attendance: {
    label: "الحضور",
    actions: [A.view, A.create, A.edit],
    defaults: { view: true, create: false, edit: false },
  },
  links: {
    label: "الروابط السريعة",
    actions: [A.view, A.edit],
    defaults: { view: true, edit: false },
  },
  team: {
    label: "الفريق والصلاحيات",
    actions: [A.view, A.create, A.edit, A.delete],
    defaults: { view: true, create: false, edit: false, delete: false },
  },
  api_keys: {
    label: "مفاتيح API",
    actions: [A.view, A.create, A.delete],
    defaults: { view: false, create: false, delete: false },
  },
  mcp: {
    label: "خادم MCP",
    actions: [A.view, A.test],
    defaults: { view: false, test: false },
  },
  settings: {
    label: "الإعدادات",
    actions: [A.view, A.edit],
    defaults: { view: false, edit: false },
  },
};

// صلاحيات المساعد الجديد — مطابقة للـ DEFAULT في القاعدة
export const DEFAULT_PERMISSIONS: PermissionMap = Object.fromEntries(
  Object.entries(RESOURCES).map(([resource, config]) => [resource, { ...config.defaults }])
);

// صلاحيات الـ leader — كل شيء
export const LEADER_PERMISSIONS: PermissionMap = Object.fromEntries(
  Object.entries(RESOURCES).map(([resource, config]) => [
    resource,
    Object.fromEntries(config.actions.map((a) => [a.key, true])),
  ])
);

/**
 * يدمج الصلاحيات المحفوظة (قد تكون قديمة/ناقصة) فوق القالب الافتراضي
 * — يضمن أن كل مجموعة وأزرارها موجودة حتى لو الحساب اتعمل قبل إضافة المجموعة
 */
export function normalizePermissions(raw: unknown): PermissionMap {
  const base: PermissionMap = JSON.parse(JSON.stringify(DEFAULT_PERMISSIONS));
  if (raw && typeof raw === "object") {
    for (const [resource, actions] of Object.entries(raw as PermissionMap)) {
      if (!base[resource]) base[resource] = {};
      if (actions && typeof actions === "object") {
        for (const [action, value] of Object.entries(actions)) {
          if (typeof value === "boolean") base[resource][action] = value;
        }
      }
    }
  }
  return base;
}

/** فحص إذن — الـ leader عنده كل شيء، الباقي حسب الـ JSON */
export function hasPermission(
  perms: PermissionMap | null | undefined,
  resource: string,
  action: string,
  role?: string | null
): boolean {
  if (role === "leader") return true;
  return !!perms?.[resource]?.[action];
}
