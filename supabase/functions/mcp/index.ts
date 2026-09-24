// Supabase Edge Function for MCP (Model Context Protocol) Server
// Deploy via Supabase CLI: supabase functions deploy mcp --no-verify-jwt

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

serve(async (req) => {
  // Handle CORS Preflight Request
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify Bearer Authentication Token
    const authHeader = req.headers.get("Authorization");
    const secretToken = Deno.env.get("MCP_SECRET_TOKEN") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (secretToken && authHeader) {
      const token = authHeader.replace("Bearer ", "").trim();
      if (token !== secretToken && token !== Deno.env.get("SUPABASE_ANON_KEY")) {
        return new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            error: { code: -32001, message: "Unauthorized token" },
            id: null,
          }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const { jsonrpc, method, params, id } = await req.json();

    // MCP Tools Discovery
    if (method === "tools/list") {
      return new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          result: {
            tools: [
              {
                name: "get_pending_inquiries",
                description: "استرجاع استفسارات الطلاب المعلقة والحالية",
                inputSchema: {
                  type: "object",
                  properties: { status: { type: "string" } },
                },
              },
              {
                name: "suggest_inquiry_reply",
                description: "إضافة الرد المقترح وتحديث حالة الطلب",
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
                inputSchema: { type: "object", properties: {} },
              },
            ],
          },
          id,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // MCP Tool Call Execution
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
        return new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            result: {
              content: [{ type: "text", text: JSON.stringify({ count: data?.length || 0, inquiries: data }, null, 2) }],
            },
            id,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
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
        return new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            result: {
              content: [{ type: "text", text: `تم تسجيل الرد المقترح بنجاح: ${JSON.stringify(data)}` }],
            },
            id,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (name === "create_announcement") {
        const { title, content, category, is_pinned } = args || {};
        const { data, error } = await supabase.from("announcements").insert([
          { title, content, category: category || "عام", is_pinned: is_pinned || false },
        ]).select();

        if (error) throw error;
        return new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            result: {
              content: [{ type: "text", text: `تم نشر الإعلان بنجاح: ${JSON.stringify(data)}` }],
            },
            id,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (name === "create_academic_task") {
        const { subject, title, description, deadline } = args || {};
        const { data, error } = await supabase.from("tasks").insert([
          { subject, title, description: description || "", deadline, status: "active" },
        ]).select();

        if (error) throw error;
        return new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            result: {
              content: [{ type: "text", text: `تم إضافة التكليف بنجاح: ${JSON.stringify(data)}` }],
            },
            id,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (name === "get_batch_context") {
        const announcements = await supabase.from("announcements").select("*").limit(5);
        const tasks = await supabase.from("tasks").select("*").eq("status", "active");
        const links = await supabase.from("quick_links").select("*");

        return new Response(
          JSON.stringify({
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
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify({ jsonrpc: "2.0", error: { code: -32601, message: "Method not found" }, id }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ jsonrpc: "2.0", error: { code: -32603, message: err.message }, id: null }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
