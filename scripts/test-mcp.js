#!/usr/bin/env node
// ==========================================
// MCP Server Test Script
// يختبر خادم MCP عبر HTTP (Next.js route و Supabase Edge Function)
// Usage:
//   node scripts/test-mcp.js                          # يختبر localhost
//   node scripts/test-mcp.js --edge                  # يختبر Supabase Edge Function
//   node scripts/test-mcp.js --url http://...        # يختبر URL مخصص
//   node scripts/test-mcp.js --token bmp_key_...     # توكن مخصص
// ==========================================

// تحميل متغيرات البيئة من .env.local
const fs = require("node:fs");
const path = require("node:path");
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
  console.log(`📄 Loaded .env.local`);
}

const args = process.argv.slice(2);
const flags = Object.fromEntries(
  args
    .filter((a) => a.startsWith("--"))
    .map((a) => {
      const [k, v] = a.replace(/^--/, "").split("=");
      return [k, v || true];
    })
);

const DEFAULT_LOCAL_URL = "http://localhost:3000/api/mcp";
const EDGE_URL = "https://apcxwxnkntegbkimsmty.supabase.co/functions/v1/mcp";

const baseUrl =
  flags.url ||
  (flags.edge ? EDGE_URL : process.env.NEXT_PUBLIC_MCP_HTTP_ENDPOINT || DEFAULT_LOCAL_URL);

// التوكن: أولوية لـ flag، ثم MCP_SECRET_TOKEN، ثم service_role (للاختبار فقط)
const token =
  flags.token ||
  process.env.MCP_SECRET_TOKEN ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!token) {
  console.error("❌ لا يوجد توكن. مرّر --token=bmp_key_... أو عيّن MCP_SECRET_TOKEN في .env.local");
  process.exit(1);
}

let passed = 0;
let failed = 0;
const results = [];

async function call(method, params = {}) {
  const res = await fetch(baseUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method,
      params,
      id: Date.now(),
    }),
  });
  return { status: res.status, body: await res.json() };
}

function log(name, ok, detail = "") {
  const icon = ok ? "✅" : "❌";
  const tag = ok ? "PASS" : "FAIL";
  console.log(`${icon} [${tag}] ${name}${detail ? ` — ${detail}` : ""}`);
  if (ok) passed++;
  else failed++;
  results.push({ name, ok, detail });
}

async function run() {
  console.log("═══════════════════════════════════════════════════");
  console.log(`🧪 اختبار خادم MCP: ${baseUrl}`);
  console.log(`🔑 التوكن: ${token.substring(0, 12)}…${token.slice(-4)}`);
  console.log("═══════════════════════════════════════════════════\n");

  // 1. GET discovery
  try {
    const res = await fetch(baseUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    log(
      "GET / (discovery)",
      res.status === 200 && data.status === "online",
      `v${data.version || "?"} | ${data.tools_count || 0} tools`
    );
  } catch (err) {
    log("GET / (discovery)", false, err.message);
  }

  // 2. Unauthorized request (no token)
  try {
    const res = await fetch(baseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "initialize", id: 1 }),
    });
    const data = await res.json();
    log(
      "POST / بدون توكن → 401",
      res.status === 401 && data.error?.code === -32001,
      data.error?.message
    );
  } catch (err) {
    log("POST / بدون توكن → 401", false, err.message);
  }

  // 3. initialize
  try {
    const { status, body } = await call("initialize");
    log(
      "initialize",
      status === 200 && body.result?.protocolVersion,
      `protocol: ${body.result?.protocolVersion}`
    );
  } catch (err) {
    log("initialize", false, err.message);
  }

  // 4. tools/list
  try {
    const { status, body } = await call("tools/list");
    const tools = body.result?.tools || [];
    log(
      "tools/list",
      status === 200 && tools.length >= 5,
      `${tools.length} tools: ${tools.map((t) => t.name).join(", ")}`
    );
  } catch (err) {
    log("tools/list", false, err.message);
  }

  // 5. ping
  try {
    const { status, body } = await call("ping");
    log("ping", status === 200 && body.result !== undefined, "OK");
  } catch (err) {
    log("ping", false, err.message);
  }

  // 6. get_batch_context
  try {
    const { status, body } = await call("tools/call", {
      name: "get_batch_context",
      arguments: {},
    });
    const ok = status === 200 && body.result?.content?.[0]?.type === "text";
    const ctx = ok ? JSON.parse(body.result.content[0].text) : {};
    log(
      "tools/call: get_batch_context",
      ok,
      `${ctx.recent_announcements?.length || 0} announcements | ${ctx.active_tasks?.length || 0} tasks | ${ctx.academic_links?.length || 0} links`
    );
  } catch (err) {
    log("tools/call: get_batch_context", false, err.message);
  }

  // 7. get_inquiry_stats
  try {
    const { status, body } = await call("tools/call", {
      name: "get_inquiry_stats",
      arguments: {},
    });
    const ok = status === 200 && body.result?.content?.[0]?.type === "text";
    log(
      "tools/call: get_inquiry_stats",
      ok,
      ok ? body.result.content[0].text.replace(/\s+/g, " ").substring(0, 80) : "failed"
    );
  } catch (err) {
    log("tools/call: get_inquiry_stats", false, err.message);
  }

  // 8. get_pending_inquiries (all)
  try {
    const { status, body } = await call("tools/call", {
      name: "get_pending_inquiries",
      arguments: { status: "all", limit: 5 },
    });
    const ok = status === 200 && body.result?.content?.[0]?.type === "text";
    const data = ok ? JSON.parse(body.result.content[0].text) : {};
    log(
      "tools/call: get_pending_inquiries(all)",
      ok,
      `${data.count || 0} inquiries returned`
    );
  } catch (err) {
    log("tools/call: get_pending_inquiries(all)", false, err.message);
  }

  // 9. Invalid tool
  try {
    const { status, body } = await call("tools/call", {
      name: "non_existent_tool",
      arguments: {},
    });
    log(
      "tools/call: أداة غير موجودة → error",
      body.error?.code === -32000,
      body.error?.message?.substring(0, 60)
    );
  } catch (err) {
    log("tools/call: أداة غير موجودة → error", false, err.message);
  }

  // 10. Unknown method
  try {
    const { status, body } = await call("nonexistent/method");
    log(
      "method غير معروف → -32601",
      body.error?.code === -32601,
      body.error?.message
    );
  } catch (err) {
    log("method غير معروف → -32601", false, err.message);
  }

  // 11. OAuth openapi spec
  try {
    const res = await fetch(baseUrl.replace("/mcp", "/mcp/openapi.json"));
    const data = await res.json();
    log(
      "GET /api/mcp/openapi.json",
      res.status === 200 && data.openapi === "3.0.1",
      `${data.info?.title || "Untitled"}`
    );
  } catch (err) {
    log("GET /api/mcp/openapi.json", false, err.message);
  }

  // التقرير النهائي
  console.log("\n═══════════════════════════════════════════════════");
  console.log(`📊 النتائج: ${passed} نجح / ${failed} فشل / ${passed + failed} إجمالي`);
  console.log("═══════════════════════════════════════════════════\n");

  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
