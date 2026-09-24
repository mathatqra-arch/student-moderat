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
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize MCP Server
const server = new Server(
  {
    name: "batch-management-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register MCP Tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_pending_inquiries",
        description: "استرجاع قائمة استفسارات ومشاكل الطلاب الحالية المعلقة برقم الهوية ونصف المشكلة",
        inputSchema: {
          type: "object",
          properties: {
            status: {
              type: "string",
              description: "حالة الطلب: new (جديد) أو in_progress (قيد المعالجة) أو all (الكل)",
            },
          },
        },
      },
      {
        name: "suggest_inquiry_reply",
        description: "إضافة الرد الموصى به من شات جي بي تي وتحديث حالة استفسار الطالب في المنصة",
        inputSchema: {
          type: "object",
          properties: {
            inquiry_id: { type: "string", description: "معرف الاستفسار (ID)" },
            reply_text: { type: "string", description: "نص الرد المقترح للطالب" },
            new_status: {
              type: "string",
              description: "الحالة الجديدة: resolved أو in_progress",
            },
          },
          required: ["inquiry_id", "reply_text"],
        },
      },
      {
        name: "create_announcement",
        description: "نشر إعلان أكاديمي أو هام جديد للطلاب مباشرة في المنصة",
        inputSchema: {
          type: "object",
          properties: {
            title: { type: "string", description: "عنوان الإعلان" },
            content: { type: "string", description: "محتوى الإعلان" },
            category: {
              type: "string",
              description: "عاجل، أكاديمي، هام، أو عام",
            },
            is_pinned: { type: "boolean", description: "تثبيت في أعلى الواجهة" },
          },
          required: ["title", "content"],
        },
      },
      {
        name: "create_academic_task",
        description: "إضافة تكليف أو واجب دراسي جديد وتحديد موعد التسليم النهائي للطلاب",
        inputSchema: {
          type: "object",
          properties: {
            subject: { type: "string", description: "اسم المادة الدراسية" },
            title: { type: "string", description: "عنوان التكليف" },
            description: { type: "string", description: "تفاصيل التسليم والشروط" },
            deadline: {
              type: "string",
              description: "موعد التسليم النهائي بصيغة ISO (مثال: 2026-10-01T23:59:00Z)",
            },
          },
          required: ["subject", "title", "deadline"],
        },
      },
      {
        name: "get_batch_context",
        description: "تزويد شات جي بي تي بالمعلومات المحدثة والجداول للتأكد من دقة الإجابات",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
    ],
  };
});

// Handle Tool Call Execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "get_pending_inquiries") {
      const statusFilter = (args as any)?.status || "new";
      let query = supabase.from("inquiries").select("*");
      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }
      const { data, error } = await query.order("created_at", { ascending: false });

      if (error) throw error;
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ count: data?.length || 0, inquiries: data || [] }, null, 2),
          },
        ],
      };
    }

    if (name === "suggest_inquiry_reply") {
      const { inquiry_id, reply_text, new_status } = args as any;
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
      return {
        content: [
          {
            type: "text",
            text: `تم حفظ اقتراح الرد وتحديث حالة الطلب بنجاح: ${JSON.stringify(data)}`,
          },
        ],
      };
    }

    if (name === "create_announcement") {
      const { title, content, category, is_pinned } = args as any;
      const { data, error } = await supabase.from("announcements").insert([
        {
          title,
          content,
          category: category || "عام",
          is_pinned: is_pinned || false,
        },
      ]).select();

      if (error) throw error;
      return {
        content: [
          {
            type: "text",
            text: `تم نشر الإعلان بنجاح في المنصة: ${JSON.stringify(data)}`,
          },
        ],
      };
    }

    if (name === "create_academic_task") {
      const { subject, title, description, deadline } = args as any;
      const { data, error } = await supabase.from("tasks").insert([
        {
          subject,
          title,
          description: description || "",
          deadline,
          status: "active",
        },
      ]).select();

      if (error) throw error;
      return {
        content: [
          {
            type: "text",
            text: `تم إضافة التكليف بنجاح للمادة: ${JSON.stringify(data)}`,
          },
        ],
      };
    }

    if (name === "get_batch_context") {
      const announcements = await supabase.from("announcements").select("*").limit(5);
      const tasks = await supabase.from("tasks").select("*").eq("status", "active");
      const links = await supabase.from("quick_links").select("*");

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                recent_announcements: announcements.data || [],
                active_tasks: tasks.data || [],
                academic_links: links.data || [],
              },
              null,
              2
            ),
          },
        ],
      };
    }

    throw new Error(`Tool not found: ${name}`);
  } catch (error: any) {
    return {
      content: [
        {
          type: "text",
          text: `خطأ أثناء تنفيذ أداة MCP: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

// Start Server with Stdio Transport
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Batch Management MCP Server is running on stdio.");
}

main().catch((err) => {
  console.error("Fatal error starting MCP Server:", err);
  process.exit(1);
});
