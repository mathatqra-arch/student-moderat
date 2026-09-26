import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

// ==========================================
// MCP HTTP Server (Streamable HTTP Transport)
// يدعم: JSON-RPC over HTTP + SSE للـ streaming
// ==========================================

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://apcxwxnkntegbkimsmty.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// جلسات MCP النشطة (في الإنتاج: استخدم Redis أو DB)
// Key: sessionId, Value: { createdAt, lastActivity }
const mcpSessions = new Map<string, { createdAt: number; lastActivity: number }>();
const SESSION_TTL_MS = 60 * 60 * 1000; // ساعة واحدة

function getSupabaseClient() {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

// ==========================================
// المصادقة - تحقق من Bearer Token أو API Key
// ==========================================
async function verifyAuth(request: Request): Promise<{ authorized: boolean; reason?: string; keyId?: string }> {
  const authHeader = request.headers.get("Authorization");
  const apiKeyHeader = request.headers.get("x-api-key");

  let token = "";
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.substring(7).trim();
  } else if (apiKeyHeader) {
    token = apiKeyHeader.trim();
  }

  // ❌ لا مصادقة = رفض (تم إزالة الثغرة السابقة)
  if (!token) {
    return { authorized: false, reason: "missing_token" };
  }

  // 1. تحقق من MCP_SECRET_TOKEN (للاختبار المحلي)
  const secretToken = process.env.MCP_SECRET_TOKEN;
  if (secretToken && token === secretToken) {
    return { authorized: true };
  }

  // 2. تحقق من api_keys في قاعدة البيانات
  try {
    const supabase = getSupabaseClient();
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
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("cf-connecting-ip") ||
      "unknown";

    await supabase
      .from("api_keys")
      .update({
        last_used_at: new Date().toISOString(),
        last_used_ip: clientIp,
      })
      .eq("id", data.id);

    return { authorized: true, keyId: data.id };
  } catch (err) {
    console.error("Auth verification error:", err);
    return { authorized: false, reason: "verification_error" };
  }
}

// ==========================================
// تعريف أدوات MCP المتاحة
// ==========================================
const MCP_TOOLS = [
  {
    name: "get_pending_inquiries",
    description:
      "استرجاع قائمة استفسارات الطلاب المعلقة. يدعم تصفية حسب الحالة (new, in_progress, resolved, archived, all). يعيد رقم هاتف الطالب ونوع المشكلة والرد المقترح.",
    inputSchema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["new", "in_progress", "resolved", "archived", "all"],
          description: "حالة الاستفسار: new (جديد)، in_progress (قيد المعالجة)، resolved (محلول)، archived (مؤرشف)، all (الكل)",
          default: "new",
        },
        limit: {
          type: "integer",
          description: "الحد الأقصى للنتائج (افتراضي 50)",
          default: 50,
        },
      },
    },
  },
  {
    name: "suggest_inquiry_reply",
    description:
      "تسجيل رد مقترح من الذكاء الاصطناعي على استفسار طالب وتحديث حالته في المنصة. الرد يظهر للأدمن لمراجعته قبل الإرسال للطالب.",
    inputSchema: {
      type: "object",
      properties: {
        inquiry_id: {
          type: "string",
          description: "معرف الاستفسار (UUID)",
        },
        reply_text: {
          type: "string",
          description: "نص الرد المقترح للطالب",
        },
        new_status: {
          type: "string",
          enum: ["in_progress", "resolved"],
          description: "الحالة الجديدة للاستفسار",
          default: "in_progress",
        },
      },
      required: ["inquiry_id", "reply_text"],
    },
  },
  {
    name: "create_announcement",
    description:
      "نشر إعلان أكاديمي جديد للطلاب. يظهر فوراً في واجهة الطلاب PWA ويمكن تثبيته في الأعلى.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "عنوان الإعلان" },
        content: { type: "string", description: "نص الإعلان التفصيلي" },
        category: {
          type: "string",
          enum: ["عاجل", "أكاديمي", "هام", "عام"],
          description: "تصنيف الإعلان",
          default: "عام",
        },
        is_pinned: {
          type: "boolean",
          description: "تثبيت في أعلى واجهة الطلاب",
          default: false,
        },
      },
      required: ["title", "content"],
    },
  },
  {
    name: "create_academic_task",
    description:
      "إضافة تكليف أو واجب دراسي جديد وتحديد موعد التسليم النهائي. يظهر للطلاب في قسم 'التكليفات'.",
    inputSchema: {
      type: "object",
      properties: {
        subject: { type: "string", description: "اسم المادة الدراسية" },
        title: { type: "string", description: "عنوان التكليف" },
        description: {
          type: "string",
          description: "تفاصيل وشروط التسليم",
        },
        deadline: {
          type: "string",
          description: "موعد التسليم النهائي بصيغة ISO 8601 (مثال: 2026-10-01T23:59:00Z)",
        },
      },
      required: ["subject", "title", "deadline"],
    },
  },
  {
    name: "get_batch_context",
    description:
      "تزويد نموذج الذكاء الاصطناعي بسياق شامل عن حالة الدفعة: آخر الإعلانات، المهام النشطة، والروابط الأكاديمية. استخدمها قبل توليد الردود.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_inquiry_stats",
    description:
      "استرجاع إحصائيات الاستفسارات: العدد الإجمالي، الجديد، قيد المعالجة، المحلول. مفيد للتقارير السريعة.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "resolve_inquiry",
    description:
      "إغلاق استفسار وتعليمه كمحلول بعد التأكد من حل مشكلة الطالب. يمكن إضافة ملاحظة الإغلاق.",
    inputSchema: {
      type: "object",
      properties: {
        inquiry_id: { type: "string", description: "معرف الاستفسار" },
        resolution_note: {
          type: "string",
          description: "ملاحظة اختيارية عن كيفية الحل",
        },
      },
      required: ["inquiry_id"],
    },
  },
];

// ==========================================
// تنفيذ أدوات MCP
// ==========================================
async function executeTool(name: string, args: any): Promise<{ content: any[]; isError?: boolean }> {
  const supabase = getSupabaseClient();

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
              {
                status_filter: statusFilter,
                count: data?.length || 0,
                inquiries: data || [],
              },
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
            text: `✅ تم حفظ الرد المقترح بنجاح وتحديث حالة الاستفسار إلى "${new_status || "in_progress"}".\n\nالاستفسار المحدّث:\n${JSON.stringify(data[0], null, 2)}`,
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
            text: `📢 تم نشر الإعلان بنجاح!\n\nالتفاصيل:\n${JSON.stringify(data?.[0] || {}, null, 2)}\n\nسيظهر الإعلان فوراً في واجهة الطلاب PWA.`,
          },
        ],
      };
    }

    case "create_academic_task": {
      const { subject, title, description, deadline } = args || {};
      if (!subject?.trim() || !title?.trim() || !deadline) {
        throw new Error("subject, title, deadline مطلوبة");
      }
      // تحقق من صحة التاريخ
      const deadlineDate = new Date(deadline);
      if (isNaN(deadlineDate.getTime())) {
        throw new Error("صيغة deadline غير صالحة. استخدم ISO 8601 مثل: 2026-10-01T23:59:00Z");
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
            text: `📝 تم إضافة التكليف بنجاح لمادة "${subject}".\n\nالتفاصيل:\n${JSON.stringify(data?.[0] || {}, null, 2)}`,
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
        // fallback للإحصاء اليدوي إذا لم تتوفر الدالة
        const { data: inquiries } = await supabase.from("inquiries").select("status");
        const stats = {
          total_count: inquiries?.length || 0,
          new_count: inquiries?.filter((i: any) => i.status === "new").length || 0,
          in_progress_count: inquiries?.filter((i: any) => i.status === "in_progress").length || 0,
          resolved_count: inquiries?.filter((i: any) => i.status === "resolved").length || 0,
        };
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(stats, null, 2),
            },
          ],
        };
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(data?.[0] || data, null, 2),
          },
        ],
      };
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
            text: `✅ تم إغلاق الاستفسار وتعليمه كمحلول.\n\nالاستفسار:\n${JSON.stringify(data[0], null, 2)}`,
          },
        ],
      };
    }

    default:
      throw new Error(`Tool not found: ${name}`);
  }
}

// ==========================================
// تنظيف الجلسات المنتهية
// ==========================================
function cleanupExpiredSessions() {
  const now = Date.now();
  for (const [sessionId, session] of mcpSessions.entries()) {
    if (now - session.lastActivity > SESSION_TTL_MS) {
      mcpSessions.delete(sessionId);
    }
  }
}

// ==========================================
// GET: Server Probe & Discovery Metadata
// ==========================================
export async function GET(request: Request) {
  const host = request.headers.get("host") || "localhost:3000";
  const protocol = host.includes("localhost") ? "http" : "https";
  const baseUrl = `${protocol}://${host}`;

  // إذا طلب العميل SSE — ابدأ جلسة SSE
  const acceptHeader = request.headers.get("accept") || "";
  if (acceptHeader.includes("text/event-stream")) {
    const sessionId = randomUUID();
    mcpSessions.set(sessionId, { createdAt: Date.now(), lastActivity: Date.now() });

    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        // إرسال endpoint event كما يتوقع MCP client
        const initEvent = `event: endpoint\ndata: ${baseUrl}/api/mcp?sessionId=${sessionId}\n\n`;
        controller.enqueue(encoder.encode(initEvent));

        // Keep-alive كل 30 ثانية
        const keepAlive = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(`: keepalive\n\n`));
          } catch {
            clearInterval(keepAlive);
          }
        }, 30000);

        // تنظيف عند الإغلاق
        const cleanup = () => {
          clearInterval(keepAlive);
          mcpSessions.delete(sessionId);
          try {
            controller.close();
          } catch {}
        };

        // إغلاق بعد انتهاء الجلسة (1 ساعة)
        setTimeout(cleanup, SESSION_TTL_MS);
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "Mcp-Session-Id": sessionId,
      },
    });
  }

  // استجابة JSON للـ discovery
  return NextResponse.json({
    status: "online",
    name: "Student Management MCP Server",
    version: "2.0.0",
    protocolVersion: "2025-06-18",
    capabilities: {
      tools: { listChanged: false },
      resources: {},
      prompts: {},
      logging: {},
    },
    authentication: {
      types_supported: ["api_key", "bearer", "oauth2"],
      schemes: {
        bearer: {
          type: "http",
          scheme: "bearer",
          description: "استخدم Authorization: Bearer <bmp_key_...>",
        },
        api_key: {
          type: "apiKey",
          in: "header",
          name: "x-api-key",
          description: "أو استخدم x-api-key: <bmp_key_...>",
        },
        oauth2: {
          type: "oauth2",
          flows: {
            authorizationCode: {
              authorizationUrl: `${baseUrl}/api/mcp/oauth/authorize`,
              tokenUrl: `${baseUrl}/api/mcp/oauth/token`,
              scopes: {},
            },
          },
        },
      },
    },
    endpoints: {
      mcp: `${baseUrl}/api/mcp`,
      openapi: `${baseUrl}/api/mcp/openapi.json`,
      health: `${baseUrl}/api/health`,
    },
    tools_count: MCP_TOOLS.length,
  });
}

// ==========================================
// POST: Handle JSON-RPC 2.0 requests
// ==========================================
export async function POST(request: Request) {
  // 1. التحقق من المصادقة
  const authResult = await verifyAuth(request);
  if (!authResult.authorized) {
    // RFC 9728: إرجاع WWW-Authenticate header مع resource_metadata URL
    const host = request.headers.get("host") || "student-moderat.mathatqra.workers.dev";
    const proto = request.headers.get("x-forwarded-proto") || "https";
    const metaUrl = `${proto}://${host}/.well-known/oauth-protected-resource`;

    return new NextResponse(
      JSON.stringify({
        jsonrpc: "2.0",
        error: { code: -32001, message: "Unauthorized" },
        id: null,
      }),
      {
        status: 401,
        headers: {
          "WWW-Authenticate": `Bearer resource_metadata="${metaUrl}"`,
          "Content-Type": "application/json",
        },
      }
    );
  }

  try {
    const body = await request.json();

    // دعم JSON-RPC batch requests
    if (Array.isArray(body)) {
      const results = await Promise.all(body.map((req) => handleSingleRequest(req)));
      return NextResponse.json(results);
    }

    return await handleSingleRequest(body);
  } catch (error: any) {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        error: {
          code: -32700,
          message: "Parse error: " + (error.message || "Invalid JSON"),
        },
        id: null,
      },
      { status: 400 }
    );
  }
}

// ==========================================
// معالج طلب JSON-RPC واحد
// ==========================================
async function handleSingleRequest(body: any): Promise<NextResponse> {
  const { jsonrpc, method, params, id } = body;

  // التحقق من jsonrpc version
  if (jsonrpc && jsonrpc !== "2.0") {
    return NextResponse.json({
      jsonrpc: "2.0",
      error: { code: -32600, message: `Invalid jsonrpc version: ${jsonrpc}` },
      id: id ?? null,
    });
  }

  // 1. initialize
  if (method === "initialize") {
    const sessionId = randomUUID();
    mcpSessions.set(sessionId, { createdAt: Date.now(), lastActivity: Date.now() });
    cleanupExpiredSessions();

    const response = NextResponse.json({
      jsonrpc: "2.0",
      result: {
        protocolVersion: "2025-06-18",
        capabilities: {
          tools: { listChanged: false },
          resources: {},
          prompts: {},
          logging: {},
        },
        serverInfo: {
          name: "student-management-mcp",
          version: "2.0.0",
        },
      },
      id,
    });
    response.headers.set("Mcp-Session-Id", sessionId);
    return response;
  }

  // 2. notifications/initialized
  if (method === "notifications/initialized") {
    return new NextResponse(null, { status: 202 });
  }

  // 3. ping
  if (method === "ping") {
    return NextResponse.json({ jsonrpc: "2.0", result: {}, id });
  }

  // 4. tools/list
  if (method === "tools/list") {
    return NextResponse.json({
      jsonrpc: "2.0",
      result: { tools: MCP_TOOLS },
      id,
    });
  }

  // 5. tools/call
  if (method === "tools/call") {
    const { name, arguments: args } = params || {};
    try {
      const result = await executeTool(name, args);
      return NextResponse.json({
        jsonrpc: "2.0",
        result,
        id,
      });
    } catch (error: any) {
      return NextResponse.json({
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

  // 6. resources/list (مدعوم نظرياً لكن لا موارد لدينا)
  if (method === "resources/list") {
    return NextResponse.json({
      jsonrpc: "2.0",
      result: { resources: [] },
      id,
    });
  }

  // 7. prompts/list
  if (method === "prompts/list") {
    return NextResponse.json({
      jsonrpc: "2.0",
      result: { prompts: [] },
      id,
    });
  }

  // غير معروف
  return NextResponse.json(
    {
      jsonrpc: "2.0",
      error: { code: -32601, message: `Method not found: ${method}` },
      id,
    },
    { status: 404 }
  );
}

// ==========================================
// DELETE: إنهاء جلسة MCP
// ==========================================
export async function DELETE(request: Request) {
  const sessionId = request.headers.get("mcp-session-id");
  if (sessionId) {
    mcpSessions.delete(sessionId);
  }
  return new Response(null, { status: 204 });
}
