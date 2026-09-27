// ==========================================
// Supabase Edge Function: MCP Server (v2.0.0)
// متوافق مع MCP 2025-06-18 Streamable HTTP + OAuth 2.1
// يدعم: RFC 9728 (Protected Resource Metadata) + RFC 8414 (AS Metadata) + RFC 7591 (DCR)
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
// أدوات MCP
// ==========================================
const MCP_TOOLS = [
  {
    name: "get_pending_inquiries",
    description: "استرجاع قائمة استفسارات الطلاب المعلقة. يدعم تصفية حسب الحالة.",
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
        new_status: { type: "string", enum: ["in_progress", "resolved"], default: "in_progress" },
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
        category: { type: "string", enum: ["عاجل", "أكاديمي", "هام", "عام"], default: "عام" },
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
    description: "تزويد الـ AI بسياق شامل عن الدفعة: آخر الإعلانات، المهام النشطة، الروابط.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_inquiry_stats",
    description: "إحصائيات الاستفسارات.",
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
      if (statusFilter !== "all") query = query.eq("status", statusFilter);
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
      if (!inquiry_id || !reply_text) throw new Error("inquiry_id و reply_text مطلوبان");
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
      if (!data || data.length === 0) throw new Error(`لم يتم العثور على استفسار: ${inquiry_id}`);
      return {
        content: [{ type: "text", text: `✅ تم حفظ الرد.\n\n${JSON.stringify(data[0], null, 2)}` }],
      };
    }

    case "create_announcement": {
      const { title, content, category, is_pinned } = args || {};
      if (!title?.trim() || !content?.trim()) throw new Error("العنوان والمحتوى مطلوبان");
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
        content: [{ type: "text", text: `📢 تم نشر الإعلان!\n\n${JSON.stringify(data?.[0] || {}, null, 2)}` }],
      };
    }

    case "create_academic_task": {
      const { subject, title, description, deadline } = args || {};
      if (!subject?.trim() || !title?.trim() || !deadline) throw new Error("subject, title, deadline مطلوبة");
      const deadlineDate = new Date(deadline);
      if (isNaN(deadlineDate.getTime())) throw new Error("صيغة deadline غير صالحة");
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
        content: [{ type: "text", text: `📝 تم إضافة التكليف.\n\n${JSON.stringify(data?.[0] || {}, null, 2)}` }],
      };
    }

    case "get_batch_context": {
      const [annRes, tasksRes, linksRes] = await Promise.all([
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
                recent_announcements: annRes.data || [],
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
      const updateData: any = { status: "resolved", updated_at: new Date().toISOString() };
      if (resolution_note) updateData.ai_suggestion = resolution_note;
      const { data, error } = await supabase
        .from("inquiries")
        .update(updateData)
        .eq("id", inquiry_id)
        .select();
      if (error) throw error;
      if (!data || data.length === 0) throw new Error(`لم يتم العثور على استفسار: ${inquiry_id}`);
      return {
        content: [{ type: "text", text: `✅ تم إغلاق الاستفسار.\n\n${JSON.stringify(data[0], null, 2)}` }],
      };
    }

    default:
      throw new Error(`Tool not found: ${name}`);
  }
}

// ==========================================
// المصادقة
// ==========================================
async function verifyAuth(req: Request, supabase: any): Promise<{ authorized: boolean }> {
  const authHeader = req.headers.get("Authorization");
  const apiKeyHeader = req.headers.get("x-api-key");

  let token = "";
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.substring(7).trim();
  } else if (apiKeyHeader) {
    token = apiKeyHeader.trim();
  }

  if (!token) return { authorized: false };

  // 1. MCP_SECRET_TOKEN
  const secretToken = Deno.env.get("MCP_SECRET_TOKEN");
  if (secretToken && token === secretToken) return { authorized: true };

  // 2. api_keys table
  try {
    const { data, error } = await supabase
      .from("api_keys")
      .select("id, name, revoked_at")
      .eq("key_value", token)
      .is("revoked_at", null)
      .single();

    if (error || !data) return { authorized: false };

    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

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
    return { authorized: false };
  }
}

// ==========================================
// Helper functions
// ==========================================
function jsonResponse(body: any, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...extraHeaders },
  });
}

function getBaseUrl(req: Request): string {
  const url = new URL(req.url);
  // Supabase Edge Functions بترجع http:// بدل https:// لأنها وراء proxy
  // نستخدم x-forwarded-proto header علشان نرجع الـ protocol الصحيح
  const proto = req.headers.get("x-forwarded-proto") || "https";
  return `${proto}://${url.host}`;
}

// ==========================================
// OAuth: Verify API Key
// ==========================================
async function verifyApiKey(supabase: any, apiKey: string): Promise<{ valid: boolean; keyId?: string; name?: string }> {
  if (!apiKey) return { valid: false };

  const secretToken = Deno.env.get("MCP_SECRET_TOKEN");
  if (secretToken && apiKey === secretToken) {
    return { valid: true, name: "MCP Secret Token" };
  }

  try {
    const { data, error } = await supabase
      .from("api_keys")
      .select("id, name")
      .eq("key_value", apiKey)
      .is("revoked_at", null)
      .single();

    if (!error && data) {
      await supabase
        .from("api_keys")
        .update({ last_used_at: new Date().toISOString() })
        .eq("id", data.id);
      return { valid: true, keyId: data.id, name: data.name };
    }
  } catch (err) {
    console.error("API key verification error:", err);
  }

  return { valid: false };
}

// ==========================================
// JSON-RPC handler
// ==========================================
async function handleJsonRpc(body: any, supabase: any): Promise<Response> {
  const { jsonrpc, method, params, id } = body;

  if (jsonrpc && jsonrpc !== "2.0") {
    return jsonResponse({
      jsonrpc: "2.0",
      error: { code: -32600, message: `Invalid jsonrpc version: ${jsonrpc}` },
      id: id ?? null,
    });
  }

  switch (method) {
    case "initialize":
      return jsonResponse({
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
            code: -32603,
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
      return jsonResponse(
        { jsonrpc: "2.0", error: { code: -32601, message: `Method not found: ${method}` }, id },
        404
      );
  }
}

// ==========================================
// Main Handler
// ==========================================
async function handleRequest(req: Request, supabase: any) {
  const url = new URL(req.url);
  const path = url.pathname;
  const base = getBaseUrl(req);
  // mcpUrl لازم يكون المسار الكامل اللي بيشوفه العميل من بره
  const mcpUrl = `${base}/functions/v1/mcp`;

  // === OAuth endpoints ===
  // ملاحظة: Supabase Edge Functions بيشيل /functions/v1/mcp من الـ path
  // فداخل الـ function، الـ path هيكون:
  // - / (root للـ MCP endpoint)
  // - /oauth/authorize
  // - /oauth/token
  // - /oauth/register
  // - /.well-known/oauth-protected-resource
  // - /.well-known/oauth-authorization-server
  //
  // لكن العميل بيشوف URLs كاملة (https://...supabase.co/functions/v1/mcp/oauth/authorize)
  // فبنستخدم endsWith() علشان نطابق أي path

  // .well-known/oauth-protected-resource (RFC 9728)
  if (path.endsWith("/.well-known/oauth-protected-resource")) {
    return jsonResponse({
      resource: mcpUrl,
      authorization_servers: [mcpUrl],
      bearer_methods_supported: ["header"],
      scopes_supported: [],
    });
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
      const issuedAt = Math.floor(Date.now() / 1000);

      return jsonResponse({
        client_id: clientId,
        client_id_issued_at: issuedAt,
        client_name: body.client_name || "chatgpt-mcp-connector",
        token_endpoint_auth_method: "none",
        redirect_uris: body.redirect_uris || [],
        grant_types: ["authorization_code"],
        response_types: ["code"],
        subject_type: "public",
        application_type: "web",
      });
    } catch (error: any) {
      return jsonResponse(
        { error: "invalid_client_metadata", error_description: error.message },
        400
      );
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

      // بدلاً من عرض HTML مباشرة (لأن Supabase بتغير Content-Type لـ text/plain)
      // نعيد redirect للواجهة الأمامية (Next.js على Cloudflare)
      // اللي هتعرض صفحة OAuth بشكل صحيح
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
      // مفتاح: نمرر mcpUrl عشان الـ form يبعت الـ POST للـ Edge Function
      redirectParams.set("mcp_url", mcpUrl);

      const finalUrl = `${frontendUrl}?${redirectParams.toString()}`;
      return Response.redirect(finalUrl, 302);
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

        if (!apiKey || !redirectUri) {
          return jsonResponse({ ok: false, error: "مطلوب: api_key + redirect_uri" }, 400);
        }

        const { valid, keyId, name } = await verifyApiKey(supabase, apiKey);
        if (!valid) {
          // نرجع JSON بدلاً من redirect عشان الـ client يقدر يعالج الخطأ
          return jsonResponse({
            ok: false,
            error: "مفتاح API غير صحيح أو منتهي",
          }, 401);
        }

        const codePayload = {
          k: apiKey,
          t: Date.now(),
          kid: keyId || null,
          name: name || null,
          cid: clientId,
          cc: codeChallenge,
          ccm: codeChallengeMethod,
          res: resource,
          scp: scope,
        };
        const jsonString = JSON.stringify(codePayload);
        const b64 = btoa(unescape(encodeURIComponent(jsonString)))
          .replace(/\+/g, "-")
          .replace(/\//g, "_")
          .replace(/=/g, "");

        const callbackUrl = new URL(redirectUri);
        callbackUrl.searchParams.set("code", b64);
        if (state) callbackUrl.searchParams.set("state", state);

        // نرجع JSON يحتوي على redirect_url بدلاً من HTTP redirect
        // عشان الـ client (Next.js) يقدر يعمل redirect بنفسه
        return jsonResponse({
          ok: true,
          redirect_url: callbackUrl.toString(),
        });
      } catch (error: any) {
        return new Response(`OAuth authorize error: ${error.message}`, { status: 500 });
      }
    }
  }

  // OAuth Token endpoint
  if (path.endsWith("/oauth/token") && req.method === "POST") {
    try {
      let code = "";
      let grantType = "";
      let resource = "";

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

      if (grantType !== "authorization_code") {
        return jsonResponse({ error: "unsupported_grant_type" }, 400);
      }

      if (!code) {
        return jsonResponse(
          { error: "invalid_grant", error_description: "Missing authorization code" },
          400
        );
      }

      let tokenData: any = null;
      let accessToken = "";
      try {
        const paddedCode = code + "=".repeat((4 - (code.length % 4)) % 4);
        const decoded = decodeURIComponent(
          escape(atob(paddedCode.replace(/-/g, "+").replace(/_/g, "/")))
        );
        tokenData = JSON.parse(decoded);

        if (!tokenData || !tokenData.k || typeof tokenData.k !== "string") {
          return jsonResponse(
            { error: "invalid_grant", error_description: "Authorization code malformed" },
            400
          );
        }

        accessToken = tokenData.k;
      } catch (err) {
        return jsonResponse(
          { error: "invalid_grant", error_description: "Authorization code غير صالح" },
          400
        );
      }

      return jsonResponse({
        access_token: accessToken,
        token_type: "Bearer",
        expires_in: 315360000,
        scope: tokenData?.scp || "",
        resource: resource || tokenData?.res || undefined,
      });
    } catch (error: any) {
      return jsonResponse(
        { error: "invalid_request", error_description: error.message },
        500
      );
    }
  }

  // === MCP endpoints ===
  // Supabase Edge Function path هيكون / أو /mcp (حسب الإصدار)
  // نطابق على / أو /mcp أو /functions/v1/mcp

  const isMcpRoot = path === "/" || path === "/mcp" || path === "/functions/v1/mcp" ||
                     path.endsWith("/functions/v1/mcp") || path.endsWith("/mcp");

  // GET: 405 Method Not Allowed (Streamable HTTP)
  if (req.method === "GET" && isMcpRoot) {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { ...corsHeaders, Allow: "POST" },
    });
  }

  // DELETE: end session
  if (req.method === "DELETE" && isMcpRoot) {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // POST: MCP JSON-RPC
  if (req.method === "POST" && isMcpRoot) {
    // المصادقة
    const authResult = await verifyAuth(req, supabase);
    if (!authResult.authorized) {
      const metaUrl = `${mcpUrl}/.well-known/oauth-protected-resource`;

      return new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          error: { code: -32001, message: "Unauthorized" },
          id: null,
        }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            "WWW-Authenticate": `Bearer resource_metadata="${metaUrl}"`,
            "Content-Type": "application/json",
          },
        }
      );
    }

    try {
      const body = await req.json();
      if (Array.isArray(body)) {
        const results = await Promise.all(
          body.map(async (req) => await handleJsonRpc(req, supabase))
        );
        if (results.length === 1) return results[0];
        return jsonResponse(results.map((r: any) => r));
      }
      return await handleJsonRpc(body, supabase);
    } catch (err: any) {
      return jsonResponse(
        {
          jsonrpc: "2.0",
          error: { code: -32700, message: "Parse error: " + (err.message || "Invalid JSON") },
          id: null,
        },
        400
      );
    }
  }

  // Not found
  return jsonResponse(
    { error: "Not found", path },
    404
  );
}

// ==========================================
// Main entry
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
    return jsonResponse(
      {
        jsonrpc: "2.0",
        error: { code: -32603, message: `Internal error: ${err.message}` },
        id: null,
      },
      500
    );
  }
});
