// ==========================================
// Supabase Edge Function: MCP Server v3.4
// ~55 أداة تغطي كل وظائف المنصة للأدمن + OAuth 2.1
// + Rate Limiting ذري + سجل تدقيق + تحقق من المدخلات
// + الوقت 12 ساعة (ص/م) + الحضور أونلاين/اوفلاين + رابط الحصة
// + قاعدة النوعين (v3.4): نوع الحصة نوعين فقط محاضرة/سكشن
//   ونوع الحضور نوعين فقط في الكلية/أونلاين —
//   في الكلية ← المكان (room) إلزامي، أونلاين ← اللينك (link) اختياري
//
// النشر: ./scripts/deploy-edge.sh
// ==========================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key, mcp-session-id, accept, mcp-protocol-version",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Expose-Headers": "mcp-session-id, www-authenticate",
};

// ==========================================
// Schema helpers
// ==========================================
const objectSchema = (properties: Record<string, unknown>, required: string[] = []): Record<string, unknown> => ({
  type: "object",
  properties,
  ...(required.length ? { required } : {}),
});

type Tool = { name: string; description: string; inputSchema: Record<string, unknown> };

const strEnum = (values: string[]) => ({ type: "string", enum: values });

// ─── أوصاف موحدة لأدوات الجدول (قاعدة النوعين + الوقت 12 ساعة + اللينك) ───
// v3.4: نوعين بس للمادة (محاضرة/سكشن) ونوعين بس للحضور (في الكلية/أونلاين)
const SCHED_TYPE_DESC = {
  type: "string",
  enum: ["محاضرة", "سكشن", "lecture", "section"],
  description: "نوع الحصة — نوعين فقط: محاضرة (lecture) أو سكشن (section/سكاشن). ممنوع أي نوع آخر (لا معمل ولا امتحان ولا غيرهم).",
};
const SCHED_MODE_DESC = {
  type: "string",
  enum: ["في الكلية", "أونلاين", "offline", "online"],
  description: "نوع الحضور — نوعين فقط: في الكلية (اوفلاين/حضوري) أو أونلاين (online). ممنوع أي نوع آخر (لا مختلط ولا غيرهما).",
};
const TIME_DESC = "وقت بنظام 12 ساعة مثل 2:30 م أو 10:00 ص (أو 24 ساعة مثل 14:30) — التحويل تلقائي";
const LINK_DESC = "رابط الحصة الأونلاين (Zoom/Meet) يبدأ بـ https:// — للحصص الأونلاين فقط واختياري (لو موجود)";
const ROOM_DESC = "المكان في الكلية (إلزامي للحصص الحضورية) مثل: قاعة 101 أو مبنى B";
const RULE_DESC = "القاعدة: في الكلية ← المكان (room) إلزامي · أونلاين ← اللينك (link) اختياري لو موجود.";

// ==========================================
// الأدوات (~55) — كل وظائف المنصة للأدمن
// ==========================================
const TOOLS: Tool[] = [
  // ─── لوحة التحكم والبحث ───
  { name: "get_dashboard_stats", description: "إحصائيات شاملة للمنصة: عدد الإعلانات والمهام والاستفسارات والروابط والأعضاء والتسليمات.", inputSchema: objectSchema({}) },
  { name: "search_platform", description: "بحث شامل في كل محتوى المنصة (إعلانات، مهام، استفسارات، مواد، روابط، مواعيد).", inputSchema: objectSchema({ query: { type: "string", description: "كلمة البحث" }, limit: { type: "integer", default: 25 } }, ["query"]) },
  { name: "get_batch_context", description: "سياق شامل عن حالة الدفعة: آخر الإعلانات، المهام النشطة، الروابط الأكاديمية، ومواعيد هذا الأسبوع. استخدمها قبل توليد الردود.", inputSchema: objectSchema({}) },

  // ─── الإعلانات ───
  { name: "list_announcements", description: "عرض الإعلانات (الأحدث أولاً، المثبت في الأعلى).", inputSchema: objectSchema({ limit: { type: "integer", default: 50 }, pinned_only: { type: "boolean", default: false } }) },
  { name: "get_announcement", description: "جلب إعلان واحد بالمعرف.", inputSchema: objectSchema({ id: { type: "string" } }, ["id"]) },
  { name: "create_announcement", description: "نشر إعلان جديد للطلاب — يظهر فوراً في واجهة الطلاب.", inputSchema: objectSchema({ title: { type: "string" }, content: { type: "string" }, category: strEnum(["عاجل", "أكاديمي", "هام", "عام"]), is_pinned: { type: "boolean", default: false } }, ["title", "content"]) },
  { name: "update_announcement", description: "تعديل إعلان موجود.", inputSchema: objectSchema({ announcement_id: { type: "string" }, title: { type: "string" }, content: { type: "string" }, category: strEnum(["عاجل", "أكاديمي", "هام", "عام"]), is_pinned: { type: "boolean" } }, ["announcement_id"]) },
  { name: "delete_announcement", description: "حذف إعلان نهائياً.", inputSchema: objectSchema({ announcement_id: { type: "string" } }, ["announcement_id"]) },

  // ─── التكليفات ───
  { name: "list_tasks", description: "عرض التكليفات مرتبة بموعد التسليم.", inputSchema: objectSchema({ status: strEnum(["active", "completed", "archived", "all"]), limit: { type: "integer", default: 100 } }) },
  { name: "get_task", description: "جلب تكليف واحد.", inputSchema: objectSchema({ id: { type: "string" } }, ["id"]) },
  { name: "create_task", description: "إنشاء تكليف دراسي بموعد تسليم.", inputSchema: objectSchema({ subject: { type: "string" }, title: { type: "string" }, description: { type: "string" }, deadline: { type: "string", description: "ISO 8601 مثل 2026-10-01T23:59:00Z" }, status: strEnum(["active", "completed", "archived"]) }, ["subject", "title", "deadline"]) },
  { name: "create_academic_task", description: "بديل لـ create_task بنفس الوظيفة (توافق مع الإصدارات السابقة).", inputSchema: objectSchema({ subject: { type: "string" }, title: { type: "string" }, description: { type: "string" }, deadline: { type: "string" } }, ["subject", "title", "deadline"]) },
  { name: "update_task", description: "تعديل تكليف (العنوان/الموعد/الحالة...).", inputSchema: objectSchema({ task_id: { type: "string" }, subject: { type: "string" }, title: { type: "string" }, description: { type: "string" }, deadline: { type: "string" }, status: strEnum(["active", "completed", "archived"]) }, ["task_id"]) },
  { name: "delete_task", description: "حذف تكليف نهائياً.", inputSchema: objectSchema({ task_id: { type: "string" } }, ["task_id"]) },

  // ─── المواد ───
  { name: "list_subjects", description: "عرض كل المواد الدراسية.", inputSchema: objectSchema({}) },
  { name: "create_subject", description: "إضافة مادة جديدة.", inputSchema: objectSchema({ name: { type: "string" }, code: { type: "string" }, instructor: { type: "string" }, color: { type: "string", description: "hex مثل #3b82f6" }, icon: { type: "string" }, semester: { type: "string" } }, ["name"]) },
  { name: "update_subject", description: "تعديل مادة.", inputSchema: objectSchema({ subject_id: { type: "string" }, name: { type: "string" }, code: { type: "string" }, instructor: { type: "string" }, color: { type: "string" } }, ["subject_id"]) },
  { name: "delete_subject", description: "حذف مادة (تحذير: يحذف جلساتها المجدولة).", inputSchema: objectSchema({ subject_id: { type: "string" } }, ["subject_id"]) },

  // ─── الجدول الأسبوعي (المجموعات + النوع محاضرة/سكشن + الحضور أونلاين/اوفلاين + القاعة واللينك) ───
  // القاعدة الزمنية الموحدة: المستخدم يكتب ويرى الوقت بنظام 12 ساعة (مثل "2:30 م") والتحويل تلقائي.
  { name: "list_schedule", description: "عرض الجدول الأسبوعي مع المواد — فلترة بالنوع (محاضرة/سكشن) وبنوع الحضور (في الكلية/أونلاين). كل جلسة تشمل time_display بنظام 12 ساعة (مثل 2:30 م) وتسميات عربية.", inputSchema: objectSchema({ day_of_week: { type: "integer", description: "0=الأحد .. 6=السبت" }, group: strEnum(["أ", "ب", "ج", "د", "all"]), type: SCHED_TYPE_DESC, lecture_type: SCHED_MODE_DESC, active_only: { type: "boolean", default: true } }) },
  { name: "create_schedule_session", description: `إضافة جلسة للجدول — نوعين فقط: محاضرة أو سكشن + حضور نوعين فقط: في الكلية أو أونلاين. ${RULE_DESC} الوقت بنظام 12 ساعة.`, inputSchema: objectSchema({ subject_id: { type: "string" }, day_of_week: { type: "integer" }, start_time: { type: "string", description: TIME_DESC }, end_time: { type: "string", description: TIME_DESC }, room: { type: "string", description: ROOM_DESC }, link: { type: "string", description: LINK_DESC }, type: SCHED_TYPE_DESC, group: strEnum(["أ", "ب", "ج", "د", "all"]), lecture_type: SCHED_MODE_DESC, notes: { type: "string" } }, ["subject_id", "day_of_week", "start_time", "end_time"]) },
  { name: "update_schedule_session", description: `تعديل جلسة جدول — نفس قواعد الإضافة (نوعين: محاضرة/سكشن · حضور: في الكلية/أونلاين · ${RULE_DESC}) + إلغاء التفعيل.`, inputSchema: objectSchema({ schedule_id: { type: "string" }, subject_id: { type: "string" }, day_of_week: { type: "integer" }, start_time: { type: "string", description: TIME_DESC }, end_time: { type: "string", description: TIME_DESC }, room: { type: "string", description: ROOM_DESC }, link: { type: "string", description: LINK_DESC }, type: SCHED_TYPE_DESC, group: strEnum(["أ", "ب", "ج", "د", "all"]), lecture_type: SCHED_MODE_DESC, notes: { type: "string" }, is_active: { type: "boolean" } }, ["schedule_id"]) },
  { name: "delete_schedule_session", description: "حذف جلسة من الجدول.", inputSchema: objectSchema({ schedule_id: { type: "string" } }, ["schedule_id"]) },
  { name: "get_week_schedule", description: "عرض الجدول الأسبوعي كاملاً — الأيام بالترتيب والحصص مرتبة حسب الوقت داخل كل يوم، والأوقات معروضة بنظام 12 ساعة (مثل 2:30 م).", inputSchema: objectSchema({ group: strEnum(["أ", "ب", "ج", "د", "all"]) }) },
  { name: "upsert_subject_by_name", description: "إضافة مادة جديدة بالاسم مباشرة (بدون UUID) — لو فيه مادة بنفس الاسم يرجعها كما هي بدون تكرار.", inputSchema: objectSchema({ name: { type: "string" }, code: { type: "string" }, instructor: { type: "string" }, color: { type: "string", description: "hex مثل #3b82f6" }, icon: { type: "string" }, semester: { type: "string" }, credits: { type: "integer" } }, ["name"]) },
  { name: "set_schedule_session", description: `إضافة جلسة للجدول بالاسم مباشرة — لو المادة غير موجودة يتم إنشاؤها تلقائياً (لا حاجة لمعرفة subject_id). نوعين فقط: محاضرة/سكشن وحضور: في الكلية/أونلاين. ${RULE_DESC} مثال: محاضرة قواعد بيانات يوم الإثنين 2:30 م في قاعة 101 — أو سكشن أونلاين مع لينك Zoom.`, inputSchema: objectSchema({ subject_name: { type: "string" }, subject_id: { type: "string" }, day_of_week: { type: "integer", description: "0=الأحد .. 6=السبت" }, start_time: { type: "string", description: TIME_DESC }, end_time: { type: "string", description: TIME_DESC }, room: { type: "string", description: ROOM_DESC }, link: { type: "string", description: LINK_DESC }, type: SCHED_TYPE_DESC, group: strEnum(["أ", "ب", "ج", "د", "all"]), lecture_type: SCHED_MODE_DESC, notes: { type: "string" } }, ["day_of_week", "start_time", "end_time"]) },

  // ─── المواعيد المهمة ───
  { name: "list_important_dates", description: "عرض المواعيد المهمة (امتحانات، تسليمات، إجازات).", inputSchema: objectSchema({ type: strEnum(["exam", "deadline", "holiday", "event", "registration"]), upcoming_only: { type: "boolean", default: false }, limit: { type: "integer", default: 50 } }) },
  { name: "create_important_date", description: "إضافة موعد مهم.", inputSchema: objectSchema({ title: { type: "string" }, description: { type: "string" }, date: { type: "string", description: "ISO 8601" }, type: strEnum(["exam", "deadline", "holiday", "event", "registration"]), subject_id: { type: "string" }, is_pinned: { type: "boolean" } }, ["title", "date"]) },
  { name: "update_important_date", description: "تعديل موعد مهم.", inputSchema: objectSchema({ date_id: { type: "string" }, title: { type: "string" }, description: { type: "string" }, date: { type: "string" }, type: strEnum(["exam", "deadline", "holiday", "event", "registration"]), is_pinned: { type: "boolean" } }, ["date_id"]) },
  { name: "delete_important_date", description: "حذف موعد مهم.", inputSchema: objectSchema({ date_id: { type: "string" } }, ["date_id"]) },

  // ─── الروابط السريعة / روابط المحاضرات ───
  { name: "list_quick_links", description: "عرض كل الروابط السريعة وروابط المحاضرات (مرتبة).", inputSchema: objectSchema({}) },
  { name: "create_quick_link", description: "إضافة رابط (محاضرة أونلاين، جروب، منصة، أي رابط يظهر للطلاب).", inputSchema: objectSchema({ title: { type: "string" }, url: { type: "string", description: "يجب أن يبدأ بـ http:// أو https://" }, type: { type: "string", description: "مثل: lecture, group, platform" }, category: { type: "string" }, order_index: { type: "integer", description: "ترتيب الظهور" } }, ["title", "url"]) },
  { name: "update_quick_link", description: "تعديل رابط موجود.", inputSchema: objectSchema({ link_id: { type: "string" }, title: { type: "string" }, url: { type: "string" }, type: { type: "string" }, category: { type: "string" }, order_index: { type: "integer" } }, ["link_id"]) },
  { name: "delete_quick_link", description: "حذف رابط.", inputSchema: objectSchema({ link_id: { type: "string" } }, ["link_id"]) },

  // ─── الاستفسارات ───
  { name: "list_inquiries", description: "عرض استفسارات الطلاب (يشمل رقم الواتساب والرد المقترح).", inputSchema: objectSchema({ status: strEnum(["new", "in_progress", "resolved", "archived", "all"]), limit: { type: "integer", default: 100 } }) },
  { name: "get_pending_inquiries", description: "استرجاع الاستفسارات المعلقة الجديدة (اختصار شائع لـ ChatGPT).", inputSchema: objectSchema({ status: strEnum(["new", "in_progress", "resolved", "archived", "all"]), limit: { type: "integer", default: 50 } }) },
  { name: "get_inquiry", description: "جلب استفسار واحد بالتفصيل.", inputSchema: objectSchema({ inquiry_id: { type: "string" } }, ["inquiry_id"]) },
  { name: "update_inquiry", description: "تعديل استفسار (الحالة/الرد/التصنيف).", inputSchema: objectSchema({ inquiry_id: { type: "string" }, status: strEnum(["new", "in_progress", "resolved", "archived"]), ai_suggestion: { type: "string" }, category: { type: "string" } }, ["inquiry_id"]) },
  { name: "suggest_inquiry_reply", description: "حفظ رد مقترح من الذكاء الاصطناعي على استفسار طالب وتحديث حالته.", inputSchema: objectSchema({ inquiry_id: { type: "string" }, reply_text: { type: "string" }, new_status: strEnum(["in_progress", "resolved"]) }, ["inquiry_id", "reply_text"]) },
  { name: "resolve_inquiry", description: "إغلاق استفسار كمحلول بعد حل مشكلة الطالب.", inputSchema: objectSchema({ inquiry_id: { type: "string" }, resolution_note: { type: "string" } }, ["inquiry_id"]) },
  { name: "delete_inquiry", description: "حذف استفسار نهائياً.", inputSchema: objectSchema({ inquiry_id: { type: "string" } }, ["inquiry_id"]) },
  { name: "get_inquiry_stats", description: "إحصائيات الاستفسارات (الإجمالي/الجديد/قيد المعالجة/المحلول).", inputSchema: objectSchema({}) },

  // ─── التسليمات ───
  { name: "list_submissions", description: "عرض تسليمات الطلاب مع بيانات التكليف.", inputSchema: objectSchema({ task_id: { type: "string" }, status: strEnum(["pending", "reviewed", "accepted", "rejected", "all"]), limit: { type: "integer", default: 100 } }) },
  { name: "update_submission", description: "مراجعة تسليم: تحديث الحالة/الدرجة/الملاحظات.", inputSchema: objectSchema({ submission_id: { type: "string" }, status: strEnum(["pending", "reviewed", "accepted", "rejected"]), grade: { type: "string" }, feedback: { type: "string" } }, ["submission_id"]) },
  { name: "delete_submission", description: "حذف تسليم.", inputSchema: objectSchema({ submission_id: { type: "string" } }, ["submission_id"]) },

  // ─── الحضور ───
  { name: "list_attendance", description: "عرض سجلات الحضور مع المواد.", inputSchema: objectSchema({ subject_id: { type: "string" }, limit: { type: "integer", default: 100 } }) },
  { name: "upsert_attendance", description: "تسجيل أو تحديث حضور جلسة.", inputSchema: objectSchema({ subject_id: { type: "string" }, session_date: { type: "string", description: "YYYY-MM-DD" }, total_students: { type: "integer" }, present_count: { type: "integer" }, absent_count: { type: "integer" }, notes: { type: "string" } }, ["subject_id", "session_date"]) },
  { name: "delete_attendance", description: "حذف سجل حضور.", inputSchema: objectSchema({ attendance_id: { type: "string" } }, ["attendance_id"]) },

  // ─── الإعدادات ───
  { name: "list_settings", description: "عرض إعدادات المنصة (settings و/أو app_settings).", inputSchema: objectSchema({ source: strEnum(["settings", "app_settings", "both"]) }) },
  { name: "set_setting", description: "إنشاء/تحديث إعداد (key/value).", inputSchema: objectSchema({ source: strEnum(["settings", "app_settings"]), key: { type: "string" }, value: { description: "أي قيمة JSON" } }, ["key", "value"]) },
  { name: "delete_setting", description: "حذف إعداد.", inputSchema: objectSchema({ source: strEnum(["settings", "app_settings"]), key: { type: "string" } }, ["key"]) },

  // ─── سجل الإشعارات ───
  { name: "list_notification_logs", description: "عرض سجل الإشعارات المرسلة.", inputSchema: objectSchema({ limit: { type: "integer", default: 100 } }) },
  { name: "create_notification_log", description: "تسجيل إشعار في السجل.", inputSchema: objectSchema({ title: { type: "string" }, body: { type: "string" }, type: strEnum(["info", "warning", "success", "error"]) }, ["title"]) },
  { name: "delete_notification_log", description: "حذف سجل إشعار.", inputSchema: objectSchema({ notification_id: { type: "string" } }, ["notification_id"]) },

  // ─── فريق الإدارة ───
  { name: "list_team_members", description: "عرض أعضاء فريق الإدارة وأدوارهم وأذوناتهم.", inputSchema: objectSchema({}) },
  { name: "create_team_member", description: "ربط حساب مشرف موجود بجدول team_members (user_id من auth).", inputSchema: objectSchema({ user_id: { type: "string" }, name: { type: "string" }, role: strEnum(["leader", "assistant"]), permissions: { type: "object" } }, ["user_id", "name"]) },
  { name: "update_team_member", description: "تعديل عضو فريق (الاسم/الدور/الأذونات).", inputSchema: objectSchema({ team_member_id: { type: "string" }, name: { type: "string" }, role: strEnum(["leader", "assistant"]), permissions: { type: "object" } }, ["team_member_id"]) },
  { name: "delete_team_member", description: "إزالة عضو من الفريق (لا يحذف حسابه في auth).", inputSchema: objectSchema({ team_member_id: { type: "string" } }, ["team_member_id"]) },

  // ─── مفاتيح API ───
  { name: "list_api_keys", description: "عرض مفاتيح API (معاينة فقط دون القيمة الكاملة).", inputSchema: objectSchema({}) },
  { name: "create_api_key", description: "توليد مفتاح API جديد للربط مع ChatGPT/Claude. المفتاح الكامل يظهر مرة واحدة فقط.", inputSchema: objectSchema({ name: { type: "string", description: "اسم وصفي مثل: مفتاح ChatGPT الرئيسي" } }, ["name"]) },
  { name: "revoke_api_key", description: "إبطال مفتاح API (soft delete — يمكن تتبعه).", inputSchema: objectSchema({ key_id: { type: "string" } }, ["key_id"]) },
  { name: "delete_api_key", description: "حذف مفتاح API نهائياً من قاعدة البيانات.", inputSchema: objectSchema({ key_id: { type: "string" } }, ["key_id"]) },

  // ─── اشتراكات الإشعارات ───
  { name: "list_push_subscriptions", description: "عرض اشتراكات إشعارات الطلاب (endpoints فقط).", inputSchema: objectSchema({ limit: { type: "integer", default: 200 } }) },
  { name: "delete_push_subscription", description: "حذف اشتراك إشعارات.", inputSchema: objectSchema({ subscription_id: { type: "string" } }, ["subscription_id"]) },
];

// ==========================================
// Helper functions
// ==========================================
const table = (supabase: any, name: string) => supabase.from(name);

async function rowResult(promise: any) {
  const { data, error } = await promise;
  if (error) throw error;
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

function stripUndefined(value: Record<string, any>, excluded: string[] = []) {
  const out: Record<string, any> = {};
  for (const [key, val] of Object.entries(value || {})) {
    if (val === undefined || val === null || excluded.includes(key)) continue;
    out[key] = val;
  }
  return out;
}

// --- تنظيف المدخلات: حد أقصى لطول أي نص + إزالة الفراغات الزائدة ---
const MAX_TEXT_LEN = 10000;

function sanitizeDeep(value: any, depth = 0): any {
  if (depth > 5) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > MAX_TEXT_LEN ? trimmed.slice(0, MAX_TEXT_LEN) : trimmed;
  }
  if (Array.isArray(value)) return value.slice(0, 100).map((v) => sanitizeDeep(v, depth + 1));
  if (value && typeof value === "object") {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value).slice(0, 50)) {
      out[k.slice(0, 100)] = sanitizeDeep(v, depth + 1);
    }
    return out;
  }
  return value;
}

function requireStr(args: any, key: string, maxLen = 500): string {
  const val = args?.[key];
  if (typeof val !== "string" || !val.trim()) {
    throw new Error(`الحقل "${key}" مطلوب`);
  }
  const v = val.trim();
  if (v.length > maxLen) throw new Error(`الحقل "${key}" تجاوز الطول الأقصى (${maxLen})`);
  return v;
}

function requireUrl(args: any, key = "url"): string {
  const v = requireStr(args, key, 1000);
  if (!/^https?:\/\/.+/i.test(v)) {
    throw new Error(`الحقل "${key}" يجب أن يكون رابطاً صالحاً يبدأ بـ http:// أو https://`);
  }
  return v;
}

function requireDate(args: any, key: string): Date {
  const raw = requireStr(args, key, 50);
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`صيغة "${key}" غير صالحة. استخدم ISO 8601 مثل: 2026-10-01T23:59:00Z`);
  }
  return d;
}

// ==========================================
// توحيد الوقت 12 ساعة + نوع الحصة + نوع الحضور + رابط الحصة
// (v3.3 — القاعدة: المستخدم يرى 12 ساعة ص/م، القاعدة تخزن HH:MM بنظام 24)
// ==========================================

/** عرض وقت HH:MM بنظام 12 ساعة عربي: "14:30" → "2:30 م" */
function to12hArabic(t?: string | null): string {
  if (!t) return "—";
  const m = String(t).trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return String(t);
  let h = parseInt(m[1], 10);
  const min = m[2];
  if (Number.isNaN(h) || h < 0 || h > 23) return String(t);
  const suffix = h < 12 ? "ص" : "م";
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${min} ${suffix}`;
}

/**
 * قبول الوقت بأي صيغة (12 أو 24 ساعة، عربي أو إنجليزي) وتوحيده إلى "HH:MM" بنظام 24 للتخزين.
 * أمثلة مقبولة: "14:30" ، "2:30 م" ، "2:30 PM" ، "10:00 صباحاً" ، "9 ص" ، "2:30:00 مساءً"
 */
function normalizeTimeInput(v: unknown, field: string, required = true): string | undefined {
  if (v === undefined || v === null || String(v).trim() === "") {
    if (required) throw new Error(`الحقل "${field}" مطلوب بصيغة وقت — مثال: 2:30 م أو 14:30`);
    return undefined;
  }
  const raw = String(v).trim();
  // رفض التواريخ والمجاميع الطويلة بالخطأ
  if (/[-/]/.test(raw) || raw.length > 16) {
    throw new Error(`صيغة "${field}" غير مفهومة: "${raw}" — استخدم 12 ساعة مثل "2:30 م" أو 24 ساعة مثل "14:30"`);
  }
  // إزالة كلمات شائعة قد يضيفها الموديل قبل الوقت
  const cleaned = raw
    .replace(/(ال)?ساع[ةه]/g, " ")
    .replace(/^(من|إلى|الى|بين)\s+/g, "")
    .trim();
  // استخراج الساعة والدقائق (اختيارية) + كاشف ص/م (عربي أو AM/PM)
  const m = cleaned.match(/^(\d{1,2})(?:[:٫.](\d{1,2}))?(?::(\d{1,2}))?\s*(صباحا|ص|ظهرا|ظهر|نهار|مساء|م|am|pm|a\.m|p\.m)?\.?/i);
  if (!m) {
    throw new Error(`صيغة "${field}" غير مفهومة: "${raw}" — استخدم 12 ساعة مثل "2:30 م" أو 24 ساعة مثل "14:30"`);
  }
  let h = parseInt(m[1], 10);
  const min = String(m[2] ?? "0").padStart(2, "0");
  const marker = (m[4] || "").toLowerCase().replace(/[.ً]/g, "");
  const isPm = /^(م|مساء|pm)$/.test(marker);
  const isAm = /^(ص|صباحا|am)$/.test(marker);
  const isNoon = /^(ظ|ظهرا|ظهر|نهار)$/.test(marker); // الظهر/النهار: 12 تبقى 12 وما قبلها كما هي
  if (h < 0 || h > 23 || Number(min) > 59) {
    throw new Error(`وقت غير صالح في "${field}": "${raw}"`);
  }
  if (isPm && h >= 1 && h <= 11) h += 12;          // 2:30 م → 14:30
  else if (isAm && h === 12) h = 0;                // 12:30 ص → 00:30
  // ظهراً/نهار: 12:30 ظهراً → 12:30 (الظهر نفسه) و10 نهاراً تبقى 10:00
  if (h > 23) throw new Error(`وقت غير صالح في "${field}": "${raw}"`);
  return `${String(h).padStart(2, "0")}:${min}`;
}

/**
 * توحيد نوع الحصة — نوعين فقط (v3.4): محاضرة (lecture) أو سكشن (tutorial/section).
 * أي قيمة أخرى (معمل/امتحان/أي/غيرهم) مرفوضة — القيم القديمة الموجودة مسبقاً في القاعدة تبقى معروضة كما هي.
 */
function normalizeScheduleType(v: unknown): string | undefined {
  if (v === undefined || v === null || String(v).trim() === "") return undefined;
  const s = String(v).trim().toLowerCase().replace(/[ً.:\s]/g, "");
  const lecture = ["lecture", "محاضره", "محاضرة", "محاضرات", "محاضره", "lec"];
  const section = ["tutorial", "section", "سكشن", "سكسن", "سكاشن", "سكشنه", "sec"];
  if (lecture.includes(s)) return "lecture";
  if (section.includes(s)) return "tutorial";
  throw new Error(`نوع الحصة نوعين فقط: محاضرة (lecture) أو سكشن (section) — القيمة "${v}" غير مسموحة (لا معمل ولا امتحان ولا أي)`);
}

/**
 * توحيد نوع الحضور — نوعين فقط (v3.4): في الكلية (university) أو أونلاين (online).
 * أي قيمة أخرى (مختلط/hybrid/غيرهما) مرفوضة — القيم القديمة الموجودة مسبقاً تبقى معروضة كما هي.
 */
function normalizeLectureType(v: unknown): string | undefined {
  if (v === undefined || v === null || String(v).trim() === "") return undefined;
  const s = String(v).trim().toLowerCase().replace(/[ً.\s]/g, "").replace(/[أإآ]/g, "ا");
  const offline = ["university", "offline", "اوفلاين", "جامعه", "جامعة", "حضوري", "فيالكليه", "فيالكلية", "الكلية", "كليه", "oncampus", "campus", "college"];
  const online = ["online", "اونلاين", "عبرالانترنت", "عبرانترنت", "remote"];
  if (offline.includes(s)) return "university";
  if (online.includes(s)) return "online";
  throw new Error(`نوع الحضور نوعين فقط: "في الكلية" (اوفلاين) أو "أونلاين" (online) — القيمة "${v}" غير مسموحة (لا مختلط)`);
}

/**
 * قاعدة النوعين (v3.4):
 * - الحصة في الكلية (اوفلاين): المكان (room) إلزامي — لو فاقد نرفض مع رسالة واضحة للـ AI.
 * - الحصة أونلاين: اللينك (link) اختياري — لو موجود يتحقق أنه رابط صالح في normalizeScheduleFields.
 * تُستدعى على الصف النهائي (المدموج مع القيم الحالية في حالة التعديل).
 */
function validateSchedulePresenceRule(row: Record<string, any>) {
  const mode = String(row.lecture_type || "university");
  if (mode === "online") return; // أونلاين: اللينك اختياري (لو موجود)
  const place = String(row.room || "").trim() || String(row.location || "").trim();
  if (!place) {
    throw new Error('الحصة "في الكلية" — لازم إدخال المكان في room (مثال: قاعة 101 أو مبنى B). لو الحصة أونلاين حدد lecture_type = "أونلاين".');
  }
}

/** تطبيق كل توحيدات الجدول على صف قبل الإدخال/التعديل + التحقق من رابط الحصة.
 *  requireTimes=true في مسارات الإنشاء (start/end إلزاميان)، false في التعديل الجزئي. */
function normalizeScheduleFields(row: Record<string, any>, opts: { requireTimes?: boolean } = {}): Record<string, any> {
  const requireTimes = opts.requireTimes ?? false;
  const out = { ...row };
  if (out.start_time !== undefined) out.start_time = normalizeTimeInput(out.start_time, "start_time");
  else if (requireTimes) throw new Error('الحقل "start_time" مطلوب بصيغة وقت — مثال: 2:30 م أو 14:30');
  if (out.end_time !== undefined) out.end_time = normalizeTimeInput(out.end_time, "end_time");
  else if (requireTimes) throw new Error('الحقل "end_time" مطلوب بصيغة وقت — مثال: 2:30 م أو 14:30');
  if (out.type !== undefined) out.type = normalizeScheduleType(out.type);
  if (out.lecture_type !== undefined) out.lecture_type = normalizeLectureType(out.lecture_type);
  if (out.link !== undefined && out.link !== null && String(out.link).trim() !== "") {
    const l = String(out.link).trim();
    if (!/^https?:\/\/.+/i.test(l)) {
      throw new Error("link يجب أن يكون رابطاً صالحاً يبدأ بـ http:// أو https:// (رابط Zoom/Meet للحصة الأونلاين)");
    }
    out.link = l;
  } else if (out.link !== undefined) {
    out.link = null; // نص فارغ → null
  }
  // لو المستخدم أدخل وقتاً 12 ساعة في room/location بالخطأ لا نلمسه — حقل حر.
  return out;
}

/** إثراء صف جدول للعرض: time_display بنظام 12 ساعة + تسميات عربية للنوع والحضور. */
function annotateScheduleRow(s: any): any {
  if (!s || typeof s !== "object") return s;
  const typeAr: Record<string, string> = { lecture: "محاضرة", tutorial: "سكشن", lab: "معمل", exam: "امتحان", other: "حصة" };
  const modeAr: Record<string, string> = { university: "في الكلية", online: "أونلاين", hybrid: "مختلط" };
  return {
    ...s,
    time_display: `${to12hArabic(s.start_time)} - ${to12hArabic(s.end_time)}`,
    type_ar: typeAr[String(s.type || "").toLowerCase()] || String(s.type || "حصة"),
    mode_ar: modeAr[String(s.lecture_type || "").toLowerCase()] || String(s.lecture_type || ""),
  };
}

function jsonResponse(body: any, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...extraHeaders },
  });
}

function getBaseUrl(req: Request): string {
  const url = new URL(req.url);
  const proto = req.headers.get("x-forwarded-proto") || "https";
  return `${proto}://${url.host}`;
}

function getClientIp(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

function generateApiKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `bmp_key_${hex}`;
}

// ==========================================
// المصادقة
// ==========================================
async function verifyAuth(req: Request, supabase: any): Promise<{ authorized: boolean; keyId?: string; keyName?: string; viaSecret?: boolean }> {
  const authHeader = req.headers.get("Authorization");
  const apiKeyHeader = req.headers.get("x-api-key");
  let token = "";
  if (authHeader && authHeader.startsWith("Bearer ")) token = authHeader.substring(7).trim();
  else if (apiKeyHeader) token = apiKeyHeader.trim();
  if (!token) return { authorized: false };

  // 1. التوكن السري (للاختبار المباشر)
  const secretToken = Deno.env.get("MCP_SECRET_TOKEN");
  if (secretToken && token === secretToken) {
    return { authorized: true, keyName: "MCP Secret Token", viaSecret: true };
  }

  // 2. مفاتيح API من قاعدة البيانات (مع فحص الإبطال)
  try {
    const { data, error } = await supabase
      .from("api_keys")
      .select("id, name, revoked_at")
      .eq("key_value", token)
      .is("revoked_at", null)
      .single();
    if (error || !data) return { authorized: false };

    // تحديث آخر استخدام (best-effort، لا يعطل الطلب)
    supabase
      .from("api_keys")
      .update({ last_used_at: new Date().toISOString(), last_used_ip: getClientIp(req) })
      .eq("id", data.id)
      .then(() => {}, () => {});

    return { authorized: true, keyId: data.id, keyName: data.name };
  } catch {
    return { authorized: false };
  }
}

async function verifyApiKey(supabase: any, apiKey: string) {
  if (!apiKey) return { valid: false };
  const secretToken = Deno.env.get("MCP_SECRET_TOKEN");
  if (secretToken && apiKey === secretToken) return { valid: true, name: "MCP Secret Token" };
  try {
    const { data, error } = await supabase
      .from("api_keys")
      .select("id, name")
      .eq("key_value", apiKey)
      .is("revoked_at", null)
      .single();
    if (!error && data) {
      supabase
        .from("api_keys")
        .update({ last_used_at: new Date().toISOString() })
        .eq("id", data.id)
        .then(() => {}, () => {});
      return { valid: true, keyId: data.id, name: data.name };
    }
  } catch {}
  return { valid: false };
}

// ==========================================
// Rate Limiting (ذري عبر قاعدة البيانات — fail-open)
// ==========================================
async function checkMcpRateLimit(supabase: any, keyIdentifier: string): Promise<{ allowed: boolean; retryAfter: number }> {
  const perMinute = Number(Deno.env.get("MCP_RATE_LIMIT_PER_MIN") || 120);
  try {
    const { data, error } = await supabase.rpc("rate_limit_hit", {
      p_key: `mcp:${keyIdentifier}`,
      p_window_seconds: 60,
      p_max: perMinute,
    });
    if (error) return { allowed: true, retryAfter: 0 }; // fail-open
    const result = Array.isArray(data) ? data[0] : data;
    return {
      allowed: result?.allowed !== false,
      retryAfter: Number(result?.retry_after || 0),
    };
  } catch {
    return { allowed: true, retryAfter: 0 }; // fail-open
  }
}

// ==========================================
// سجل التدقيق (best-effort — لا يعطل الطلب أبداً)
// ==========================================
async function auditLog(
  supabase: any,
  entry: {
    keyId?: string | null;
    keyName?: string | null;
    tool: string;
    args?: any;
    success: boolean;
    errorMessage?: string | null;
    durationMs: number;
    clientIp: string;
  }
) {
  try {
    let argsSummary: string | null = null;
    if (entry.args !== undefined) {
      try {
        argsSummary = JSON.stringify(entry.args).slice(0, 500);
      } catch {
        argsSummary = "[unserializable]";
      }
    }
    await supabase.from("mcp_audit_log").insert({
      key_id: entry.keyId || null,
      key_name: entry.keyName || null,
      tool: entry.tool.slice(0, 100),
      args_summary: argsSummary,
      success: entry.success,
      error_message: entry.errorMessage?.slice(0, 500) || null,
      duration_ms: Math.min(entry.durationMs, 2147483647),
      client_ip: entry.clientIp,
    });
  } catch {
    // التدقيق لا يعطل الخدمة أبداً
  }
}

// ==========================================
// تنفيذ الأدوات (~55)
// ==========================================
async function executeTool(name: string, args: any, supabase: any) {
  args = sanitizeDeep(args);
  const limit = Math.min(Number(args?.limit || 100), 200);
  switch (name) {
    case "get_dashboard_stats": {
      const tables = ["announcements", "tasks", "inquiries", "quick_links", "team_members", "subjects", "schedules", "important_dates", "submissions", "attendance"];
      const counts: Record<string, number> = {};
      for (const t of tables) {
        const { count, error } = await table(supabase, t).select("*", { count: "exact", head: true });
        if (!error) counts[t] = count || 0;
      }
      const { data: activeTasks } = await table(supabase, "tasks").select("id").eq("status", "active");
      const { data: newInquiries } = await table(supabase, "inquiries").select("id").eq("status", "new");
      return { content: [{ type: "text", text: JSON.stringify({ generated_at: new Date().toISOString(), counts, active_tasks: activeTasks?.length || 0, new_inquiries: newInquiries?.length || 0 }, null, 2) }] };
    }
    case "search_platform": {
      const q = requireStr(args, "query", 100);
      const term = `%${q}%`;
      const [a, t, i, s, l, d] = await Promise.all([
        table(supabase, "announcements").select("*").or(`title.ilike.${term},content.ilike.${term}`).limit(limit),
        table(supabase, "tasks").select("*").or(`title.ilike.${term},subject.ilike.${term},description.ilike.${term}`).limit(limit),
        table(supabase, "inquiries").select("*").or(`full_name.ilike.${term},message.ilike.${term}`).limit(limit),
        table(supabase, "subjects").select("*").or(`name.ilike.${term},code.ilike.${term},instructor.ilike.${term}`).limit(limit),
        table(supabase, "quick_links").select("*").or(`title.ilike.${term},type.ilike.${term}`).limit(limit),
        table(supabase, "important_dates").select("*").or(`title.ilike.${term},description.ilike.${term}`).limit(limit),
      ]);
      return { content: [{ type: "text", text: JSON.stringify({ query: q, announcements: a.data || [], tasks: t.data || [], inquiries: i.data || [], subjects: s.data || [], links: l.data || [], dates: d.data || [] }, null, 2) }] };
    }
    case "get_batch_context": {
      const weekAhead = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const [announcementsRes, tasksRes, linksRes, datesRes] = await Promise.all([
        table(supabase, "announcements").select("*").order("is_pinned", { ascending: false }).order("created_at", { ascending: false }).limit(5),
        table(supabase, "tasks").select("*").eq("status", "active").order("deadline", { ascending: true }).limit(15),
        table(supabase, "quick_links").select("*").order("order_index", { ascending: true }),
        table(supabase, "important_dates").select("*, subjects(*)").gte("date", new Date().toISOString()).lte("date", weekAhead).order("date", { ascending: true }).limit(10),
      ]);
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            recent_announcements: announcementsRes.data || [],
            active_tasks: tasksRes.data || [],
            academic_links: linksRes.data || [],
            upcoming_dates: datesRes.data || [],
            generated_at: new Date().toISOString(),
          }, null, 2),
        }],
      };
    }

    // ─── Announcements ───
    case "list_announcements": {
      let q = table(supabase, "announcements").select("*").order("is_pinned", { ascending: false }).order("created_at", { ascending: false }).limit(limit);
      if (args?.pinned_only) q = q.eq("is_pinned", true);
      return rowResult(q);
    }
    case "get_announcement": return rowResult(table(supabase, "announcements").select("*").eq("id", args.id).single());
    case "create_announcement": {
      const payload = {
        title: requireStr(args, "title", 200),
        content: requireStr(args, "content", 10000),
        category: args.category || "عام",
        is_pinned: Boolean(args.is_pinned),
      };
      return rowResult(table(supabase, "announcements").insert([payload]).select().single());
    }
    case "update_announcement": { const { announcement_id, ...patch } = args || {}; return rowResult(table(supabase, "announcements").update(stripUndefined(patch)).eq("id", announcement_id).select().single()); }
    case "delete_announcement": return rowResult(table(supabase, "announcements").delete().eq("id", args.announcement_id).select().single());

    // ─── Tasks ───
    case "list_tasks": {
      let q = table(supabase, "tasks").select("*").order("deadline", { ascending: true }).limit(limit);
      if (args?.status && args.status !== "all") q = q.eq("status", args.status);
      return rowResult(q);
    }
    case "get_task": return rowResult(table(supabase, "tasks").select("*").eq("id", args.id).single());
    case "create_task":
    case "create_academic_task": {
      const deadline = requireDate(args, "deadline");
      const payload = {
        subject: requireStr(args, "subject", 100),
        title: requireStr(args, "title", 200),
        description: args.description ? String(args.description).slice(0, 5000) : null,
        deadline: deadline.toISOString(),
        status: args.status || "active",
      };
      return rowResult(table(supabase, "tasks").insert([payload]).select().single());
    }
    case "update_task": { const { task_id, ...patch } = args || {}; if (patch.deadline) { const d = new Date(patch.deadline); if (Number.isNaN(d.getTime())) throw new Error("deadline غير صالح"); patch.deadline = d.toISOString(); } return rowResult(table(supabase, "tasks").update(stripUndefined(patch)).eq("id", task_id).select().single()); }
    case "delete_task": return rowResult(table(supabase, "tasks").delete().eq("id", args.task_id).select().single());

    // ─── Subjects ───
    case "list_subjects": return rowResult(table(supabase, "subjects").select("*").order("name"));
    case "create_subject": return rowResult(table(supabase, "subjects").insert([stripUndefined(args)]).select().single());
    case "update_subject": { const { subject_id, ...patch } = args || {}; return rowResult(table(supabase, "subjects").update(stripUndefined(patch)).eq("id", subject_id).select().single()); }
    case "delete_subject": return rowResult(table(supabase, "subjects").delete().eq("id", args.subject_id).select().single());

    // ─── Schedule (توحيد الوقت 12 ساعة + النوع بالعربي + الحضور + اللينك) ───
    case "list_schedule": {
      let q = table(supabase, "schedules").select("*, subjects(*)").order("day_of_week").order("start_time").limit(limit);
      if (Number.isInteger(args?.day_of_week)) q = q.eq("day_of_week", args.day_of_week);
      if (args?.group) q = q.in('"group"', [args.group, "all"]);
      if (args?.type) q = q.eq("type", normalizeScheduleType(args.type));
      if (args?.lecture_type) q = q.eq("lecture_type", normalizeLectureType(args.lecture_type));
      if (args?.active_only !== false) q = q.eq("is_active", true);
      const { data, error } = await q;
      if (error) throw error;
      const rows = (data || []).map(annotateScheduleRow);
      return { content: [{ type: "text", text: JSON.stringify(rows, null, 2) }] };
    }
    case "create_schedule_session": {
      const payload = normalizeScheduleFields(stripUndefined(args), { requireTimes: true });
      // قاعدة النوعين: في الكلية ← المكان إلزامي، أونلاين ← اللينك اختياري
      validateSchedulePresenceRule(payload);
      return rowResult(table(supabase, "schedules").insert([payload]).select("*, subjects(*)").single());
    }
    case "update_schedule_session": {
      const { schedule_id, ...patch } = args || {};
      const clean = normalizeScheduleFields(stripUndefined(patch));
      // السماح بمسح اللينك بإرسال نص فارغ أو null (stripUndefined يسقط null فيجب التعامل الصريح)
      if (patch?.link !== undefined) clean.link = normalizeScheduleFields({ link: patch.link }).link ?? null;
      // قاعدة النوعين على الحالة النهائية المدموجة (التعديل الجزئي + القيم الموجودة)
      const cur = await table(supabase, "schedules").select("room, location, lecture_type").eq("id", schedule_id).maybeSingle();
      if (cur.error) throw cur.error;
      if (!cur.data) throw new Error(`لم يتم العثور على جلسة بالمعرف: ${schedule_id}`);
      validateSchedulePresenceRule({ ...cur.data, ...clean });
      return rowResult(table(supabase, "schedules").update(clean).eq("id", schedule_id).select("*, subjects(*)").single());
    }
    case "delete_schedule_session": return rowResult(table(supabase, "schedules").delete().eq("id", args.schedule_id).select().single());

    // ─── المواد والجدول بالاسم مباشرة (v3.3 — بدون الحاجة لـ UUID) ───
    case "get_week_schedule": {
      let q = table(supabase, "schedules")
        .select("*, subjects(name, color)")
        .eq("is_active", true)
        .order("day_of_week")
        .order("start_time");
      if (args?.group) q = q.in('"group"', [args.group, "all"]);
      const { data, error } = await q;
      if (error) throw error;
      const dayNames = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
      const byDay: Record<string, any[]> = {};
      for (const s of data || []) {
        const k = String(s.day_of_week);
        if (!byDay[k]) byDay[k] = [];
        byDay[k].push(s);
      }
      // ترتيب دفاعي إضافي: الحصص حسب وقت البداية داخل كل يوم
      Object.values(byDay).forEach((arr) =>
        arr.sort((a, b) => String(a.start_time || "").localeCompare(String(b.start_time || "")))
      );
      const summary = Object.keys(byDay).sort((a, b) => Number(a) - Number(b)).map((d) => ({
        day: dayNames[Number(d)],
        sessions_count: byDay[d].length,
        times: byDay[d].map((x: any) => `${to12hArabic(x.start_time)} - ${to12hArabic(x.end_time)}`),
      }));
      const schedule = (data || []).map(annotateScheduleRow);
      return { content: [{ type: "text", text: JSON.stringify({ total_sessions: (data || []).length, week_summary: summary, schedule }, null, 2) }] };
    }
    case "upsert_subject_by_name": {
      const name = requireStr(args, "name", 150);
      const found = await table(supabase, "subjects").select("*").ilike("name", name).limit(1).maybeSingle();
      if (found.error) throw found.error;
      if (found.data) {
        return { content: [{ type: "text", text: JSON.stringify({ ...found.data, _created: false, _message: "المادة موجودة بالفعل — لم يتم التكرار" }, null, 2) }] };
      }
      const { subject_name, ...rest } = args || {};
      const created = await table(supabase, "subjects").insert([stripUndefined({ ...rest, name })]).select().single();
      if (created.error) throw created.error;
      return { content: [{ type: "text", text: JSON.stringify({ ...created.data, _created: true, _message: "تم إنشاء المادة بنجاح" }, null, 2) }] };
    }
    case "set_schedule_session": {
      let subjectId: string | undefined = args?.subject_id;
      let subjectCreated = false;
      if (!subjectId) {
        const name = requireStr(args, "subject_name", 150);
        const found = await table(supabase, "subjects").select("*").ilike("name", name).limit(1).maybeSingle();
        if (found.error) throw found.error;
        if (found.data) {
          subjectId = found.data.id;
        } else {
          const created = await table(supabase, "subjects").insert([{ name }]).select().single();
          if (created.error) throw created.error;
          subjectId = created.data.id;
          subjectCreated = true;
        }
      }
      const { subject_name, subject_id, ...rest } = args || {};
      // توحيد كل الحقول: الوقت (12/24 ساعة) + النوع (محاضرة/سكشن فقط) + الحضور (في الكلية/أونلاين فقط) + اللينك
      const row = normalizeScheduleFields(stripUndefined({ ...rest, subject_id: subjectId }), { requireTimes: true });
      if (!Number.isInteger(row.day_of_week) || row.day_of_week < 0 || row.day_of_week > 6) {
        throw new Error("day_of_week مطلوب ويجب أن يكون بين 0 (الأحد) و 6 (السبت)");
      }
      // قاعدة النوعين: في الكلية ← المكان إلزامي، أونلاين ← اللينك اختياري
      validateSchedulePresenceRule(row);
      const result = await table(supabase, "schedules").insert([row]).select("*, subjects(*)").single();
      if (result.error) throw result.error;
      return { content: [{ type: "text", text: JSON.stringify({ ...result.data, _subject_auto_created: subjectCreated, _message: subjectCreated ? "تم إنشاء المادة وإضافة الجلسة للجدول" : "تمت إضافة الجلسة للجدول" }, null, 2) }] };
    }

    // ─── Important dates ───
    case "list_important_dates": {
      let q = table(supabase, "important_dates").select("*, subjects(*)").order("date").limit(limit);
      if (args?.type) q = q.eq("type", args.type);
      if (args?.upcoming_only) q = q.gte("date", new Date().toISOString());
      return rowResult(q);
    }
    case "create_important_date": return rowResult(table(supabase, "important_dates").insert([stripUndefined(args)]).select("*, subjects(*)").single());
    case "update_important_date": { const { date_id, ...patch } = args || {}; return rowResult(table(supabase, "important_dates").update(stripUndefined(patch)).eq("id", date_id).select("*, subjects(*)").single()); }
    case "delete_important_date": return rowResult(table(supabase, "important_dates").delete().eq("id", args.date_id).select().single());

    // ─── Quick links ───
    case "list_quick_links": return rowResult(table(supabase, "quick_links").select("*").order("order_index"));
    case "create_quick_link": {
      const payload = {
        title: requireStr(args, "title", 200),
        url: requireUrl(args),
        type: args.type || "general",
        ...(args.category !== undefined ? { category: args.category } : {}),
        ...(Number.isInteger(args?.order_index) ? { order_index: args.order_index } : {}),
      };
      return rowResult(table(supabase, "quick_links").insert([payload]).select().single());
    }
    case "update_quick_link": {
      const { link_id, ...patch } = args || {};
      if (patch.url !== undefined) { patch.url = requireUrl({ url: patch.url }); }
      return rowResult(table(supabase, "quick_links").update(stripUndefined(patch)).eq("id", link_id).select().single());
    }
    case "delete_quick_link": return rowResult(table(supabase, "quick_links").delete().eq("id", args.link_id).select().single());

    // ─── Inquiries ───
    case "list_inquiries":
    case "get_pending_inquiries": {
      let q = table(supabase, "inquiries").select("*").order("created_at", { ascending: false }).limit(limit);
      const statusFilter = args?.status || (name === "get_pending_inquiries" ? "new" : "all");
      if (statusFilter && statusFilter !== "all") q = q.eq("status", statusFilter);
      return rowResult(q);
    }
    case "get_inquiry": return rowResult(table(supabase, "inquiries").select("*").eq("id", args.inquiry_id).single());
    case "update_inquiry": { const { inquiry_id, ...patch } = args || {}; return rowResult(table(supabase, "inquiries").update(stripUndefined(patch)).eq("id", inquiry_id).select().single()); }
    case "suggest_inquiry_reply": {
      const inquiryId = requireStr(args, "inquiry_id", 64);
      const reply = requireStr(args, "reply_text", 5000);
      const nextStatus = args.new_status || "in_progress";
      const { data, error } = await table(supabase, "inquiries")
        .update({ ai_suggestion: reply, status: nextStatus, updated_at: new Date().toISOString() })
        .eq("id", inquiryId)
        .select();
      if (error) throw error;
      if (!data || data.length === 0) throw new Error(`لم يتم العثور على استفسار بالمعرف: ${inquiryId}`);
      return { content: [{ type: "text", text: `تم حفظ الرد المقترح وتحديث الحالة إلى "${nextStatus}".\n${JSON.stringify(data[0], null, 2)}` }] };
    }
    case "resolve_inquiry": {
      const inquiryId = requireStr(args, "inquiry_id", 64);
      const patch: Record<string, any> = { status: "resolved", updated_at: new Date().toISOString() };
      if (args?.resolution_note) patch.ai_suggestion = String(args.resolution_note).slice(0, 5000);
      const { data, error } = await table(supabase, "inquiries").update(patch).eq("id", inquiryId).select();
      if (error) throw error;
      if (!data || data.length === 0) throw new Error(`لم يتم العثور على استفسار بالمعرف: ${inquiryId}`);
      return { content: [{ type: "text", text: `تم إغلاق الاستفسار كمحلول.\n${JSON.stringify(data[0], null, 2)}` }] };
    }
    case "delete_inquiry": return rowResult(table(supabase, "inquiries").delete().eq("id", args.inquiry_id).select().single());
    case "get_inquiry_stats": {
      const { data, error } = await table(supabase, "inquiries").select("status");
      if (error) throw error;
      const list = data || [];
      return { content: [{ type: "text", text: JSON.stringify({ total: list.length, new: list.filter((x: any) => x.status === "new").length, in_progress: list.filter((x: any) => x.status === "in_progress").length, resolved: list.filter((x: any) => x.status === "resolved").length, archived: list.filter((x: any) => x.status === "archived").length }, null, 2) }] };
    }

    // ─── Submissions ───
    case "list_submissions": {
      let q = table(supabase, "submissions").select("*, tasks(*)").order("submitted_at", { ascending: false }).limit(limit);
      if (args?.task_id) q = q.eq("task_id", args.task_id);
      if (args?.status && args.status !== "all") q = q.eq("status", args.status);
      return rowResult(q);
    }
    case "update_submission": { const { submission_id, ...patch } = args || {}; const next = stripUndefined(patch); if (next.status && ["reviewed", "accepted", "rejected"].includes(next.status)) next.reviewed_at = new Date().toISOString(); return rowResult(table(supabase, "submissions").update(next).eq("id", submission_id).select().single()); }
    case "delete_submission": return rowResult(table(supabase, "submissions").delete().eq("id", args.submission_id).select().single());

    // ─── Attendance ───
    case "list_attendance": {
      let q = table(supabase, "attendance").select("*, subjects(*)").order("session_date", { ascending: false }).limit(limit);
      if (args?.subject_id) q = q.eq("subject_id", args.subject_id);
      return rowResult(q);
    }
    case "upsert_attendance": {
      const payload = stripUndefined(args, ["attendance_id"]);
      const q = args?.attendance_id
        ? table(supabase, "attendance").update(payload).eq("id", args.attendance_id).select("*, subjects(*)").single()
        : table(supabase, "attendance").insert([payload]).select("*, subjects(*)").single();
      return rowResult(q);
    }
    case "delete_attendance": return rowResult(table(supabase, "attendance").delete().eq("id", args.attendance_id).select().single());

    // ─── Settings ───
    case "list_settings": {
      const source = args?.source || "both";
      const result: Record<string, unknown> = {};
      if (source === "settings" || source === "both") { const { data, error } = await table(supabase, "settings").select("*"); if (error) throw error; result.settings = data; }
      if (source === "app_settings" || source === "both") { const { data, error } = await table(supabase, "app_settings").select("*"); if (error) throw error; result.app_settings = data; }
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
    case "set_setting": {
      const source = args?.source === "app_settings" ? "app_settings" : "settings";
      const payload: Record<string, any> = { key: requireStr(args, "key", 100), value: args.value };
      if (source === "app_settings") payload.updated_at = new Date().toISOString();
      return rowResult(table(supabase, source).upsert(payload).select().single());
    }
    case "delete_setting": {
      const source = args?.source === "app_settings" ? "app_settings" : "settings";
      return rowResult(table(supabase, source).delete().eq("key", requireStr(args, "key", 100)).select().single());
    }

    // ─── Notification logs ───
    case "list_notification_logs": return rowResult(table(supabase, "notifications_log").select("*").order("sent_at", { ascending: false }).limit(limit));
    case "create_notification_log": return rowResult(table(supabase, "notifications_log").insert([stripUndefined(args)]).select().single());
    case "delete_notification_log": return rowResult(table(supabase, "notifications_log").delete().eq("id", args.notification_id).select().single());

    // ─── Team members ───
    case "list_team_members": return rowResult(table(supabase, "team_members").select("*").order("created_at"));
    case "create_team_member": return rowResult(table(supabase, "team_members").insert([stripUndefined(args)]).select().single());
    case "update_team_member": { const { team_member_id, ...patch } = args || {}; return rowResult(table(supabase, "team_members").update(stripUndefined(patch)).eq("id", team_member_id).select().single()); }
    case "delete_team_member": return rowResult(table(supabase, "team_members").delete().eq("id", args.team_member_id).select().single());

    // ─── API keys ───
    case "list_api_keys":
      return rowResult(table(supabase, "api_keys").select("id, name, key_preview, created_at, last_used_at, last_used_ip, revoked_at").order("created_at", { ascending: false }));
    case "create_api_key": {
      const keyName = requireStr(args, "name", 100);
      const fullKeyValue = generateApiKey();
      const keyPreview = `bmp_key_…${fullKeyValue.slice(-6)}`;
      const { data, error } = await table(supabase, "api_keys")
        .insert([{ name: keyName, key_preview: keyPreview, key_value: fullKeyValue }])
        .select("id, name, key_preview, created_at")
        .single();
      if (error) throw error;
      return {
        content: [{
          type: "text",
          text: `تم إنشاء المفتاح بنجاح.\n\nالمفتاح الكامل (احفظه الآن — لن يعرض مرة أخرى):\n${fullKeyValue}\n\n${JSON.stringify(data, null, 2)}`,
        }],
      };
    }
    case "revoke_api_key": {
      const { data, error } = await table(supabase, "api_keys")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", requireStr(args, "key_id", 64))
        .select("id, name, key_preview, revoked_at")
        .single();
      if (error) throw error;
      return { content: [{ type: "text", text: `تم إبطال المفتاح — لن يعود صالحاً للاستخدام.\n${JSON.stringify(data, null, 2)}` }] };
    }
    case "delete_api_key":
      return rowResult(table(supabase, "api_keys").delete().eq("id", requireStr(args, "key_id", 64)).select("id, name, key_preview").single());

    // ─── Push subscriptions ───
    case "list_push_subscriptions": return rowResult(table(supabase, "push_subscriptions").select("id, endpoint, created_at").order("created_at", { ascending: false }).limit(limit));
    case "delete_push_subscription": return rowResult(table(supabase, "push_subscriptions").delete().eq("id", args.subscription_id).select().single());

    default: throw new Error(`Tool not found: ${name}`);
  }
}

// ==========================================
// JSON-RPC handler
// ==========================================
async function handleJsonRpc(body: any, supabase: any, authCtx: { keyId?: string; keyName?: string; viaSecret?: boolean }, clientIp: string): Promise<Response> {
  const { jsonrpc, method, params, id } = body;
  if (jsonrpc && jsonrpc !== "2.0") {
    return jsonResponse({ jsonrpc: "2.0", error: { code: -32600, message: `Invalid jsonrpc version: ${jsonrpc}` }, id: id ?? null });
  }

  switch (method) {
    case "initialize":
      return jsonResponse({
        jsonrpc: "2.0",
        result: {
          protocolVersion: "2025-06-18",
          capabilities: { tools: { listChanged: false }, resources: {}, prompts: {}, logging: {} },
          serverInfo: { name: "student-management-mcp", version: "3.4.0" },
        },
        id,
      });
    case "notifications/initialized":
      return new Response(null, { status: 202, headers: corsHeaders });
    case "ping":
      return jsonResponse({ jsonrpc: "2.0", result: {}, id });
    case "tools/list":
      return jsonResponse({ jsonrpc: "2.0", result: { tools: TOOLS }, id });
    case "tools/call": {
      const { name, arguments: args } = params || {};
      const startedAt = Date.now();
      try {
        const result = await executeTool(name, args, supabase);
        // سجل التدقيق — best-effort
        auditLog(supabase, {
          keyId: authCtx.keyId || null,
          keyName: authCtx.keyName || null,
          tool: name || "[missing]",
          args,
          success: true,
          durationMs: Date.now() - startedAt,
          clientIp,
        }).then(() => {}, () => {});
        return jsonResponse({ jsonrpc: "2.0", result, id });
      } catch (error: any) {
        auditLog(supabase, {
          keyId: authCtx.keyId || null,
          keyName: authCtx.keyName || null,
          tool: name || "[missing]",
          args,
          success: false,
          errorMessage: error?.message,
          durationMs: Date.now() - startedAt,
          clientIp,
        }).then(() => {}, () => {});
        return jsonResponse({
          jsonrpc: "2.0",
          error: { code: -32603, message: `Tool execution failed: ${error?.message}`, data: { tool_name: name } },
          id,
        });
      }
    }
    case "resources/list":
      return jsonResponse({ jsonrpc: "2.0", result: { resources: [] }, id });
    case "prompts/list":
      return jsonResponse({ jsonrpc: "2.0", result: { prompts: [] }, id });
    default:
      return jsonResponse({ jsonrpc: "2.0", error: { code: -32601, message: `Method not found: ${method}` }, id }, 404);
  }
}

// ==========================================
// Main Handler (OAuth + MCP)
// ==========================================
async function handleRequest(req: Request, supabase: any) {
  const url = new URL(req.url);
  const path = url.pathname;
  const base = getBaseUrl(req);
  const mcpUrl = `${base}/functions/v1/mcp`;

  // === OAuth Discovery (RFC 9728 + RFC 8414) ===
  if (path.endsWith("/.well-known/oauth-protected-resource")) {
    return jsonResponse({
      resource: mcpUrl,
      authorization_servers: [mcpUrl],
      bearer_methods_supported: ["header"],
      scopes_supported: [],
    });
  }

  if (path.endsWith("/.well-known/oauth-authorization-server")) {
    return jsonResponse({
      issuer: mcpUrl,
      authorization_endpoint: `${mcpUrl}/oauth/authorize`,
      token_endpoint: `${mcpUrl}/oauth/token`,
      registration_endpoint: `${mcpUrl}/oauth/register`,
      response_types_supported: ["code"],
      response_modes_supported: ["query"],
      grant_types_supported: ["authorization_code"],
      subject_types_supported: ["public"],
      scopes_supported: [],
      token_endpoint_auth_methods_supported: ["none", "client_secret_post"],
      code_challenge_methods_supported: ["S256"],
      require_pushed_authorization_requests: false,
    });
  }

  // Dynamic Client Registration (RFC 7591)
  if (path.endsWith("/oauth/register") && req.method === "POST") {
    try {
      const body = await req.json().catch(() => ({}));
      const clientId = "mcp_client_" + crypto.randomUUID().replace(/-/g, "").substring(0, 24);
      return jsonResponse({
        client_id: clientId,
        client_id_issued_at: Math.floor(Date.now() / 1000),
        client_name: body.client_name || "chatgpt-mcp-connector",
        token_endpoint_auth_method: "none",
        redirect_uris: body.redirect_uris || [],
        grant_types: ["authorization_code"],
        response_types: ["code"],
        subject_type: "public",
        application_type: "web",
      });
    } catch (error: any) {
      return jsonResponse({ error: "invalid_client_metadata", error_description: error.message }, 400);
    }
  }

  // OAuth Authorize endpoint
  if (path.endsWith("/oauth/authorize")) {
    if (req.method === "GET") {
      const params = url.searchParams;
      const redirectUri = params.get("redirect_uri") || "";
      const state = params.get("state") || "";
      const clientId = params.get("client_id") || "";
      const codeChallenge = params.get("code_challenge") || "";
      const codeChallengeMethod = params.get("code_challenge_method") || "";
      const resource = params.get("resource") || "";
      const scope = params.get("scope") || "";
      const errorParam = params.get("error") || "";
      if (!redirectUri) return new Response("redirect_uri مطلوب", { status: 400 });

      // صفحة الموافقة في تطبيق Next.js (قابلة للتخصيص عبر متغير بيئة)
      const frontendUrl = Deno.env.get("OAUTH_AUTHORIZE_URL")
        || "https://student-moderat.mathatqra.workers.dev/oauth/authorize";
      const redirectParams = new URLSearchParams();
      redirectParams.set("redirect_uri", redirectUri);
      if (state) redirectParams.set("state", state);
      if (clientId) redirectParams.set("client_id", clientId);
      if (codeChallenge) redirectParams.set("code_challenge", codeChallenge);
      if (codeChallengeMethod) redirectParams.set("code_challenge_method", codeChallengeMethod);
      if (resource) redirectParams.set("resource", resource);
      if (scope) redirectParams.set("scope", scope);
      if (errorParam) redirectParams.set("error", errorParam);
      redirectParams.set("mcp_url", mcpUrl);
      return Response.redirect(`${frontendUrl}?${redirectParams.toString()}`, 302);
    }

    if (req.method === "POST") {
      try {
        const formData = await req.formData();
        const apiKey = formData.get("api_key")?.toString().trim() || "";
        const redirectUri = formData.get("redirect_uri")?.toString().trim() || "";
        const state = formData.get("state")?.toString().trim() || "";
        const clientId = formData.get("client_id")?.toString().trim() || "";
        const codeChallenge = formData.get("code_challenge")?.toString().trim() || "";
        const codeChallengeMethod = formData.get("code_challenge_method")?.toString().trim() || "";
        const resource = formData.get("resource")?.toString().trim() || "";
        const scope = formData.get("scope")?.toString().trim() || "";
        if (!apiKey || !redirectUri) return jsonResponse({ ok: false, error: "مطلوب: api_key + redirect_uri" }, 400);

        const { valid, keyId, name } = await verifyApiKey(supabase, apiKey);
        if (!valid) return jsonResponse({ ok: false, error: "مفتاح API غير صحيح أو منتهي" }, 401);

        const codePayload = { k: apiKey, t: Date.now(), kid: keyId || null, name: name || null, cid: clientId, cc: codeChallenge, ccm: codeChallengeMethod, res: resource, scp: scope };
        const jsonString = JSON.stringify(codePayload);
        const b64 = btoa(unescape(encodeURIComponent(jsonString))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
        const callbackUrl = new URL(redirectUri);
        callbackUrl.searchParams.set("code", b64);
        if (state) callbackUrl.searchParams.set("state", state);
        return jsonResponse({ ok: true, redirect_url: callbackUrl.toString() });
      } catch (error: any) {
        return new Response(`OAuth authorize error: ${error.message}`, { status: 500 });
      }
    }
  }

  // OAuth Token endpoint — كود صالح 10 دقائق فقط
  if (path.endsWith("/oauth/token") && req.method === "POST") {
    try {
      let code = ""; let grantType = ""; let resource = "";
      const contentType = req.headers.get("content-type") || "";
      if (contentType.includes("application/x-www-form-urlencoded")) {
        const formData = await req.formData();
        code = formData.get("code")?.toString() || "";
        grantType = formData.get("grant_type")?.toString() || "authorization_code";
        resource = formData.get("resource")?.toString() || "";
      } else {
        const body = await req.json();
        code = body.code || "";
        grantType = body.grant_type || "authorization_code";
        resource = body.resource || "";
      }
      if (grantType !== "authorization_code") return jsonResponse({ error: "unsupported_grant_type" }, 400);
      if (!code) return jsonResponse({ error: "invalid_grant", error_description: "Missing authorization code" }, 400);

      let tokenData: any = null; let accessToken = "";
      try {
        const paddedCode = code + "=".repeat((4 - (code.length % 4)) % 4);
        const decoded = decodeURIComponent(escape(atob(paddedCode.replace(/-/g, "+").replace(/_/g, "/"))));
        tokenData = JSON.parse(decoded);
        if (!tokenData || !tokenData.k || typeof tokenData.k !== "string") {
          return jsonResponse({ error: "invalid_grant", error_description: "Authorization code malformed" }, 400);
        }
        // الكود صالح لمدة 10 دقائق فقط
        const CODE_TTL_MS = 10 * 60 * 1000;
        if (!tokenData.t || Date.now() - Number(tokenData.t) > CODE_TTL_MS) {
          return jsonResponse({ error: "invalid_grant", error_description: "Authorization code expired" }, 400);
        }
        accessToken = tokenData.k;
      } catch {
        return jsonResponse({ error: "invalid_grant", error_description: "Authorization code غير صالح" }, 400);
      }

      // Access token صالح 30 يوماً
      return jsonResponse({
        access_token: accessToken,
        token_type: "Bearer",
        expires_in: 30 * 24 * 60 * 60,
        scope: tokenData?.scp || "",
        resource: resource || tokenData?.res || undefined,
      });
    } catch (error: any) {
      return jsonResponse({ error: "invalid_request", error_description: error.message }, 500);
    }
  }

  // === MCP endpoints ===
  const isMcpRoot = path === "/" || path === "/mcp" || path === "/functions/v1/mcp" || path.endsWith("/functions/v1/mcp") || path.endsWith("/mcp");

  // GET: 405
  if (req.method === "GET" && isMcpRoot) {
    return new Response("Method Not Allowed", { status: 405, headers: { ...corsHeaders, Allow: "POST" } });
  }

  // DELETE: end session
  if (req.method === "DELETE" && isMcpRoot) {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // POST: MCP JSON-RPC
  if (req.method === "POST" && isMcpRoot) {
    const authResult = await verifyAuth(req, supabase);
    if (!authResult.authorized) {
      const metaUrl = `${mcpUrl}/.well-known/oauth-protected-resource`;
      return new Response(
        JSON.stringify({ jsonrpc: "2.0", error: { code: -32001, message: "Unauthorized" }, id: null }),
        { status: 401, headers: { ...corsHeaders, "WWW-Authenticate": `Bearer resource_metadata="${metaUrl}"`, "Content-Type": "application/json" } }
      );
    }

    // Rate Limiting لكل مفتاح — 120 طلب/دقيقة (افتراضياً)
    const rateId = authResult.keyId || (authResult.viaSecret ? "secret" : "unknown");
    const rate = await checkMcpRateLimit(supabase, rateId);
    if (!rate.allowed) {
      return jsonResponse(
        { jsonrpc: "2.0", error: { code: -32002, message: `Rate limit exceeded. Retry after ${rate.retryAfter}s` }, id: null },
        429,
        { "Retry-After": String(rate.retryAfter) }
      );
    }

    const clientIp = getClientIp(req);
    const authCtx = { keyId: authResult.keyId, keyName: authResult.keyName, viaSecret: authResult.viaSecret };

    try {
      const body = await req.json();
      // دعم JSON-RPC batch — بحد أقصى 20 طلب لكل دفعة
      if (Array.isArray(body)) {
        const capped = body.slice(0, 20);
        const results = await Promise.all(capped.map(async (rpc) => await handleJsonRpc(rpc, supabase, authCtx, clientIp)));
        return jsonResponse(results);
      }
      return await handleJsonRpc(body, supabase, authCtx, clientIp);
    } catch (err: any) {
      return jsonResponse({ jsonrpc: "2.0", error: { code: -32700, message: "Parse error: " + (err.message || "Invalid JSON") }, id: null }, 400);
    }
  }

  return jsonResponse({ error: "Not found", path }, 404);
}

// ==========================================
// Main entry
// ==========================================
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseKey);
    return await handleRequest(req, supabase);
  } catch (err: any) {
    console.error("Unhandled error:", err);
    return jsonResponse({ jsonrpc: "2.0", error: { code: -32603, message: `Internal error: ${err.message}` }, id: null }, 500);
  }
});
