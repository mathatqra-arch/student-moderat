#!/usr/bin/env node
// ==========================================
// Stdio MCP Server Test Script
// يختبر خادم MCP المحلي عبر stdio transport
// يشغّل mcp/server.ts كعملية فرعية ويرسل JSON-RPC requests
// ==========================================

import { spawn } from "node:child_process";
import { once } from "node:events";

const serverProc = spawn("npx", ["tsx", "mcp/server.ts"], {
  cwd: process.cwd(),
  stdio: ["pipe", "pipe", "inherit"],
});

let buffer = "";
let messageId = 0;
const pending = new Map();

serverProc.stdout.on("data", (chunk) => {
  buffer += chunk.toString();
  let newlineIdx;
  while ((newlineIdx = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, newlineIdx).trim();
    buffer = buffer.slice(newlineIdx + 1);
    if (!line) continue;
    try {
      const msg = JSON.parse(line);
      if (msg.id !== undefined && pending.has(msg.id)) {
        pending.get(msg.id)(msg);
        pending.delete(msg.id);
      }
    } catch {
      // قد تكون سطر notification — تجاهل
    }
  }
});

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++messageId;
    pending.set(id, resolve);
    const req = JSON.stringify({ jsonrpc: "2.0", method, params, id });
    serverProc.stdin.write(req + "\n");
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error(`Timeout waiting for response to: ${method}`));
      }
    }, 10000);
  });
}

let passed = 0;
let failed = 0;

function log(name, ok, detail = "") {
  const icon = ok ? "✅" : "❌";
  console.log(`${icon} ${name}${detail ? ` — ${detail}` : ""}`);
  if (ok) passed++;
  else failed++;
}

async function run() {
  console.log("═══════════════════════════════════════════════════");
  console.log("🧪 اختبار خادم MCP (stdio transport)");
  console.log("═══════════════════════════════════════════════════\n");

  // انتظر حتى يبدأ الـ server
  await once(serverProc.stderr, "data").catch(() => null);
  await new Promise((r) => setTimeout(r, 1000));

  try {
    // 1. initialize
    const init = await send("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "test-client", version: "1.0.0" },
    });
    log(
      "initialize",
      init.result?.serverInfo?.name === "batch-management-mcp-server",
      `v${init.result?.serverInfo?.version}`
    );

    // 2. tools/list
    const toolsList = await send("tools/list");
    const tools = toolsList.result?.tools || [];
    log("tools/list", tools.length >= 5, `${tools.length} tools available`);

    // 3. get_batch_context
    const ctx = await send("tools/call", {
      name: "get_batch_context",
      arguments: {},
    });
    log(
      "get_batch_context",
      ctx.result?.content?.[0]?.type === "text",
      "returned context JSON"
    );

    // 4. get_inquiry_stats
    const stats = await send("tools/call", {
      name: "get_inquiry_stats",
      arguments: {},
    });
    log(
      "get_inquiry_stats",
      stats.result?.content?.[0]?.type === "text",
      "returned stats"
    );

    // 5. get_pending_inquiries
    const inquiries = await send("tools/call", {
      name: "get_pending_inquiries",
      arguments: { status: "all", limit: 3 },
    });
    log(
      "get_pending_inquiries",
      inquiries.result?.content?.[0]?.type === "text",
      "returned inquiries list"
    );
  } catch (err) {
    log("Test run", false, err.message);
  }

  console.log("\n═══════════════════════════════════════════════════");
  console.log(`📊 النتائج: ${passed} نجح / ${failed} فشل`);
  console.log("═══════════════════════════════════════════════════\n");

  serverProc.kill();
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error("Fatal:", err);
  serverProc.kill();
  process.exit(1);
});
