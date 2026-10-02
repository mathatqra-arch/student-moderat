import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ==========================================
// Health Check
// - الافتراضي: فحص حياة خفيف (ليفنس) — دايماً 200 بدون لمس الداتابيز
//   ده الصح للمراقبة والـ load balancers: تيران Supabase العابرة ماتقلبهوش أحمر
// - ?deep=1: فحص عميق لقاعدة البيانات مع كاش 30 ثانية
//   عشان المراقبة المتكررة ماتضغطش على Supabase وماتتقلبش 503 مع أي مهلة
// (بدون كشف تفاصيل حساسة — نفس عهد الأمان)
// ==========================================

export const dynamic = "force-dynamic";

// كاش نتيجة الفحص العميق داخل الـ isolate لمدة 30 ثانية
let dbCache: { status: string; latencyMs: number | null; at: number } | null = null;
const DB_CACHE_TTL = 30_000;

async function deepCheckDb(supabaseUrl: string, serviceKey: string) {
  if (dbCache && Date.now() - dbCache.at < DB_CACHE_TTL) return dbCache;

  let result: { status: string; latencyMs: number | null; at: number } = {
    status: "unreachable",
    latencyMs: null,
    at: Date.now(),
  };
  try {
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const dbStart = Date.now();
    const { error } = await supabase
      .from("announcements")
      .select("id", { count: "exact", head: true })
      .limit(1);
    result = {
      status: error ? "degraded" : "ok",
      latencyMs: Date.now() - dbStart,
      at: Date.now(),
    };
  } catch {
    // unreachable — نكاشيها برضه عشان مفيش ضرب متكرر على قاعدة تعبانة
  }
  dbCache = result;
  return result;
}

export async function GET(req: Request) {
  const startedAt = Date.now();
  const url = new URL(req.url);
  const deep = url.searchParams.get("deep") === "1";

  let dbStatus = "skipped";
  let dbLatencyMs: number | null = null;

  if (deep) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (supabaseUrl && serviceKey) {
      const result = await deepCheckDb(supabaseUrl, serviceKey);
      dbStatus = result.status;
      dbLatencyMs = result.latencyMs;
    } else {
      dbStatus = "not_configured";
    }
  }

  return NextResponse.json(
    {
      status: "online",
      version: "2.1.0",
      services: {
        app: "ok",
        database: dbStatus,
        database_latency_ms: dbLatencyMs,
      },
      mcp_server: "Supabase Edge Function (/functions/v1/mcp)",
      checked_in_ms: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
      hint: deep ? undefined : "أضف ?deep=1 لفحص قاعدة البيانات فعلياً",
    },
    {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    }
  );
}
