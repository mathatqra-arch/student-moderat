import { NextResponse } from "next/server";

// ==========================================
// DEPRECATED — خادم MCP الرسمي انتقل إلى Supabase Edge Function
// الرابط: https://<project-ref>.supabase.co/functions/v1/mcp
//
// هذا المسار يرجع إشعار تقادم فقط لتقليل سطح الهجوم
// وإزالة ازدواجية الخوادم. كل الأدوات (~55 أداة) موجودة
// في الـ Edge Function.
// ==========================================

const EDGE_HINT =
  process.env.NEXT_PUBLIC_SUPABASE_URL
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/mcp`
    : "https://<project-ref>.supabase.co/functions/v1/mcp";

export async function GET() {
  return NextResponse.json(
    {
      deprecated: true,
      message:
        "خادم MCP عبر Next.js لم يعد مدعوماً. استخدم Supabase Edge Function.",
      mcp_url: EDGE_HINT,
      docs: "راجع mcp_config_guide.md في المستودع",
    },
    { status: 410, headers: { "Deprecation": "true", "Sunset": "true" } }
  );
}

export async function POST() {
  return GET();
}
