// ==========================================
// Local MCP Server (stdio transport)
// يُستخدم للاختبار المحلي مع Claude Desktop / VS Code MCP
// Run: npm run mcp:start
// ==========================================

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "";

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing Supabase env vars. Check .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize MCP Server
const server = new Server(
  {
    name: "batch-management-mcp-server",
    version: "2.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// ==========================================
// تعريف الأدوات
// ==========================================
const MCP_TOOLS = [
  {
    name: "get_pending_inquiries",
    description:
      "استرجاع قائمة استفسارات الطلاب المعلقة. يدعم تصفية حسب الحالة (new, in_progress, resolved, archived, all).",
    inputSchema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["new", "in_progress", "resolved", "archived", "all"],
          default: "new",
        },
        limit: { type: "integer", default: 50 },
      },
    },
  },
  {
    name: "suggest_inquiry_reply",
    description: "تسجيل رد مقترح من AI على استفسار طالب وتحديث حالته.",
    inputSchema: {
      type: "object",
      properties: {
        inquiry_id: { type: "string" },
        reply_text: { type: "string" },
        new_status: {
          type: "string",
          enum: ["in_progress", "resolved"],
          default: "in_progress",
        },
      },
      required: ["inquiry_id", "reply_text"],
    },
  },
  {
    name: "create_announcement",
    description: "نشر إعلان أكاديمي جديد للطلاب في المنصة.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        content: { type: "string" },
        category: {
          type: "string",
          enum: ["عاجل", "أكاديمي", "هام", "عام"],
          default: "عام",
        },
        is_pinned: { type: "boolean", default: false },
      },
      required: ["title", "content"],
    },
  },
  {
    name: "create_academic_task",
    description: "إضافة تكليف دراسي وتحديد deadline.",
    inputSchema: {
      type: "object",
      properties: {
        subject: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        deadline: { type: "string", description: "ISO 8601" },
      },
      required: ["subject", "title", "deadline"],
    },
  },
  {
    name: "get_batch_context",
    description: "تزويد الـ AI بسياق شامل عن الدفعة: آخر الإعلانات، المهام النشطة، الروابط.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_inquiry_stats",
    description: "إحصائيات الاستفسارات: العدد الإجمالي، الجديد، قيد المعالجة، المحلول.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "resolve_inquiry",
    description: "إغلاق استفسار وتعليمه كمحلول.",
    inputSchema: {
      type: "object",
      properties: {
        inquiry_id: { type: "string" },
        resolution_note: { type: "string" },
      },
      required: ["inquiry_id"],
    },
  },
];

// ==========================================
// Register Tools List Handler
// ==========================================
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: MCP_TOOLS };
});

// ==========================================
// تنفيذ الأدوات
// ==========================================
async function executeTool(name: string, args: any) {
  switch (name) {
    case "get_pending_inquiries": {
      const statusFilter = args?.status || "new";
      const limit = Math.min(args?.limit || 50, 200);
      let query = supabase.from("inquiries").select("*");
      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }
      const { data, error } = await query
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { status_filter: statusFilter, count: data?.length || 0, inquiries: data || [] },
              null,
              2
            ),
          },
        ],
      };
    }

    case "suggest_inquiry_reply": {
      const { inquiry_id, reply_text, new_status } = args as any;
      if (!inquiry_id || !reply_text) {
        throw new Error("inquiry_id و reply_text مطلوبان");
      }
      const { data, error } = await supabase
        .from("inquiries")
        .update({
          ai_suggestion: reply_text,
          status: new_status || "in_progress",
          updated_at: new Date().toISOString(),
        })
        .eq("id", inquiry_id)
        .select();

      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error(`لم يتم العثور على استفسار بالمعرف: ${inquiry_id}`);
      }
      return {
        content: [
          {
            type: "text",
            text: `✅ تم حفظ الرد المقترح بنجاح.\n\n${JSON.stringify(data[0], null, 2)}`,
          },
        ],
      };
    }

    case "create_announcement": {
      const { title, content, category, is_pinned } = args as any;
      if (!title?.trim() || !content?.trim()) {
        throw new Error("العنوان والمحتوى مطلوبان");
      }
      const { data, error } = await supabase
        .from("announcements")
        .insert([
          {
            title: title.trim(),
            content: content.trim(),
            category: category || "عام",
            is_pinned: Boolean(is_pinned),
          },
        ])
        .select();

      if (error) throw error;
      return {
        content: [
          {
            type: "text",
            text: `📢 تم نشر الإعلان بنجاح!\n\n${JSON.stringify(data?.[0] || {}, null, 2)}`,
          },
        ],
      };
    }

    case "create_academic_task": {
      const { subject, title, description, deadline } = args as any;
      if (!subject?.trim() || !title?.trim() || !deadline) {
        throw new Error("subject, title, deadline مطلوبة");
      }
      const deadlineDate = new Date(deadline);
      if (isNaN(deadlineDate.getTime())) {
        throw new Error("صيغة deadline غير صالحة. استخدم ISO 8601");
      }
      const { data, error } = await supabase
        .from("tasks")
        .insert([
          {
            subject: subject.trim(),
            title: title.trim(),
            description: description?.trim() || "",
            deadline: deadlineDate.toISOString(),
            status: "active",
          },
        ])
        .select();

      if (error) throw error;
      return {
        content: [
          {
            type: "text",
            text: `📝 تم إضافة التكليف بنجاح لمادة "${subject}".\n\n${JSON.stringify(data?.[0] || {}, null, 2)}`,
          },
        ],
      };
    }

    case "get_batch_context": {
      const [announcementsRes, tasksRes, linksRes] = await Promise.all([
        supabase.from("announcements").select("*").order("created_at", { ascending: false }).limit(5),
        supabase.from("tasks").select("*").eq("status", "active").order("deadline", { ascending: true }),
        supabase.from("quick_links").select("*").order("order_index", { ascending: true }),
      ]);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                recent_announcements: announcementsRes.data || [],
                active_tasks: tasksRes.data || [],
                academic_links: linksRes.data || [],
                generated_at: new Date().toISOString(),
              },
              null,
              2
            ),
          },
        ],
      };
    }

    case "get_inquiry_stats": {
      const { data, error } = await supabase.rpc("get_inquiry_stats");
      if (error) {
        // fallback
        const { data: inquiries } = await supabase.from("inquiries").select("status");
        const stats = {
          total_count: inquiries?.length || 0,
          new_count: inquiries?.filter((i: any) => i.status === "new").length || 0,
          in_progress_count: inquiries?.filter((i: any) => i.status === "in_progress").length || 0,
          resolved_count: inquiries?.filter((i: any) => i.status === "resolved").length || 0,
        };
        return { content: [{ type: "text", text: JSON.stringify(stats, null, 2) }] };
      }
      return { content: [{ type: "text", text: JSON.stringify(data?.[0] || data, null, 2) }] };
    }

    case "resolve_inquiry": {
      const { inquiry_id, resolution_note } = args as any;
      if (!inquiry_id) throw new Error("inquiry_id مطلوب");
      const updateData: any = {
        status: "resolved",
        updated_at: new Date().toISOString(),
      };
      if (resolution_note) {
        updateData.ai_suggestion = resolution_note;
      }
      const { data, error } = await supabase
        .from("inquiries")
        .update(updateData)
        .eq("id", inquiry_id)
        .select();

      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error(`لم يتم العثور على استفسار بالمعرف: ${inquiry_id}`);
      }
      return {
        content: [
          {
            type: "text",
            text: `✅ تم إغلاق الاستفسار وتعليمه كمحلول.\n\n${JSON.stringify(data[0], null, 2)}`,
          },
        ],
      };
    }

    default:
      throw new Error(`Tool not found: ${name}`);
  }
}

// ==========================================
// Call Tool Handler
// ==========================================
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    const result = await executeTool(name, args);
    return result;
  } catch (error: any) {
    return {
      content: [
        {
          type: "text",
          text: `❌ خطأ أثناء تنفيذ أداة MCP "${name}": ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

// ==========================================
// Start Server
// ==========================================
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("✅ Batch Management MCP Server (stdio) is running on v2.0.0");
  console.error(`   Connected to Supabase: ${supabaseUrl}`);
  console.error(`   Tools available: ${MCP_TOOLS.length}`);
  console.error(`   Tools: ${MCP_TOOLS.map((t) => t.name).join(", ")}`);
}

main().catch((err) => {
  console.error("Fatal error starting MCP Server:", err);
  process.exit(1);
});
