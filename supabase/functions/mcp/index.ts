// ==========================================
// Supabase Edge Function: MCP Server
// Production-ready MCP HTTP server with OAuth + API key auth
// Version: 2.0.0
// Deploy: supabase functions deploy mcp --no-verify-jwt
// ==========================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key, mcp-session-id, accept",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Expose-Headers": "mcp-session-id",
};

// تعريف أدوات MCP
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
    description: "تسجيل رد مقترح على استفسار طالب وتحديث حالته.",
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
    description: "نشر إعلان أكاديمي جديد للطلاب.",
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
        deadline: { type: "string", description: "ISO 8601 format" },
      },
      required: ["subject", "title", "deadline"],
    },
  },
  {
    name: "get_batch_context",
    description: "تزويد الـ AI بسياق شامل: آخر الإعلانات، المهام النشطة، الروابط.",
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
// تنفيذ الأدوات
// ==========================================
async function executeTool(supabase: any, name: string, args: any) {
  switch (name) {
    case "get_pending_inquiries": {
      const statusFilter = args?.status || "new";
      const limit = Math.min(args?.limit || 50, 200);
      let query = supabase.from("inquiries").select("*");
      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }
      const { data, error } = await query.order("created_at", { ascending: false }).limit(limit);
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
      const { inquiry_id, reply_text, new_status } = args || {};
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
      const { title, content, category, is_pinned } = args || {};
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
      const { subject, title, description, deadline } = args || {};
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
      const { inquiry_id, resolution_note } = args || {};
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
// المصادقة
// ==========================================
async function verifyAuth(req: Request, supabase: any): Promise<{ authorized: boolean; reason?: string }> {
  const authHeader = req.headers.get("Authorization");
  const apiKeyHeader = req.headers.get("x-api-key");

  let token = "";
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.substring(7).trim();
  } else if (apiKeyHeader) {
    token = apiKeyHeader.trim();
  }

  if (!token) {
    return { authorized: false, reason: "missing_token" };
  }

  // 1. تحقق من MCP_SECRET_TOKEN (للاختبار)
  const secretToken = Deno.env.get("MCP_SECRET_TOKEN");
  if (secretToken && token === secretToken) {
    return { authorized: true };
  }

  // 2. تحقق من api_keys في قاعدة البيانات (مع استبعاد المفاتيح الملغاة)
  try {
    const { data, error } = await supabase
      .from("api_keys")
      .select("id, name, revoked_at")
      .eq("key_value", token)
      .is("revoked_at", null)
      .single();

    if (error || !data) {
      return { authorized: false, reason: "invalid_or_revoked_key" };
    }

    // تحديث آخر استخدام
    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      "unknown";

    await supabase
      .from("api_keys")
      .update({
        last_used_at: new Date().toISOString(),
        last_used_ip: clientIp,
      })
      .eq("id", data.id);

    return { authorized: true };
  } catch (err) {
    console.error("Auth error:", err);
    return { authorized: false, reason: "verification_error" };
  }
}

// ==========================================
// معالج JSON-RPC
// ==========================================
function jsonResponse(body: any, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      ...extraHeaders,
    },
  });
}

function errorResponse(code: number, message: string, id: any = null, status = 400) {
  return jsonResponse(
    {
      jsonrpc: "2.0",
      error: { code, message },
      id,
    },
    status
  );
}

async function handleRequest(req: Request, supabase: any) {
  const url = new URL(req.url);

  // GET: Discovery endpoint
  if (req.method === "GET") {
    const baseUrl = `${url.protocol}//${url.host}`;
    return jsonResponse({
      status: "online",
      name: "Student Management MCP Server",
      version: "2.0.0",
      protocolVersion: "2025-03-26",
      capabilities: {
        tools: { listChanged: false },
        resources: {},
        prompts: {},
      },
      authentication: {
        types_supported: ["api_key", "bearer", "oauth2"],
        api_key_header: "Authorization: Bearer <bmp_key_...>",
        oauth2: {
          authorization_endpoint: `${baseUrl}/api/mcp/oauth/authorize`,
          token_endpoint: `${baseUrl}/api/mcp/oauth/token`,
        },
      },
      tools_count: MCP_TOOLS.length,
      timestamp: new Date().toISOString(),
    });
  }

  // POST: JSON-RPC request
  if (req.method === "POST") {
    const authResult = await verifyAuth(req, supabase);
    if (!authResult.authorized) {
      return errorResponse(
        -32001,
        authResult.reason === "missing_token"
          ? "Unauthorized: مطلوب Authorization Bearer أو x-api-key"
          : authResult.reason === "invalid_or_revoked_key"
          ? "Unauthorized: مفتاح غير صالح أو ملغي"
          : "Unauthorized: فشل التحقق",
        null,
        401
      );
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return errorResponse(-32700, "Parse error: invalid JSON", null, 400);
    }

    // Batch support
    if (Array.isArray(body)) {
      const results = await Promise.all(body.map((req) => handleSingleJsonRpc(req, supabase)));
      return jsonResponse(results);
    }

    return handleSingleJsonRpc(body, supabase);
  }

  // DELETE: cleanup (no-op since we're stateless)
  if (req.method === "DELETE") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  return errorResponse(-32601, "Method not allowed", null, 405);
}

async function handleSingleJsonRpc(body: any, supabase: any): Promise<Response> {
  const { jsonrpc, method, params, id } = body;

  if (jsonrpc && jsonrpc !== "2.0") {
    return errorResponse(-32600, `Invalid jsonrpc version: ${jsonrpc}`, id);
  }

  switch (method) {
    case "initialize":
      return jsonResponse({
        jsonrpc: "2.0",
        result: {
          protocolVersion: "2025-03-26",
          capabilities: { tools: { listChanged: false }, resources: {}, prompts: {} },
          serverInfo: { name: "student-management-mcp", version: "2.0.0" },
        },
        id,
      });

    case "notifications/initialized":
      return new Response(null, { status: 202, headers: corsHeaders });

    case "ping":
      return jsonResponse({ jsonrpc: "2.0", result: {}, id });

    case "tools/list":
      return jsonResponse({ jsonrpc: "2.0", result: { tools: MCP_TOOLS }, id });

    case "tools/call": {
      const { name, arguments: args } = params || {};
      try {
        const result = await executeTool(supabase, name, args);
        return jsonResponse({ jsonrpc: "2.0", result, id });
      } catch (error: any) {
        return jsonResponse({
          jsonrpc: "2.0",
          error: {
            code: -32000,
            message: `Tool execution failed: ${error.message}`,
            data: { tool_name: name },
          },
          id,
        });
      }
    }

    case "resources/list":
      return jsonResponse({ jsonrpc: "2.0", result: { resources: [] }, id });

    case "prompts/list":
      return jsonResponse({ jsonrpc: "2.0", result: { prompts: [] }, id });

    default:
      return errorResponse(-32601, `Method not found: ${method}`, id, 404);
  }
}

// ==========================================
// نقطة الدخول الرئيسية
// ==========================================
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    return await handleRequest(req, supabase);
  } catch (err: any) {
    console.error("Unhandled error:", err);
    return errorResponse(-32603, `Internal error: ${err.message}`, null, 500);
  }
});
