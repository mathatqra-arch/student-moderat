import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "online",
    platform: "منصة إدارة الدفعة الأكاديمية (Batch Management Platform)",
    version: "1.0.0",
    pwa: "enabled",
    mcp_server: "available via npm run mcp:start",
    timestamp: new Date().toISOString(),
  });
}
