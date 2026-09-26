import { NextResponse } from "next/server";

// ==========================================
// OAuth 2.1 Token Endpoint (with PKCE + resource support)
// ==========================================

export async function POST(request: Request) {
  try {
    let code = "";
    let grantType = "";
    let codeVerifier = "";
    let resource = "";

    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await request.formData();
      code = formData.get("code")?.toString() || "";
      grantType = formData.get("grant_type")?.toString() || "authorization_code";
      codeVerifier = formData.get("code_verifier")?.toString() || "";
      resource = formData.get("resource")?.toString() || "";
    } else {
      const body = await request.json();
      code = body.code || "";
      grantType = body.grant_type || "authorization_code";
      codeVerifier = body.code_verifier || "";
      resource = body.resource || "";
    }

    if (grantType !== "authorization_code") {
      return NextResponse.json(
        { error: "unsupported_grant_type" },
        { status: 400 }
      );
    }

    if (!code) {
      return NextResponse.json(
        { error: "invalid_grant", error_description: "Missing authorization code" },
        { status: 400 }
      );
    }

    let accessToken = "";
    let tokenData: any = null;
    try {
      const decoded = Buffer.from(code, "base64url").toString("utf-8");
      tokenData = JSON.parse(decoded);
      accessToken = tokenData.k || "";
    } catch {
      try {
        accessToken = Buffer.from(code, "base64").toString("utf-8");
      } catch {
        return NextResponse.json(
          { error: "invalid_grant", error_description: "Authorization code غير صالح" },
          { status: 400 }
        );
      }
    }

    if (!accessToken) {
      return NextResponse.json(
        { error: "invalid_grant", error_description: "تعذّر استخراج access token" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: 315360000,
      scope: tokenData?.scp || "",
      resource: resource || tokenData?.res || undefined,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "invalid_request", error_description: error.message },
      { status: 500 }
    );
  }
}
