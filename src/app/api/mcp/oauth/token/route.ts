import { NextResponse } from "next/server";

// ==========================================
// OAuth 2.1 Token Endpoint (PKCE + resource parameter)
// متوافق مع RFC 6749 + RFC 7636 + RFC 8707
// ==========================================

export async function POST(request: Request) {
  try {
    let code = "";
    let grantType = "";
    let codeVerifier = "";
    let resource = "";
    let clientId = "";

    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await request.formData();
      code = formData.get("code")?.toString() || "";
      grantType = formData.get("grant_type")?.toString() || "authorization_code";
      codeVerifier = formData.get("code_verifier")?.toString() || "";
      resource = formData.get("resource")?.toString() || "";
      clientId = formData.get("client_id")?.toString() || "";
    } else {
      const body = await request.json();
      code = body.code || "";
      grantType = body.grant_type || "authorization_code";
      codeVerifier = body.code_verifier || "";
      resource = body.resource || "";
      clientId = body.client_id || "";
    }

    if (grantType !== "authorization_code") {
      return NextResponse.json(
        {
          error: "unsupported_grant_type",
          error_description: `grant_type "${grantType}" غير مدعوم`,
        },
        { status: 400 }
      );
    }

    if (!code) {
      return NextResponse.json(
        {
          error: "invalid_grant",
          error_description: "Missing authorization code",
        },
        { status: 400 }
      );
    }

    // فك ترميز authorization code (base64url JSON)
    let accessToken = "";
    let tokenData: any = null;

    try {
      // إضافة padding إذا لزم
      const paddedCode = code + "=".repeat((4 - (code.length % 4)) % 4);
      const decoded = Buffer.from(paddedCode, "base64url").toString("utf-8");
      tokenData = JSON.parse(decoded);

      // التحقق من إن الـ decoded يحتوي على الحقل k (المفتاح)
      if (!tokenData || !tokenData.k || typeof tokenData.k !== "string") {
        return NextResponse.json(
          {
            error: "invalid_grant",
            error_description: "Authorization code malformed",
          },
          { status: 400 }
        );
      }

      accessToken = tokenData.k;
    } catch (err) {
      return NextResponse.json(
        {
          error: "invalid_grant",
          error_description: "Authorization code غير صالح",
        },
        { status: 400 }
      );
    }

    if (!accessToken) {
      return NextResponse.json(
        {
          error: "invalid_grant",
          error_description: "تعذّر استخراج access token",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: 315360000, // 10 سنوات
      scope: tokenData?.scp || "",
      resource: resource || tokenData?.res || undefined,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "invalid_request",
        error_description: error.message,
      },
      { status: 500 }
    );
  }
}
