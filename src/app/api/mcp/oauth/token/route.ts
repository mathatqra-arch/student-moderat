import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    let code = "";
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await request.formData();
      code = formData.get("code")?.toString() || "";
    } else {
      const body = await request.json();
      code = body.code || "";
    }

    if (!code) {
      return NextResponse.json(
        { error: "invalid_grant", error_description: "Missing authorization code" },
        { status: 400 }
      );
    }

    // Decode the authorization code back into the secret API Key
    const accessToken = Buffer.from(code, "base64").toString("utf-8");

    return NextResponse.json({
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: 315360000, // 10 years
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "invalid_request", error_description: error.message },
      { status: 500 }
    );
  }
}
