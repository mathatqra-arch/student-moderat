// ==========================================
// Supabase Edge Function: MCP Server v3.0
// 51 أداة CRUD + OAuth 2.1 في endpoint واحد
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

// ==========================================
// 51 أدوات MCP CRUD كاملة
// ==========================================
const TOOLS: Tool[] = [
  // Dashboard / search
  { name: "get_dashboard_stats", description: "إحصائيات شاملة للمنصة.", inputSchema: objectSchema({}) },
  { name: "search_platform", description: "بحث شامل في كل المحتوى.", inputSchema: objectSchema({ query: { type: "string" }, limit: { type: "integer", default: 25 } }, ["query"]) },

  // Announcements
  { name: "list_announcements", description: "عرض الإعلانات.", inputSchema: objectSchema({ limit: { type: "integer", default: 50 }, pinned_only: { type: "boolean", default: false } }) },
  { name: "get_announcement", description: "جلب إعلان واحد.", inputSchema: objectSchema({ id: { type: "string" } }, ["id"]) },
  { name: "create_announcement", description: "إنشاء إعلان جديد.", inputSchema: objectSchema({ title: { type: "string" }, content: { type: "string" }, category: { type: "string" }, is_pinned: { type: "boolean" } }, ["title", "content"]) },
  { name: "update_announcement", description: "تعديل إعلان.", inputSchema: objectSchema({ announcement_id: { type: "string" }, title: { type: "string" }, content: { type: "string" }, category: { type: "string" }, is_pinned: { type: "boolean" } }, ["announcement_id"]) },
  { name: "delete_announcement", description: "حذف إعلان.", inputSchema: objectSchema({ announcement_id: { type: "string" } }, ["announcement_id"]) },

  // Tasks
  { name: "list_tasks", description: "عرض كل التكليفات.", inputSchema: objectSchema({ status: { type: "string" }, limit: { type: "integer", default: 100 } }) },
  { name: "get_task", description: "جلب تكليف واحد.", inputSchema: objectSchema({ id: { type: "string" } }, ["id"]) },
  { name: "create_task", description: "إنشاء تكليف دراسي.", inputSchema: objectSchema({ subject: { type: "string" }, title: { type: "string" }, description: { type: "string" }, deadline: { type: "string" }, status: { type: "string" } }, ["subject", "title", "deadline"]) },
  { name: "update_task", description: "تعديل تكليف.", inputSchema: objectSchema({ task_id: { type: "string" }, subject: { type: "string" }, title: { type: "string" }, description: { type: "string" }, deadline: { type: "string" }, status: { type: "string" } }, ["task_id"]) },
  { name: "delete_task", description: "حذف تكليف.", inputSchema: objectSchema({ task_id: { type: "string" } }, ["task_id"]) },

  // Subjects
  { name: "list_subjects", description: "عرض كل المواد.", inputSchema: objectSchema({}) },
  { name: "create_subject", description: "إضافة مادة.", inputSchema: objectSchema({ name: { type: "string" }, code: { type: "string" }, instructor: { type: "string" }, color: { type: "string" } }, ["name"]) },
  { name: "update_subject", description: "تعديل مادة.", inputSchema: objectSchema({ subject_id: { type: "string" }, name: { type: "string" }, code: { type: "string" }, instructor: { type: "string" }, color: { type: "string" } }, ["subject_id"]) },
  { name: "delete_subject", description: "حذف مادة.", inputSchema: objectSchema({ subject_id: { type: "string" } }, ["subject_id"]) },

  // Schedule
  { name: "list_schedule", description: "عرض الجدول الأسبوعي.", inputSchema: objectSchema({ day_of_week: { type: "integer" }, active_only: { type: "boolean", default: true } }) },
  { name: "create_schedule_session", description: "إضافة جلسة جدول.", inputSchema: objectSchema({ subject_id: { type: "string" }, day_of_week: { type: "integer" }, start_time: { type: "string" }, end_time: { type: "string" }, room: { type: "string" }, type: { type: "string" } }, ["subject_id", "day_of_week", "start_time", "end_time"]) },
  { name: "update_schedule_session", description: "تعديل جلسة جدول.", inputSchema: objectSchema({ schedule_id: { type: "string" }, subject_id: { type: "string" }, day_of_week: { type: "integer" }, start_time: { type: "string" }, end_time: { type: "string" }, room: { type: "string" }, type: { type: "string" } }, ["schedule_id"]) },
  { name: "delete_schedule_session", description: "حذف جلسة جدول.", inputSchema: objectSchema({ schedule_id: { type: "string" } }, ["schedule_id"]) },

  // Important dates
  { name: "list_important_dates", description: "عرض المواعيد المهمة.", inputSchema: objectSchema({ type: { type: "string" }, upcoming_only: { type: "boolean", default: false }, limit: { type: "integer", default: 50 } }) },
  { name: "create_important_date", description: "إضافة موعد مهم.", inputSchema: objectSchema({ title: { type: "string" }, description: { type: "string" }, date: { type: "string" }, type: { type: "string" }, is_pinned: { type: "boolean" } }, ["title", "date"]) },
  { name: "update_important_date", description: "تعديل موعد مهم.", inputSchema: objectSchema({ date_id: { type: "string" }, title: { type: "string" }, description: { type: "string" }, date: { type: "string" }, type: { type: "string" }, is_pinned: { type: "boolean" } }, ["date_id"]) },
  { name: "delete_important_date", description: "حذف موعد مهم.", inputSchema: objectSchema({ date_id: { type: "string" } }, ["date_id"]) },

  // Quick links
  { name: "list_quick_links", description: "عرض الروابط السريعة.", inputSchema: objectSchema({}) },
  { name: "create_quick_link", description: "إضافة رابط.", inputSchema: objectSchema({ title: { type: "string" }, url: { type: "string" }, type: { type: "string" }, order_index: { type: "integer" } }, ["title", "url"]) },
  { name: "update_quick_link", description: "تعديل رابط.", inputSchema: objectSchema({ link_id: { type: "string" }, title: { type: "string" }, url: { type: "string" }, type: { type: "string" }, order_index: { type: "integer" } }, ["link_id"]) },
  { name: "delete_quick_link", description: "حذف رابط.", inputSchema: objectSchema({ link_id: { type: "string" } }, ["link_id"]) },

  // Inquiries
  { name: "list_inquiries", description: "عرض الاستفسارات.", inputSchema: objectSchema({ status: { type: "string" }, limit: { type: "integer", default: 100 } }) },
  { name: "get_inquiry", description: "جلب استفسار واحد.", inputSchema: objectSchema({ inquiry_id: { type: "string" } }, ["inquiry_id"]) },
  { name: "update_inquiry", description: "تعديل استفسار.", inputSchema: objectSchema({ inquiry_id: { type: "string" }, status: { type: "string" }, ai_suggestion: { type: "string" }, category: { type: "string" } }, ["inquiry_id"]) },
  { name: "delete_inquiry", description: "حذف استفسار.", inputSchema: objectSchema({ inquiry_id: { type: "string" } }, ["inquiry_id"]) },
  { name: "get_inquiry_stats", description: "إحصائيات الاستفسارات.", inputSchema: objectSchema({}) },

  // Submissions
  { name: "list_submissions", description: "عرض التسليمات.", inputSchema: objectSchema({ task_id: { type: "string" }, status: { type: "string" }, limit: { type: "integer", default: 100 } }) },
  { name: "update_submission", description: "مراجعة تسليم.", inputSchema: objectSchema({ submission_id: { type: "string" }, status: { type: "string" }, grade: { type: "string" }, feedback: { type: "string" } }, ["submission_id"]) },
  { name: "delete_submission", description: "حذف تسليم.", inputSchema: objectSchema({ submission_id: { type: "string" } }, ["submission_id"]) },

  // Attendance
  { name: "list_attendance", description: "عرض الحضور.", inputSchema: objectSchema({ subject_id: { type: "string" }, limit: { type: "integer", default: 100 } }) },
  { name: "upsert_attendance", description: "تسجيل/تحديث حضور.", inputSchema: objectSchema({ subject_id: { type: "string" }, session_date: { type: "string" }, total_students: { type: "integer" }, present_count: { type: "integer" }, absent_count: { type: "integer" } }, ["subject_id", "session_date"]) },
  { name: "delete_attendance", description: "حذف سجل حضور.", inputSchema: objectSchema({ attendance_id: { type: "string" } }, ["attendance_id"]) },

  // Settings
  { name: "list_settings", description: "عرض الإعدادات.", inputSchema: objectSchema({ source: { type: "string", default: "both" } }) },
  { name: "set_setting", description: "إنشاء/تحديث إعداد.", inputSchema: objectSchema({ source: { type: "string", default: "settings" }, key: { type: "string" }, value: {} }, ["key", "value"]) },
  { name: "delete_setting", description: "حذف إعداد.", inputSchema: objectSchema({ source: { type: "string", default: "settings" }, key: { type: "string" } }, ["key"]) },

  // Notification logs
  { name: "list_notification_logs", description: "عرض سجل الإشعارات.", inputSchema: objectSchema({ limit: { type: "integer", default: 100 } }) },
  { name: "create_notification_log", description: "تسجيل إشعار.", inputSchema: objectSchema({ title: { type: "string" }, body: { type: "string" }, type: { type: "string" } }, ["title"]) },
  { name: "delete_notification_log", description: "حذف سجل إشعار.", inputSchema: objectSchema({ notification_id: { type: "string" } }, ["notification_id"]) },

  // Team members
  { name: "list_team_members", description: "عرض أعضاء الفريق.", inputSchema: objectSchema({}) },
  { name: "create_team_member", description: "إضافة مشرف.", inputSchema: objectSchema({ user_id: { type: "string" }, name: { type: "string" }, role: { type: "string" } }, ["user_id", "name"]) },
  { name: "update_team_member", description: "تعديل عضو فريق.", inputSchema: objectSchema({ team_member_id: { type: "string" }, name: { type: "string" }, role: { type: "string" } }, ["team_member_id"]) },
  { name: "delete_team_member", description: "حذف عضو فريق.", inputSchema: objectSchema({ team_member_id: { type: "string" } }, ["team_member_id"]) },

  // Push subscriptions
  { name: "list_push_subscriptions", description: "عرض اشتراكات Push.", inputSchema: objectSchema({ limit: { type: "integer", default: 200 } }) },
  { name: "delete_push_subscription", description: "حذف اشتراك Push.", inputSchema: objectSchema({ subscription_id: { type: "string" } }, ["subscription_id"]) },
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

// ==========================================
// المصادقة
// ==========================================
async function verifyAuth(req: Request, supabase: any): Promise<{ authorized: boolean }> {
  const authHeader = req.headers.get("Authorization");
  const apiKeyHeader = req.headers.get("x-api-key");
  let token = "";
  if (authHeader && authHeader.startsWith("Bearer ")) token = authHeader.substring(7).trim();
  else if (apiKeyHeader) token = apiKeyHeader.trim();
  if (!token) return { authorized: false };

  const secretToken = Deno.env.get("MCP_SECRET_TOKEN");
  if (secretToken && token === secretToken) return { authorized: true };

  try {
    const { data, error } = await supabase
      .from("api_keys")
      .select("id, name, revoked_at")
      .eq("key_value", token)
      .is("revoked_at", null)
      .single();
    if (error || !data) return { authorized: false };
    await supabase.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", data.id);
    return { authorized: true };
  } catch { return { authorized: false }; }
}

async function verifyApiKey(supabase: any, apiKey: string) {
  if (!apiKey) return { valid: false };
  const secretToken = Deno.env.get("MCP_SECRET_TOKEN");
  if (secretToken && apiKey === secretToken) return { valid: true, name: "MCP Secret Token" };
  try {
    const { data, error } = await supabase.from("api_keys").select("id, name").eq("key_value", apiKey).is("revoked_at", null).single();
    if (!error && data) {
      await supabase.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", data.id);
      return { valid: true, keyId: data.id, name: data.name };
    }
  } catch {}
  return { valid: false };
}

// ==========================================
// تنفيذ الأدوات (51 أداة)
// ==========================================
async function executeTool(name: string, args: any, supabase: any) {
  const limit = Math.min(Number(args?.limit || 100), 500);
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
      const q = String(args?.query || "").trim();
      if (!q) throw new Error("query مطلوب");
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

    // Announcements
    case "list_announcements": {
      let q = table(supabase, "announcements").select("*").order("is_pinned", { ascending: false }).order("created_at", { ascending: false }).limit(limit);
      if (args?.pinned_only) q = q.eq("is_pinned", true);
      return rowResult(q);
    }
    case "get_announcement": return rowResult(table(supabase, "announcements").select("*").eq("id", args.id).single());
    case "create_announcement": return rowResult(table(supabase, "announcements").insert([{ title: String(args.title).trim(), content: String(args.content).trim(), category: args.category || "عام", is_pinned: Boolean(args.is_pinned) }]).select().single());
    case "update_announcement": { const { announcement_id, ...patch } = args || {}; return rowResult(table(supabase, "announcements").update(stripUndefined(patch)).eq("id", announcement_id).select().single()); }
    case "delete_announcement": return rowResult(table(supabase, "announcements").delete().eq("id", args.announcement_id).select().single());

    // Tasks
    case "list_tasks": {
      let q = table(supabase, "tasks").select("*").order("deadline", { ascending: true }).limit(limit);
      if (args?.status && args.status !== "all") q = q.eq("status", args.status);
      return rowResult(q);
    }
    case "get_task": return rowResult(table(supabase, "tasks").select("*").eq("id", args.id).single());
    case "create_task": {
      const deadline = new Date(args.deadline);
      if (Number.isNaN(deadline.getTime())) throw new Error("deadline غير صالح");
      return rowResult(table(supabase, "tasks").insert([{ subject: String(args.subject).trim(), title: String(args.title).trim(), description: args.description || null, deadline: deadline.toISOString(), status: args.status || "active" }]).select().single());
    }
    case "update_task": { const { task_id, ...patch } = args || {}; if (patch.deadline) { const d = new Date(patch.deadline); if (Number.isNaN(d.getTime())) throw new Error("deadline غير صالح"); patch.deadline = d.toISOString(); } return rowResult(table(supabase, "tasks").update(stripUndefined(patch)).eq("id", task_id).select().single()); }
    case "delete_task": return rowResult(table(supabase, "tasks").delete().eq("id", args.task_id).select().single());

    // Subjects
    case "list_subjects": return rowResult(table(supabase, "subjects").select("*").order("name"));
    case "create_subject": return rowResult(table(supabase, "subjects").insert([stripUndefined(args)]).select().single());
    case "update_subject": { const { subject_id, ...patch } = args || {}; return rowResult(table(supabase, "subjects").update(stripUndefined(patch)).eq("id", subject_id).select().single()); }
    case "delete_subject": return rowResult(table(supabase, "subjects").delete().eq("id", args.subject_id).select().single());

    // Schedule
    case "list_schedule": {
      let q = table(supabase, "schedules").select("*, subjects(*)").order("day_of_week").order("start_time").limit(limit);
      if (Number.isInteger(args?.day_of_week)) q = q.eq("day_of_week", args.day_of_week);
      if (args?.active_only !== false) q = q.eq("is_active", true);
      return rowResult(q);
    }
    case "create_schedule_session": return rowResult(table(supabase, "schedules").insert([stripUndefined(args)]).select("*, subjects(*)").single());
    case "update_schedule_session": { const { schedule_id, ...patch } = args || {}; return rowResult(table(supabase, "schedules").update(stripUndefined(patch)).eq("id", schedule_id).select("*, subjects(*)").single()); }
    case "delete_schedule_session": return rowResult(table(supabase, "schedules").delete().eq("id", args.schedule_id).select().single());

    // Important dates
    case "list_important_dates": {
      let q = table(supabase, "important_dates").select("*, subjects(*)").order("date").limit(limit);
      if (args?.type) q = q.eq("type", args.type);
      if (args?.upcoming_only) q = q.gte("date", new Date().toISOString());
      return rowResult(q);
    }
    case "create_important_date": return rowResult(table(supabase, "important_dates").insert([stripUndefined(args)]).select("*, subjects(*)").single());
    case "update_important_date": { const { date_id, ...patch } = args || {}; return rowResult(table(supabase, "important_dates").update(stripUndefined(patch)).eq("id", date_id).select("*, subjects(*)").single()); }
    case "delete_important_date": return rowResult(table(supabase, "important_dates").delete().eq("id", args.date_id).select().single());

    // Quick links
    case "list_quick_links": return rowResult(table(supabase, "quick_links").select("*").order("order_index"));
    case "create_quick_link": return rowResult(table(supabase, "quick_links").insert([stripUndefined(args)]).select().single());
    case "update_quick_link": { const { link_id, ...patch } = args || {}; return rowResult(table(supabase, "quick_links").update(stripUndefined(patch)).eq("id", link_id).select().single()); }
    case "delete_quick_link": return rowResult(table(supabase, "quick_links").delete().eq("id", args.link_id).select().single());

    // Inquiries
    case "list_inquiries": {
      let q = table(supabase, "inquiries").select("*").order("created_at", { ascending: false }).limit(limit);
      if (args?.status && args.status !== "all") q = q.eq("status", args.status);
      return rowResult(q);
    }
    case "get_inquiry": return rowResult(table(supabase, "inquiries").select("*").eq("id", args.inquiry_id).single());
    case "update_inquiry": { const { inquiry_id, ...patch } = args || {}; return rowResult(table(supabase, "inquiries").update(stripUndefined(patch)).eq("id", inquiry_id).select().single()); }
    case "delete_inquiry": return rowResult(table(supabase, "inquiries").delete().eq("id", args.inquiry_id).select().single());
    case "get_inquiry_stats": {
      const { data, error } = await table(supabase, "inquiries").select("status");
      if (error) throw error;
      const list = data || [];
      return { content: [{ type: "text", text: JSON.stringify({ total: list.length, new: list.filter((x: any) => x.status === "new").length, in_progress: list.filter((x: any) => x.status === "in_progress").length, resolved: list.filter((x: any) => x.status === "resolved").length, archived: list.filter((x: any) => x.status === "archived").length }, null, 2) }] };
    }

    // Submissions
    case "list_submissions": {
      let q = table(supabase, "submissions").select("*, tasks(*)").order("submitted_at", { ascending: false }).limit(limit);
      if (args?.task_id) q = q.eq("task_id", args.task_id);
      if (args?.status && args.status !== "all") q = q.eq("status", args.status);
      return rowResult(q);
    }
    case "update_submission": { const { submission_id, ...patch } = args || {}; const next = stripUndefined(patch); if (next.status && ["reviewed", "accepted", "rejected"].includes(next.status)) next.reviewed_at = new Date().toISOString(); return rowResult(table(supabase, "submissions").update(next).eq("id", submission_id).select().single()); }
    case "delete_submission": return rowResult(table(supabase, "submissions").delete().eq("id", args.submission_id).select().single());

    // Attendance
    case "list_attendance": {
      let q = table(supabase, "attendance").select("*, subjects(*)").order("session_date", { ascending: false }).limit(limit);
      if (args?.subject_id) q = q.eq("subject_id", args.subject_id);
      return rowResult(q);
    }
    case "upsert_attendance": {
      const payload = stripUndefined(args, ["attendance_id"]);
      const q = args?.attendance_id ? table(supabase, "attendance").update(payload).eq("id", args.attendance_id).select("*, subjects(*)").single() : table(supabase, "attendance").insert([payload]).select("*, subjects(*)").single();
      return rowResult(q);
    }
    case "delete_attendance": return rowResult(table(supabase, "attendance").delete().eq("id", args.attendance_id).select().single());

    // Settings
    case "list_settings": {
      const source = args?.source || "both";
      const result: Record<string, unknown> = {};
      if (source === "settings" || source === "both") { const { data, error } = await table(supabase, "settings").select("*"); if (error) throw error; result.settings = data; }
      if (source === "app_settings" || source === "both") { const { data, error } = await table(supabase, "app_settings").select("*"); if (error) throw error; result.app_settings = data; }
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
    case "set_setting": { const source = args?.source || "settings"; const payload = { key: args.key, value: args.value, updated_at: new Date().toISOString() }; return rowResult(table(supabase, source).upsert(payload).select().single()); }
    case "delete_setting": return rowResult(table(supabase, args?.source || "settings").delete().eq("key", args.key).select().single());

    // Notification logs
    case "list_notification_logs": return rowResult(table(supabase, "notifications_log").select("*").order("sent_at", { ascending: false }).limit(limit));
    case "create_notification_log": return rowResult(table(supabase, "notifications_log").insert([stripUndefined(args)]).select().single());
    case "delete_notification_log": return rowResult(table(supabase, "notifications_log").delete().eq("id", args.notification_id).select().single());

    // Team members
    case "list_team_members": return rowResult(table(supabase, "team_members").select("*").order("created_at"));
    case "create_team_member": return rowResult(table(supabase, "team_members").insert([stripUndefined(args)]).select().single());
    case "update_team_member": { const { team_member_id, ...patch } = args || {}; return rowResult(table(supabase, "team_members").update(stripUndefined(patch)).eq("id", team_member_id).select().single()); }
    case "delete_team_member": return rowResult(table(supabase, "team_members").delete().eq("id", args.team_member_id).select().single());

    // Push subscriptions
    case "list_push_subscriptions": return rowResult(table(supabase, "push_subscriptions").select("id, endpoint, created_at").order("created_at", { ascending: false }).limit(limit));
    case "delete_push_subscription": return rowResult(table(supabase, "push_subscriptions").delete().eq("id", args.subscription_id).select().single());

    default: throw new Error(`Tool not found: ${name}`);
  }
}

// ==========================================
// JSON-RPC handler
// ==========================================
async function handleJsonRpc(body: any, supabase: any): Promise<Response> {
  const { jsonrpc, method, params, id } = body;
  if (jsonrpc && jsonrpc !== "2.0") return jsonResponse({ jsonrpc: "2.0", error: { code: -32600, message: `Invalid jsonrpc version: ${jsonrpc}` }, id: id ?? null });

  switch (method) {
    case "initialize": return jsonResponse({ jsonrpc: "2.0", result: { protocolVersion: "2025-06-18", capabilities: { tools: { listChanged: false }, resources: {}, prompts: {}, logging: {} }, serverInfo: { name: "student-management-mcp", version: "3.0.0" } }, id });
    case "notifications/initialized": return new Response(null, { status: 202, headers: corsHeaders });
    case "ping": return jsonResponse({ jsonrpc: "2.0", result: {}, id });
    case "tools/list": return jsonResponse({ jsonrpc: "2.0", result: { tools: TOOLS }, id });
    case "tools/call": {
      const { name, arguments: args } = params || {};
      try { const result = await executeTool(name, args, supabase); return jsonResponse({ jsonrpc: "2.0", result, id }); }
      catch (error: any) { return jsonResponse({ jsonrpc: "2.0", error: { code: -32603, message: `Tool execution failed: ${error.message}`, data: { tool_name: name } }, id }); }
    }
    case "resources/list": return jsonResponse({ jsonrpc: "2.0", result: { resources: [] }, id });
    case "prompts/list": return jsonResponse({ jsonrpc: "2.0", result: { prompts: [] }, id });
    default: return jsonResponse({ jsonrpc: "2.0", error: { code: -32601, message: `Method not found: ${method}` }, id }, 404);
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

  // === OAuth endpoints ===

  // .well-known/oauth-protected-resource (RFC 9728)
  if (path.endsWith("/.well-known/oauth-protected-resource")) {
    return jsonResponse({ resource: mcpUrl, authorization_servers: [mcpUrl], bearer_methods_supported: ["header"], scopes_supported: [] });
  }

  // .well-known/oauth-authorization-server (RFC 8414)
  if (path.endsWith("/.well-known/oauth-authorization-server")) {
    return jsonResponse({
      issuer: mcpUrl,
      authorization_endpoint: `${mcpUrl}/oauth/authorize`,
      token_endpoint: `${mcpUrl}/oauth/token`,
      registration_endpoint: `${mcpUrl}/oauth/register`,
      response_types_supported: ["code"],
      response_modes_supported: ["query"],
      grant_types_supported: ["authorization_code", "refresh_token"],
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
      return jsonResponse({ client_id: clientId, client_id_issued_at: Math.floor(Date.now() / 1000), client_name: body.client_name || "chatgpt-mcp-connector", token_endpoint_auth_method: "none", redirect_uris: body.redirect_uris || [], grant_types: ["authorization_code"], response_types: ["code"], subject_type: "public", application_type: "web" });
    } catch (error: any) { return jsonResponse({ error: "invalid_client_metadata", error_description: error.message }, 400); }
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

      const frontendUrl = "https://student-moderat.mathatqra.workers.dev/oauth/authorize";
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
      } catch (error: any) { return new Response(`OAuth authorize error: ${error.message}`, { status: 500 }); }
    }
  }

  // OAuth Token endpoint
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
        if (!tokenData || !tokenData.k || typeof tokenData.k !== "string") return jsonResponse({ error: "invalid_grant", error_description: "Authorization code malformed" }, 400);
        accessToken = tokenData.k;
      } catch { return jsonResponse({ error: "invalid_grant", error_description: "Authorization code غير صالح" }, 400); }

      return jsonResponse({ access_token: accessToken, token_type: "Bearer", expires_in: 315360000, scope: tokenData?.scp || "", resource: resource || tokenData?.res || undefined });
    } catch (error: any) { return jsonResponse({ error: "invalid_request", error_description: error.message }, 500); }
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

    try {
      const body = await req.json();
      if (Array.isArray(body)) {
        const results = await Promise.all(body.map(async (rpc) => await handleJsonRpc(rpc, supabase)));
        if (results.length === 1) return results[0];
        return jsonResponse(results.map((r: any) => r));
      }
      return await handleJsonRpc(body, supabase);
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
