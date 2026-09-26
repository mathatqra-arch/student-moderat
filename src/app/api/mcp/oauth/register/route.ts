import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

// ==========================================
// RFC 7591 - OAuth 2.0 Dynamic Client Registration
// ==========================================

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const clientId = "mcp_client_" + randomUUID().replace(/-/g, "").substring(0, 24);
    const issuedAt = Math.floor(Date.now() / 1000);

    return NextResponse.json({
      client_id: clientId,
      client_id_issued_at: issuedAt,
      client_name: body.client_name || "chatgpt-mcp-connector",
      token_endpoint_auth_method: "none",
      redirect_uris: body.redirect_uris || [],
      grant_types: ["authorization_code"],
      response_types: ["code"],
      subject_type: "public",
      application_type: "web",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "invalid_client_metadata", error_description: error.message },
      { status: 400 }
    );
  }
}
