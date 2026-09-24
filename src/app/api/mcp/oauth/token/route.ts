import { NextResponse } from "next/server";

// ==========================================
// MCP OAuth Token Endpoint
// يستلم authorization code ويعيد access_token
// ==========================================

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || "";
    let code = "";
    let grantType = "";
    let clientId = "";
    let clientSecret = "";
    let redirectUri = "";

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await request.formData();
      code = formData.get("code")?.toString() || "";
      grantType = formData.get("grant_type")?.toString() || "authorization_code";
      clientId = formData.get("client_id")?.toString() || "";
      clientSecret = formData.get("client_secret")?.toString() || "";
      redirectUri = formData.get("redirect_uri")?.toString() || "";
    } else {
      const body = await request.json();
      code = body.code || "";
      grantType = body.grant_type || "authorization_code";
      clientId = body.client_id || "";
      clientSecret = body.client_secret || "";
      redirectUri = body.redirect_uri || "";
    }

    if (grantType !== "authorization_code") {
      return NextResponse.json(
        { error: "unsupported_grant_type", error_description: `grant_type "${grantType}" غير مدعوم` },
        { status: 400 }
      );
    }

    if (!code) {
      return NextResponse.json(
        { error: "invalid_grant", error_description: "Missing authorization code" },
        { status: 400 }
      );
    }

    // فك ترميز authorization code واستخراج المفتاح
    let accessToken = "";
    try {
      const decoded = Buffer.from(code, "base64url").toString("utf-8");
      const payload = JSON.parse(decoded);
      accessToken = payload.k || "";
    } catch {
      // fallback: قد يكون base64 عادي (للتوافق مع الإصدار السابق)
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
      expires_in: 315360000, // 10 سنوات (مفتاح لا ينتهي طبيعياً)
      scope: "inquiries:read inquiries:write announcements:write tasks:write context:read",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "invalid_request", error_description: error.message },
      { status: 500 }
    );
  }
}
