import { NextResponse } from "next/server";

// ==========================================
// RFC 9728 - OAuth 2.0 Protected Resource Metadata
// ضروري لـ MCP OAuth 2.1 - ChatGPT بيكتشفه علشان يعرف مكان الـ auth server
// ==========================================

export async function GET(request: Request) {
  const host = request.headers.get("host") || "student-moderat.mathatqra.workers.dev";
  const proto = request.headers.get("x-forwarded-proto") || "https";
  const base = `${proto}://${host}`;
  const mcpUrl = `${base}/api/mcp`;

  return NextResponse.json({
    resource: mcpUrl,
    authorization_servers: [base],
    bearer_methods_supported: ["header"],
    scopes_supported: [],
    resource_documentation: `${base}/.well-known/oauth-protected-resource`,
  });
}
