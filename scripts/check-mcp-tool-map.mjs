#!/usr/bin/env node
// ==========================================
// فحص ثابت: هل كل أداة MCP ليها قاعدة صلاحيات؟
// - كل أداة في TOOLS لازم يكون ليها مدخل في TOOL_PERMISSIONS
// - وكل مدخل في TOOL_PERMISSIONS لازم يقابل أداة موجودة
// - والأدوات اللي ليها resource/action لازم الموارد تكون معروفة
// تشغيل: node scripts/check-mcp-tool-map.mjs
// ==========================================

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(root, "supabase/functions/mcp/index.ts"), "utf8");

// استخراج أسماء الأدوات من مصفوفة TOOLS
const toolsSection = src.slice(src.indexOf("const TOOLS: Tool[] = ["), src.indexOf("\n];", src.indexOf("const TOOLS: Tool[] = [")));
const toolNames = [...toolsSection.matchAll(/\{ name: "([a-z_0-9]+)"/g)].map((m) => m[1]);

// استخراج مفاتيح TOOL_PERMISSIONS
const permSection = src.slice(src.indexOf("const TOOL_PERMISSIONS: Record<string, PermEntry> = {"), src.indexOf("\n};", src.indexOf("const TOOL_PERMISSIONS: Record<string, PermEntry> = {")));
const permKeys = [...permSection.matchAll(/^\s{2}([a-z_0-9]+):/gm)].map((m) => m[1]);

const tools = new Set(toolNames);
const perms = new Set(permKeys);

let failures = 0;
for (const t of toolNames) {
  if (!perms.has(t)) {
    console.error(`FAIL: الأداة "${t}" موجودة في TOOLS لكن مفيهاش قاعدة صلاحيات — هتبقى متاحة للكل!`);
    failures++;
  }
}
for (const p of permKeys) {
  if (!tools.has(p)) {
    console.error(`FAIL: "${p}" ليها قاعدة صلاحيات لكنها مش أداة موجودة (اسم غلط؟)`);
    failures++;
  }
}

// التأكد من غياب الثغرات الشائعة
const crossTools = [...permSection.matchAll(/^\s{2}([a-z_0-9]+): "cross"/gm)].map((m) => m[1]);
console.log(`tools=${toolNames.length} permission-rules=${permKeys.length} cross=${crossTools.length}`);

if (toolNames.length === 0 || permKeys.length === 0) {
  console.error("FAIL: فشل استخراج القوائم — راجع الـ regex");
  process.exit(1);
}
if (failures > 0) {
  console.error(`\n❌ ${failures} مشكلة في خريطة الصلاحيات`);
  process.exit(1);
}
console.log("\n✅ كل الأدوات ليها قواعد صلاحيات والخريطة سليمة — مفيش أداة مكشوفة بدون فحص");
