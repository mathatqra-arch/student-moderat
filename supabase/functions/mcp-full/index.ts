/**
 * Supabase Edge Function: mcp-full
 * Full-control MCP endpoint for the student batch platform.
 *
 * This endpoint is additive: the existing /mcp endpoint can remain live
 * while MCP clients are migrated to /mcp-full.
 *
 * Auth:
 *   Authorization: Bearer <MCP_SECRET_TOKEN>
 *   or x-api-key: <active api_keys.key_value>
 */
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-api-key, content-type, mcp-session-id, mcp-protocol-version, accept",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Expose-Headers": "mcp-session-id, www-authenticate",
};

type Tool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

const objectSchema = (
  properties: Record<string, unknown>,
  required: string[] = [],
): Record<string, unknown> => ({
  type: "object",
  properties,
  ...(required.length ? { required } : {}),
});

const TOOLS: Tool[] = [
  // Dashboard / search
  {
    name: "get_dashboard_stats",
    description: "إحصائيات شاملة للمنصة والطلاب والمحتوى.",
    inputSchema: objectSchema({}),
  },
  {
    name: "search_platform",
    description: "بحث شامل داخل الإعلانات والتكليفات والاستفسارات والمواد والروابط والمواعيد.",
    inputSchema: objectSchema(
      { query: { type: "string" }, limit: { type: "integer", default: 25 } },
      ["query"],
    ),
  },

  // Announcements
  {
    name: "list_announcements",
    description: "عرض الإعلانات مع دعم التصفح والتثبيت.",
    inputSchema: objectSchema({ limit: { type: "integer", default: 50 }, pinned_only: { type: "boolean", default: false } }),
  },
  {
    name: "get_announcement",
    description: "جلب إعلان واحد بالمعرف.",
    inputSchema: objectSchema({ id: { type: "string" } }, ["id"]),
  },
  {
    name: "create_announcement",
    description: "إنشاء إعلان جديد.",
    inputSchema: objectSchema(
      {
        title: { type: "string" },
        content: { type: "string" },
        category: { type: "string", enum: ["عاجل", "أكاديمي", "هام", "عام"] },
        is_pinned: { type: "boolean" },
      },
      ["title", "content"],
    ),
  },
  {
    name: "update_announcement",
    description: "تعديل إعلان موجود.",
    inputSchema: objectSchema(
      {
        announcement_id: { type: "string" },
        title: { type: "string" },
        content: { type: "string" },
        category: { type: "string" },
        is_pinned: { type: "boolean" },
      },
      ["announcement_id"],
    ),
  },
  {
    name: "delete_announcement",
    description: "حذف إعلان نهائياً.",
    inputSchema: objectSchema({ announcement_id: { type: "string" } }, ["announcement_id"]),
  },

  // Tasks
  {
    name: "list_tasks",
    description: "عرض كل التكليفات.",
    inputSchema: objectSchema({ status: { type: "string", enum: ["active", "closed", "all"], default: "all" }, limit: { type: "integer", default: 100 } }),
  },
  {
    name: "get_task",
    description: "جلب تكليف واحد.",
    inputSchema: objectSchema({ id: { type: "string" } }, ["id"]),
  },
  {
    name: "create_task",
    description: "إنشاء تكليف دراسي.",
    inputSchema: objectSchema(
      {
        subject: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        deadline: { type: "string" },
        status: { type: "string", enum: ["active", "closed"] },
      },
      ["subject", "title", "deadline"],
    ),
  },
  {
    name: "update_task",
    description: "تعديل تكليف.",
    inputSchema: objectSchema(
      {
        task_id: { type: "string" },
        subject: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        deadline: { type: "string" },
        status: { type: "string" },
      },
      ["task_id"],
    ),
  },
  {
    name: "delete_task",
    description: "حذف تكليف.",
    inputSchema: objectSchema({ task_id: { type: "string" } }, ["task_id"]),
  },

  // Subjects
  { name: "list_subjects", description: "عرض كل المواد.", inputSchema: objectSchema({}) },
  {
    name: "create_subject",
    description: "إضافة مادة.",
    inputSchema: objectSchema(
      {
        name: { type: "string" },
        code: { type: "string" },
        instructor: { type: "string" },
        color: { type: "string" },
        icon: { type: "string" },
        semester: { type: "string" },
        credits: { type: "integer" },
      },
      ["name"],
    ),
  },
  {
    name: "update_subject",
    description: "تعديل مادة.",
    inputSchema: objectSchema(
      {
        subject_id: { type: "string" },
        name: { type: "string" },
        code: { type: "string" },
        instructor: { type: "string" },
        color: { type: "string" },
        icon: { type: "string" },
        semester: { type: "string" },
        credits: { type: "integer" },
      },
      ["subject_id"],
    ),
  },
  {
    name: "delete_subject",
    description: "حذف مادة مع الجداول المرتبطة بها بسبب cascade.",
    inputSchema: objectSchema({ subject_id: { type: "string" } }, ["subject_id"]),
  },

  // Schedule
  {
    name: "list_schedule",
    description: "عرض الجدول الأسبوعي.",
    inputSchema: objectSchema({ day_of_week: { type: "integer" }, active_only: { type: "boolean", default: true } }),
  },
  {
    name: "create_schedule_session",
    description: "إضافة محاضرة أو سكشن أو معمل أو امتحان.",
    inputSchema: objectSchema(
      {
        subject_id: { type: "string" },
        day_of_week: { type: "integer" },
        start_time: { type: "string" },
        end_time: { type: "string" },
        location: { type: "string" },
        room: { type: "string" },
        type: { type: "string" },
        notes: { type: "string" },
        is_active: { type: "boolean" },
      },
      ["subject_id", "day_of_week", "start_time", "end_time"],
    ),
  },
  {
    name: "update_schedule_session",
    description: "تعديل جلسة في الجدول.",
    inputSchema: objectSchema(
      {
        schedule_id: { type: "string" },
        subject_id: { type: "string" },
        day_of_week: { type: "integer" },
        start_time: { type: "string" },
        end_time: { type: "string" },
        location: { type: "string" },
        room: { type: "string" },
        type: { type: "string" },
        notes: { type: "string" },
        is_active: { type: "boolean" },
      },
      ["schedule_id"],
    ),
  },
  {
    name: "delete_schedule_session",
    description: "حذف جلسة من الجدول.",
    inputSchema: objectSchema({ schedule_id: { type: "string" } }, ["schedule_id"]),
  },

  // Important dates
  {
    name: "list_important_dates",
    description: "عرض المواعيد المهمة القادمة أو كل المواعيد.",
    inputSchema: objectSchema({ type: { type: "string" }, upcoming_only: { type: "boolean", default: false }, limit: { type: "integer", default: 50 } }),
  },
  {
    name: "create_important_date",
    description: "إضافة امتحان أو موعد تسليم أو إجازة أو فعالية.",
    inputSchema: objectSchema(
      {
        title: { type: "string" },
        description: { type: "string" },
        date: { type: "string" },
        end_date: { type: "string" },
        type: { type: "string" },
        subject_id: { type: "string" },
        is_pinned: { type: "boolean" },
      },
      ["title", "date"],
    ),
  },
  {
    name: "update_important_date",
    description: "تعديل موعد مهم.",
    inputSchema: objectSchema(
      {
        date_id: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        date: { type: "string" },
        end_date: { type: "string" },
        type: { type: "string" },
        subject_id: { type: "string" },
        is_pinned: { type: "boolean" },
      },
      ["date_id"],
    ),
  },
  {
    name: "delete_important_date",
    description: "حذف موعد مهم.",
    inputSchema: objectSchema({ date_id: { type: "string" } }, ["date_id"]),
  },

  // Quick links
  { name: "list_quick_links", description: "عرض الروابط السريعة.", inputSchema: objectSchema({}) },
  {
    name: "create_quick_link",
    description: "إضافة رابط.",
    inputSchema: objectSchema(
      {
        title: { type: "string" },
        url: { type: "string" },
        type: { type: "string" },
        icon: { type: "string" },
        order_index: { type: "integer" },
        category: { type: "string" },
      },
      ["title", "url"],
    ),
  },
  {
    name: "update_quick_link",
    description: "تعديل رابط.",
    inputSchema: objectSchema(
      {
        link_id: { type: "string" },
        title: { type: "string" },
        url: { type: "string" },
        type: { type: "string" },
        icon: { type: "string" },
        order_index: { type: "integer" },
        category: { type: "string" },
      },
      ["link_id"],
    ),
  },
  {
    name: "delete_quick_link",
    description: "حذف رابط.",
    inputSchema: objectSchema({ link_id: { type: "string" } }, ["link_id"]),
  },

  // Inquiries
  {
    name: "list_inquiries",
    description: "عرض الاستفسارات بكل الحالات.",
    inputSchema: objectSchema({ status: { type: "string" }, limit: { type: "integer", default: 100 } }),
  },
  {
    name: "get_inquiry",
    description: "جلب استفسار واحد.",
    inputSchema: objectSchema({ inquiry_id: { type: "string" } }, ["inquiry_id"]),
  },
  {
    name: "update_inquiry",
    description: "تعديل حالة أو تصنيف أو رد مقترح أو المسؤول عن الاستفسار.",
    inputSchema: objectSchema(
      {
        inquiry_id: { type: "string" },
        full_name: { type: "string" },
        whatsapp_number: { type: "string" },
        category: { type: "string" },
        status: { type: "string" },
        ai_suggestion: { type: "string" },
        assigned_to: { type: "string" },
      },
      ["inquiry_id"],
    ),
  },
  {
    name: "delete_inquiry",
    description: "حذف استفسار نهائياً.",
    inputSchema: objectSchema({ inquiry_id: { type: "string" } }, ["inquiry_id"]),
  },
  { name: "get_inquiry_stats", description: "إحصائيات الاستفسارات.", inputSchema: objectSchema({}) },

  // Submissions
  {
    name: "list_submissions",
    description: "عرض التسليمات لمهمة أو لكل المهام.",
    inputSchema: objectSchema({ task_id: { type: "string" }, status: { type: "string" }, limit: { type: "integer", default: 100 } }),
  },
  {
    name: "update_submission",
    description: "مراجعة تسليم ووضع الدرجة والتغذية الراجعة.",
    inputSchema: objectSchema(
      { submission_id: { type: "string" }, status: { type: "string" }, grade: { type: "string" }, feedback: { type: "string" } },
      ["submission_id"],
    ),
  },
  {
    name: "delete_submission",
    description: "حذف تسليم.",
    inputSchema: objectSchema({ submission_id: { type: "string" } }, ["submission_id"]),
  },

  // Attendance
  {
    name: "list_attendance",
    description: "عرض الحضور حسب المادة والتاريخ.",
    inputSchema: objectSchema({ subject_id: { type: "string" }, limit: { type: "integer", default: 100 } }),
  },
  {
    name: "upsert_attendance",
    description: "تسجيل أو تحديث سجل حضور لمادة وتاريخ.",
    inputSchema: objectSchema(
      {
        attendance_id: { type: "string" },
        subject_id: { type: "string" },
        session_date: { type: "string" },
        total_students: { type: "integer" },
        present_count: { type: "integer" },
        absent_count: { type: "integer" },
        notes: { type: "string" },
      },
      ["subject_id", "session_date"],
    ),
  },
  {
    name: "delete_attendance",
    description: "حذف سجل حضور.",
    inputSchema: objectSchema({ attendance_id: { type: "string" } }, ["attendance_id"]),
  },

  // Settings / notification logs
  {
    name: "list_settings",
    description: "عرض إعدادات المنصة من settings وapp_settings.",
    inputSchema: objectSchema({ source: { type: "string", enum: ["settings", "app_settings", "both"], default: "both" } }),
  },
  {
    name: "set_setting",
    description: "إنشاء أو تحديث إعداد منصة بصيغة JSON.",
    inputSchema: objectSchema(
      { source: { type: "string", enum: ["settings", "app_settings"], default: "settings" }, key: { type: "string" }, value: {} },
      ["key", "value"],
    ),
  },
  {
    name: "delete_setting",
    description: "حذف إعداد منصة.",
    inputSchema: objectSchema({ source: { type: "string", enum: ["settings", "app_settings"], default: "settings" }, key: { type: "string" } }, ["key"]),
  },
  {
    name: "list_notification_logs",
    description: "عرض سجل الإشعارات.",
    inputSchema: objectSchema({ limit: { type: "integer", default: 100 } }),
  },
  {
    name: "create_notification_log",
    description: "تسجيل إشعار مع جمهوره في قاعدة البيانات.",
    inputSchema: objectSchema(
      {
        title: { type: "string" },
        body: { type: "string" },
        type: { type: "string" },
        target_audience: { type: "string" },
        target_users: { type: "array", items: { type: "string" } },
      },
      ["title"],
    ),
  },
  {
    name: "delete_notification_log",
    description: "حذف سجل إشعار.",
    inputSchema: objectSchema({ notification_id: { type: "string" } }, ["notification_id"]),
  },

  // Team / subscriptions
  { name: "list_team_members", description: "عرض أعضاء الفريق.", inputSchema: objectSchema({}) },
  {
    name: "create_team_member",
    description: "إضافة مشرف للفريق.",
    inputSchema: objectSchema({ user_id: { type: "string" }, name: { type: "string" }, role: { type: "string", enum: ["leader", "assistant"] } }, ["user_id", "name"]),
  },
  {
    name: "update_team_member",
    description: "تعديل عضو فريق.",
    inputSchema: objectSchema({ team_member_id: { type: "string" }, name: { type: "string" }, role: { type: "string" } }, ["team_member_id"]),
  },
  {
    name: "delete_team_member",
    description: "حذف عضو فريق.",
    inputSchema: objectSchema({ team_member_id: { type: "string" } }, ["team_member_id"]),
  },
  {
    name: "list_push_subscriptions",
    description: "عرض اشتراكات Push المسجلة بدون كشف مفاتيح المصادقة.",
    inputSchema: objectSchema({ limit: { type: "integer", default: 200 } }),
  },
  {
    name: "delete_push_subscription",
    description: "حذف اشتراك Push.",
    inputSchema: objectSchema({ subscription_id: { type: "string" } }, ["subscription_id"]),
  },
];

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

function getToken(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  return req.headers.get("x-api-key") || "";
}

async function authenticate(req: Request, supabase: any) {
  const token = getToken(req);
  if (!token) return false;

  const secret = Deno.env.get("MCP_SECRET_TOKEN") || "";
  if (secret && token === secret) return true;

  const { data, error } = await supabase
    .from("api_keys")
    .select("id")
    .eq("key_value", token)
    .is("revoked_at", null)
    .single();

  if (error || !data) return false;

  await supabase
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id);

  return true;
}

async function executeTool(name: string, args: any, supabase: any) {
  const limit = Math.min(Number(args?.limit || 100), 500);

  switch (name) {
    case "get_dashboard_stats": {
      const tables = [
        "announcements", "tasks", "inquiries", "quick_links", "team_members",
        "subjects", "schedules", "important_dates", "submissions", "attendance",
      ];
      const counts: Record<string, number> = {};
      for (const t of tables) {
        const { count, error } = await table(supabase, t).select("*", { count: "exact", head: true });
        if (!error) counts[t] = count || 0;
      }
      const { data: activeTasks } = await table(supabase, "tasks").select("id").eq("status", "active");
      const { data: newInquiries } = await table(supabase, "inquiries").select("id").eq("status", "new");
      return {
        content: [{ type: "text", text: JSON.stringify({
          generated_at: new Date().toISOString(),
          counts,
          active_tasks: activeTasks?.length || 0,
          new_inquiries: newInquiries?.length || 0,
        }, null, 2) }],
      };
    }

    case "search_platform": {
      const q = String(args?.query || "").trim();
      if (!q) throw new Error("query مطلوب");
      const term = `%${q}%`;
      const [a, t, i, s, l, d] = await Promise.all([
        table(supabase, "announcements").select("*").or(`title.ilike.${term},content.ilike.${term}`).limit(limit),
        table(supabase, "tasks").select("*").or(`title.ilike.${term},subject.ilike.${term},description.ilike.${term}`).limit(limit),
        table(supabase, "inquiries").select("*").or(`full_name.ilike.${term},message.ilike.${term},category.ilike.${term}`).limit(limit),
        table(supabase, "subjects").select("*").or(`name.ilike.${term},code.ilike.${term},instructor.ilike.${term}`).limit(limit),
        table(supabase, "quick_links").select("*").or(`title.ilike.${term},type.ilike.${term},category.ilike.${term}`).limit(limit),
        table(supabase, "important_dates").select("*").or(`title.ilike.${term},description.ilike.${term},type.ilike.${term}`).limit(limit),
      ]);
      return {
        content: [{ type: "text", text: JSON.stringify({
          query: q,
          announcements: a.data || [],
          tasks: t.data || [],
          inquiries: i.data || [],
          subjects: s.data || [],
          links: l.data || [],
          dates: d.data || [],
        }, null, 2) }],
      };
    }

    case "list_announcements": {
      let q = table(supabase, "announcements").select("*").order("is_pinned", { ascending: false }).order("created_at", { ascending: false }).limit(limit);
      if (args?.pinned_only) q = q.eq("is_pinned", true);
      return rowResult(q);
    }
    case "get_announcement": return rowResult(table(supabase, "announcements").select("*").eq("id", args.id).single());
    case "create_announcement":
      return rowResult(table(supabase, "announcements").insert([{
        title: String(args.title).trim(),
        content: String(args.content).trim(),
        category: args.category || "عام",
        is_pinned: Boolean(args.is_pinned),
      }]).select().single());
    case "update_announcement": {
      const { announcement_id, ...patch } = args || {};
      return rowResult(table(supabase, "announcements").update(stripUndefined(patch)).eq("id", announcement_id).select().single());
    }
    case "delete_announcement": return rowResult(table(supabase, "announcements").delete().eq("id", args.announcement_id).select().single());

    case "list_tasks": {
      let q = table(supabase, "tasks").select("*").order("deadline", { ascending: true }).limit(limit);
      if (args?.status && args.status !== "all") q = q.eq("status", args.status);
      return rowResult(q);
    }
    case "get_task": return rowResult(table(supabase, "tasks").select("*").eq("id", args.id).single());
    case "create_task": {
      const deadline = new Date(args.deadline);
      if (Number.isNaN(deadline.getTime())) throw new Error("deadline غير صالح");
      return rowResult(table(supabase, "tasks").insert([{
        subject: String(args.subject).trim(),
        title: String(args.title).trim(),
        description: args.description || null,
        deadline: deadline.toISOString(),
        status: args.status || "active",
      }]).select().single());
    }
    case "update_task": {
      const { task_id, ...patch } = args || {};
      if (patch.deadline) {
        const date = new Date(patch.deadline);
        if (Number.isNaN(date.getTime())) throw new Error("deadline غير صالح");
        patch.deadline = date.toISOString();
      }
      return rowResult(table(supabase, "tasks").update(stripUndefined(patch)).eq("id", task_id).select().single());
    }
    case "delete_task": return rowResult(table(supabase, "tasks").delete().eq("id", args.task_id).select().single());

    case "list_subjects": return rowResult(table(supabase, "subjects").select("*").order("name"));
    case "create_subject": return rowResult(table(supabase, "subjects").insert([stripUndefined(args)]).select().single());
    case "update_subject": {
      const { subject_id, ...patch } = args || {};
      return rowResult(table(supabase, "subjects").update(stripUndefined(patch)).eq("id", subject_id).select().single());
    }
    case "delete_subject": return rowResult(table(supabase, "subjects").delete().eq("id", args.subject_id).select().single());

    case "list_schedule": {
      let q = table(supabase, "schedules").select("*, subjects(*)").order("day_of_week").order("start_time").limit(limit);
      if (Number.isInteger(args?.day_of_week)) q = q.eq("day_of_week", args.day_of_week);
      if (args?.active_only !== false) q = q.eq("is_active", true);
      return rowResult(q);
    }
    case "create_schedule_session":
      return rowResult(table(supabase, "schedules").insert([stripUndefined(args)]).select("*, subjects(*)").single());
    case "update_schedule_session": {
      const { schedule_id, ...patch } = args || {};
      return rowResult(table(supabase, "schedules").update(stripUndefined(patch)).eq("id", schedule_id).select("*, subjects(*)").single());
    }
    case "delete_schedule_session": return rowResult(table(supabase, "schedules").delete().eq("id", args.schedule_id).select().single());

    case "list_important_dates": {
      let q = table(supabase, "important_dates").select("*, subjects(*)").order("date").limit(limit);
      if (args?.type) q = q.eq("type", args.type);
      if (args?.upcoming_only) q = q.gte("date", new Date().toISOString());
      return rowResult(q);
    }
    case "create_important_date": return rowResult(table(supabase, "important_dates").insert([stripUndefined(args)]).select("*, subjects(*)").single());
    case "update_important_date": {
      const { date_id, ...patch } = args || {};
      return rowResult(table(supabase, "important_dates").update(stripUndefined(patch)).eq("id", date_id).select("*, subjects(*)").single());
    }
    case "delete_important_date": return rowResult(table(supabase, "important_dates").delete().eq("id", args.date_id).select().single());

    case "list_quick_links": return rowResult(table(supabase, "quick_links").select("*").order("order_index"));
    case "create_quick_link": return rowResult(table(supabase, "quick_links").insert([stripUndefined(args)]).select().single());
    case "update_quick_link": {
      const { link_id, ...patch } = args || {};
      return rowResult(table(supabase, "quick_links").update(stripUndefined(patch)).eq("id", link_id).select().single());
    }
    case "delete_quick_link": return rowResult(table(supabase, "quick_links").delete().eq("id", args.link_id).select().single());

    case "list_inquiries": {
      let q = table(supabase, "inquiries").select("*").order("created_at", { ascending: false }).limit(limit);
      if (args?.status && args.status !== "all") q = q.eq("status", args.status);
      return rowResult(q);
    }
    case "get_inquiry": return rowResult(table(supabase, "inquiries").select("*").eq("id", args.inquiry_id).single());
    case "update_inquiry": {
      const { inquiry_id, ...patch } = args || {};
      return rowResult(table(supabase, "inquiries").update(stripUndefined(patch)).eq("id", inquiry_id).select().single());
    }
    case "delete_inquiry": return rowResult(table(supabase, "inquiries").delete().eq("id", args.inquiry_id).select().single());
    case "get_inquiry_stats": {
      const { data, error } = await table(supabase, "inquiries").select("status");
      if (error) throw error;
      const list = data || [];
      return {
        content: [{ type: "text", text: JSON.stringify({
          total: list.length,
          new: list.filter((x: any) => x.status === "new").length,
          in_progress: list.filter((x: any) => x.status === "in_progress").length,
          resolved: list.filter((x: any) => x.status === "resolved").length,
          archived: list.filter((x: any) => x.status === "archived").length,
        }, null, 2) }],
      };
    }

    case "list_submissions": {
      let q = table(supabase, "submissions").select("*, tasks(*)").order("submitted_at", { ascending: false }).limit(limit);
      if (args?.task_id) q = q.eq("task_id", args.task_id);
      if (args?.status && args.status !== "all") q = q.eq("status", args.status);
      return rowResult(q);
    }
    case "update_submission": {
      const { submission_id, ...patch } = args || {};
      const next = stripUndefined(patch);
      if (next.status && ["reviewed", "accepted", "rejected"].includes(next.status)) next.reviewed_at = new Date().toISOString();
      return rowResult(table(supabase, "submissions").update(next).eq("id", submission_id).select().single());
    }
    case "delete_submission": return rowResult(table(supabase, "submissions").delete().eq("id", args.submission_id).select().single());

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

    case "list_settings": {
      const source = args?.source || "both";
      const result: Record<string, unknown> = {};
      if (source === "settings" || source === "both") {
        const { data, error } = await table(supabase, "settings").select("*");
        if (error) throw error;
        result.settings = data;
      }
      if (source === "app_settings" || source === "both") {
        const { data, error } = await table(supabase, "app_settings").select("*");
        if (error) throw error;
        result.app_settings = data;
      }
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
    case "set_setting": {
      const source = args?.source || "settings";
      const payload = { key: args.key, value: args.value, updated_at: new Date().toISOString() };
      return rowResult(table(supabase, source).upsert(payload).select().single());
    }
    case "delete_setting": return rowResult(table(supabase, args?.source || "settings").delete().eq("key", args.key).select().single());

    case "list_notification_logs": return rowResult(table(supabase, "notifications_log").select("*").order("sent_at", { ascending: false }).limit(limit));
    case "create_notification_log": return rowResult(table(supabase, "notifications_log").insert([stripUndefined(args)]).select().single());
    case "delete_notification_log": return rowResult(table(supabase, "notifications_log").delete().eq("id", args.notification_id).select().single());

    case "list_team_members": return rowResult(table(supabase, "team_members").select("*").order("created_at"));
    case "create_team_member": return rowResult(table(supabase, "team_members").insert([stripUndefined(args)]).select().single());
    case "update_team_member": {
      const { team_member_id, ...patch } = args || {};
      return rowResult(table(supabase, "team_members").update(stripUndefined(patch)).eq("id", team_member_id).select().single());
    }
    case "delete_team_member": return rowResult(table(supabase, "team_members").delete().eq("id", args.team_member_id).select().single());

    case "list_push_subscriptions":
      return rowResult(table(supabase, "push_subscriptions").select("id, endpoint, created_at").order("created_at", { ascending: false }).limit(limit));
    case "delete_push_subscription": return rowResult(table(supabase, "push_subscriptions").delete().eq("id", args.subscription_id).select().single());

    default:
      throw new Error(`Tool not found: ${name}`);
  }
}

async function handler(req: Request, supabase: any) {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  if (!(await authenticate(req, supabase))) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "content-type": "application/json", "WWW-Authenticate": "Bearer" },
    });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ jsonrpc: "2.0", error: { code: -32700, message: "Parse error" }, id: null }), {
      status: 400,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  const handle = async (rpc: any) => {
    const { method, params, id } = rpc || {};
    try {
      if (method === "initialize") {
        return {
          jsonrpc: "2.0",
          id,
          result: {
            protocolVersion: "2025-06-18",
            capabilities: { tools: { listChanged: false }, resources: {}, prompts: {}, logging: {} },
            serverInfo: { name: "student-management-mcp-full-control", version: "1.0.0" },
          },
        };
      }
      if (method === "notifications/initialized") return null;
      if (method === "ping") return { jsonrpc: "2.0", id, result: {} };
      if (method === "tools/list") return { jsonrpc: "2.0", id, result: { tools: TOOLS } };
      if (method === "resources/list") return { jsonrpc: "2.0", id, result: { resources: [] } };
      if (method === "prompts/list") return { jsonrpc: "2.0", id, result: { prompts: [] } };
      if (method === "tools/call") {
        const result = await executeTool(params?.name, params?.arguments || {}, supabase);
        return { jsonrpc: "2.0", id, result };
      }
      return { jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${method}` } };
    } catch (error: any) {
      return { jsonrpc: "2.0", id, error: { code: -32603, message: error?.message || "Internal error" } };
    }
  };

  if (Array.isArray(body)) {
    const replies = (await Promise.all(body.map(handle))).filter(Boolean);
    return new Response(JSON.stringify(replies), { headers: { ...corsHeaders, "content-type": "application/json" } });
  }

  const reply = await handle(body);
  return new Response(JSON.stringify(reply), { headers: { ...corsHeaders, "content-type": "application/json" } });
}

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceKey) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are required");
    const supabase = createClient(supabaseUrl, serviceKey);
    return await handler(req, supabase);
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error?.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }
});
