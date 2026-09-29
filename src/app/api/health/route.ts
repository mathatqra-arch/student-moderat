import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ==========================================
// Health Check — فحص صحة حقيقي
// يتضمن ping لقاعدة البيانات (بدون كشف تفاصيل حساسة)
// ==========================================

export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();
  let dbStatus = "unknown";
  let dbLatencyMs: number | null = null;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && serviceKey) {
    try {
      const supabase = createClient(supabaseUrl, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const dbStart = Date.now();
      const { error } = await supabase
        .from("announcements")
        .select("id", { count: "exact", head: true })
        .limit(1);
      dbLatencyMs = Date.now() - dbStart;
      dbStatus = error ? "degraded" : "ok";
    } catch {
      dbStatus = "unreachable";
    }
  } else {
    dbStatus = "not_configured";
  }

  const healthy = dbStatus === "ok";

  return NextResponse.json(
    {
      status: healthy ? "online" : "degraded",
      version: "2.1.0",
      services: {
        app: "ok",
        database: dbStatus,
        database_latency_ms: dbLatencyMs,
      },
      mcp_server: "Supabase Edge Function (/functions/v1/mcp)",
      checked_in_ms: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503 }
  );
}
