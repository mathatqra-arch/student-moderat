import { NextResponse } from "next/server";

// ==========================================
// RFC 8414 - OAuth 2.0 Authorization Server Metadata
// ==========================================

export async function GET(request: Request) {
  const host = request.headers.get("host") || "student-moderat.mathatqra.workers.dev";
  const proto = request.headers.get("x-forwarded-proto") || "https";
  const base = `${proto}://${host}`;

  return NextResponse.json({
    issuer: base,
    authorization_endpoint: `${base}/api/mcp/oauth/authorize`,
    token_endpoint: `${base}/api/mcp/oauth/token`,
    registration_endpoint: `${base}/api/mcp/oauth/register`,
    response_types_supported: ["code"],
    response_modes_supported: ["query"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    subject_types_supported: ["public"],
    scopes_supported: [],
    token_endpoint_auth_methods_supported: ["none", "client_secret_post"],
    code_challenge_methods_supported: ["S256"],
    require_pushed_authorization_requests: false,
  });
}
