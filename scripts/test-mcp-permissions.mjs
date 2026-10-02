#!/usr/bin/env node
// ==========================================
// الشيك الحي — هل الـ MCP بيتصرف بصلاحيات حساب الأدمن؟
// ==========================================
// يجيب المفتاحين من متغيرات البيئة (أو باراميترات):
//   MCP_URL            — رابط الـ Edge Function
//                        مثال: https://<ref>.supabase.co/functions/v1/mcp
//   MCP_LEADER_KEY     — مفتاح بصلاحيات كاملة (ليدر)
//   MCP_LIMITED_KEY    — مفتاح عضو محدود الصلاحيات (مثلاً منعه الليدر من الاستفسارات)
//
// التحقق:
//   1) مفتاح الليدر: يشوف كل الأدوات + يعمل عمليات كاملة (تصنيفات + إعلانات + استفسارات)
//   2) المفتاح المحدود: أدوات الاستفسارات مترفض (-32003) حتى لو حاول،
//      والأدوات المسموحة ليه شغالة — والـ tools/list مش بيعرضله المحجوب أصلاً
//
// تشغيل:
//   MCP_URL=... MCP_LEADER_KEY=bmp_key_... MCP_LIMITED_KEY=bmp_key_... node scripts/test-mcp-permissions.mjs
// ==========================================

const MCP_URL = process.env.MCP_URL || process.argv[2] || "";
const LEADER_KEY = process.env.MCP_LEADER_KEY || process.argv[3] || "";
const LIMITED_KEY = process.env.MCP_LIMITED_KEY || process.argv[4] || "";

if (!MCP_URL || !LEADER_KEY || !LIMITED_KEY) {
  console.error("الاستخدام: MCP_URL=... MCP_LEADER_KEY=... MCP_LIMITED_KEY=... node scripts/test-mcp-permissions.mjs");
  process.exit(1);
}

let pass = 0, fail = 0;
const results = [];

async function call(key, tool, args = {}, expect = "ok") {
  const res = await fetch(MCP_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: tool, arguments: args } }),
  });
  const json = await res.json().catch(() => ({}));
  const denied = json?.error?.code === -32003 || json?.error?.data?.permission_denied === true;
  const ok = !json?.error;
  const status = expect === "ok" ? (ok ? "PASS" : "FAIL") : expect === "denied" ? (denied ? "PASS" : "FAIL") : ok ? "FAIL" : "PASS";
  if (status === "PASS") pass++; else fail++;
  const msg = json?.error?.message || "";
  results.push({ status, tool, expect, msg: msg.slice(0, 90) });
  return json;
}

async function toolsCount(key) {
  const res = await fetch(MCP_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
  });
  const json = await res.json().catch(() => ({}));
  return json?.result?.tools?.map((t) => t.name) || [];
}

console.log("=== 1) مفتاح الليدر — لازم يشوف ويعمل كل شيء ===");
const leaderTools = await toolsCount(LEADER_KEY);
results.push({ status: leaderTools.length >= 60 ? "PASS" : "FAIL", tool: "tools/list (leader)", expect: "ok", msg: `${leaderTools.length} أداة` });
if (leaderTools.length >= 60) pass++; else fail++;

// كامل دورة تصنيفات + إعلان بالتصنيف + قراءة استفسار
const cat = await call(LEADER_KEY, "create_category", { type: "announcement", name: `اختبار-${Date.now()}` });
const catId = cat?.result?.content?.[0]?.text ? JSON.parse(cat.result.content[0].text)?.id : null;
await call(LEADER_KEY, "list_categories", { type: "all" });
if (catId) {
  await call(LEADER_KEY, "update_category", { category_id: catId, name: `اختبار-معدل-${Date.now()}` });
  await call(LEADER_KEY, "delete_category", { category_id: catId });
}
await call(LEADER_KEY, "list_inquiries", { limit: 5 });
await call(LEADER_KEY, "list_announcements", { limit: 5 });
await call(LEADER_KEY, "get_dashboard_stats");
await call(LEADER_KEY, "create_announcement", { title: "شيك صلاحيات", content: "اختبار تلقائي — يُحذف", category: "عام" }, "ok");

console.log("\n=== 2) المفتاح المحدود — المحجوب عليه لازم يترفض ===");
const limitedTools = await toolsCount(LIMITED_KEY);
results.push({ status: "INFO", tool: "tools/list (limited)", expect: "-", msg: `${limitedTools.length} أداة ظاهرة له` });

// الممنوع — لازم يترفض برسالة صلاحية واضحة (غيّر الأدوات دي حسب صلاحيات العضو)
await call(LIMITED_KEY, "list_inquiries", {}, "denied");
await call(LIMITED_KEY, "get_inquiry", { inquiry_id: "00000000-0000-0000-0000-000000000000" }, "denied");
await call(LIMITED_KEY, "delete_inquiry", { inquiry_id: "00000000-0000-0000-0000-000000000000" }, "denied");
await call(LIMITED_KEY, "search_platform", { query: "اختبار" }, "ok"); // شغال لكن مفيهوش قسم الاستفسارات
const searchRes = await call(LIMITED_KEY, "search_platform", { query: "ا" });
let searchJson = {};
try { searchJson = JSON.parse(searchRes?.result?.content?.[0]?.text || "{}"); } catch {}
const leaked = Array.isArray(searchJson.inquiries);
results.push({ status: leaked ? "FAIL" : "PASS", tool: "search_platform (بلا استفسارات)", expect: "denied", msg: leaked ? "بيدّيه استفسارات رغم المنع!" : "مفيش استفسارات في نتايج البحث" });
if (leaked) fail++; else pass++;

console.log("\n=== النتيجة ===");
for (const r of results) {
  console.log(`${r.status === "PASS" ? "✅" : r.status === "FAIL" ? "❌" : "ℹ️ "} [${r.expect}] ${r.tool}${r.msg ? " — " + r.msg : ""}`);
}
console.log(`\n${pass} ناجح / ${fail} فاشل`);
process.exit(fail ? 1 : 0);
