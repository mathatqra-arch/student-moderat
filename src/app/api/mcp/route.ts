import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabaseClient() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "https://apcxwxnkntegbkimsmty.supabase.co";
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "placeholder";

  return createClient(supabaseUrl, supabaseKey);
}

// Verify Bearer Token or Generated API Key against Supabase DB
async function verifyAuth(request: Request): Promise<boolean> {
  const authHeader = request.headers.get("Authorization");
  const apiKeyHeader = request.headers.get("x-api-key");

  let token = "";
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.substring(7).trim();
  } else if (apiKeyHeader) {
    token = apiKeyHeader.trim();
  }

  // 1. Check statically configured env keys (service role, anon key, or MCP_SECRET_TOKEN)
  const envSecretToken = process.env.MCP_SECRET_TOKEN || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (token && (token === envSecretToken || token === process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
    return true;
  }

  // 2. Check generated API Key in database api_keys table
  if (token) {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("api_keys")
        .select("id")
        .eq("key_value", token)
        .single();

      if (!error && data) {
        await supabase
          .from("api_keys")
          .update({ last_used_at: new Date().toISOString() })
          .eq("id", data.id);
        return true;
      }
    } catch (err) {
      console.error("API Key verification error:", err);
    }
  }

  // Fallback: Allow initial setup if no secret token configured
  if (!token && !process.env.MCP_SECRET_TOKEN) {
    return true;
  }

  return false;
}

// GET: Server Probe & Discovery Metadata
export async function GET(request: Request) {
  const host = request.headers.get("host") || "student-moderat.mathatqra.workers.dev";
  const protocol = request.headers.get("x-forwarded-proto") || "https";
  const baseUrl = `${protocol}://${host}`;

  return NextResponse.json({
    status: "online",
    name: "Student Management MCP Server",
    version: "1.0.0",
    protocolVersion: "2024-11-05",
    authentication: {
      types_supported: ["api_key", "bearer", "oauth2"],
      oauth2: {
        authorization_endpoint: `${baseUrl}/api/mcp/oauth/authorize`,
        token_endpoint: `${baseUrl}/api/mcp/oauth/token`,
      },
      api_key_header: "Authorization: Bearer <bmp_key_...>",
    },
    openapi_schema: `${baseUrl}/api/mcp/openapi.json`,
  });
}

export async function POST(request: Request) {
  // 1. Check Authentication
  const isAuthorized = await verifyAuth(request);
  if (!isAuthorized) {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        error: {
          code: -32001,
          message: "Unauthorized: Invalid ChatGPT API Key or Bearer Token",
        },
        id: null,
      },
      { status: 401 }
    );
  }

  try {
    const supabase = getSupabaseClient();
    const body = await request.json();
    const { jsonrpc, method, params, id } = body;

    // Handle MCP Protocol "initialize" method
    if (method === "initialize") {
      return NextResponse.json({
        jsonrpc: "2.0",
        result: {
          protocolVersion: "2024-11-05",
          capabilities: {
            tools: {},
          },
          serverInfo: {
            name: "student-management-mcp",
            version: "1.0.0",
          },
        },
        id,
      });
    }

    // Handle MCP Protocol "notifications/initialized"
    if (method === "notifications/initialized") {
      return new Response(null, { status: 204 });
    }

    // Handle MCP Tools Discovery Request (tools/list)
    if (method === "tools/list") {
      return NextResponse.json({
        jsonrpc: "2.0",
        result: {
          tools: [
            {
              name: "get_pending_inquiries",
              description: "استرجاع استفسارات الطلاب المعلقة والحالية",
              inputSchema: {
                type: "object",
                properties: {
                  status: {
                    type: "string",
                    description: "الحالة: new, in_progress, resolved, all",
                  },
                },
              },
            },
            {
              name: "suggest_inquiry_reply",
              description: "إضافة الرد المقترح وتحديث حالة طلب الطالب",
              inputSchema: {
                type: "object",
                properties: {
                  inquiry_id: { type: "string" },
                  reply_text: { type: "string" },
                  new_status: { type: "string" },
                },
                required: ["inquiry_id", "reply_text"],
              },
            },
            {
              name: "create_announcement",
              description: "نشر إعلان عاجل أو أكاديمي للطلاب",
              inputSchema: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  content: { type: "string" },
                  category: { type: "string" },
                  is_pinned: { type: "boolean" },
                },
                required: ["title", "content"],
              },
            },
            {
              name: "create_academic_task",
              description: "إضافة تكليف أكاديمي وتحديد Deadline",
              inputSchema: {
                type: "object",
                properties: {
                  subject: { type: "string" },
                  title: { type: "string" },
                  description: { type: "string" },
                  deadline: { type: "string" },
                },
                required: ["subject", "title", "deadline"],
              },
            },
            {
              name: "get_batch_context",
              description: "استرجاع سياق المواد والجداول الرسمية",
              inputSchema: {
                type: "object",
                properties: {},
              },
            },
          ],
        },
        id,
      });
    }

    // Handle MCP Tool Call Execution (tools/call)
    if (method === "tools/call") {
      const { name, arguments: args } = params || {};

      if (name === "get_pending_inquiries") {
        const statusFilter = args?.status || "new";
        let query = supabase.from("inquiries").select("*");
        if (statusFilter !== "all") {
          query = query.eq("status", statusFilter);
        }
        const { data, error } = await query.order("created_at", { ascending: false });

        if (error) throw error;
        return NextResponse.json({
          jsonrpc: "2.0",
          result: {
            content: [
              {
                type: "text",
                text: JSON.stringify({ count: data?.length || 0, inquiries: data || [] }, null, 2),
              },
            ],
          },
          id,
        });
      }

      if (name === "suggest_inquiry_reply") {
        const { inquiry_id, reply_text, new_status } = args || {};
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
        return NextResponse.json({
          jsonrpc: "2.0",
          result: {
            content: [
              {
                type: "text",
                text: `تم تسجيل الرد المقترح بنجاح: ${JSON.stringify(data)}`,
              },
            ],
          },
          id,
        });
      }

      if (name === "create_announcement") {
        const { title, content, category, is_pinned } = args || {};
        const { data, error } = await supabase.from("announcements").insert([
          {
            title,
            content,
            category: category || "عام",
            is_pinned: is_pinned || false,
          },
        ]).select();

        if (error) throw error;
        return NextResponse.json({
          jsonrpc: "2.0",
          result: {
            content: [
              {
                type: "text",
                text: `تم نشر الإعلان بنجاح في المنصة: ${JSON.stringify(data)}`,
              },
            ],
          },
          id,
        });
      }

      if (name === "create_academic_task") {
        const { subject, title, description, deadline } = args || {};
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
        return NextResponse.json({
          jsonrpc: "2.0",
          result: {
            content: [
              {
                type: "text",
                text: `تم إضافة التكليف بنجاح: ${JSON.stringify(data)}`,
              },
            ],
          },
          id,
        });
      }

      if (name === "get_batch_context") {
        const announcements = await supabase.from("announcements").select("*").limit(5);
        const tasks = await supabase.from("tasks").select("*").eq("status", "active");
        const links = await supabase.from("quick_links").select("*");

        return NextResponse.json({
          jsonrpc: "2.0",
          result: {
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
          },
          id,
        });
      }
    }

    return NextResponse.json(
      {
        jsonrpc: "2.0",
        error: { code: -32601, message: "Method not found" },
        id,
      },
      { status: 404 }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        error: { code: -32603, message: error.message },
        id: null,
      },
      { status: 500 }
    );
  }
}
