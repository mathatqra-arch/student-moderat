import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const redirectUri = searchParams.get("redirect_uri") || "";
  const state = searchParams.get("state") || "";

  // Render a clean HTML popup window for ChatGPT OAuth Authentication
  const html = `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>مصادقة منصة الدفعة لشات جي بي تي | ChatGPT Auth</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet">
      <style>body { font-family: 'Cairo', sans-serif; background-color: #0b0f19; color: #f3f4f6; }</style>
    </head>
    <body class="min-h-screen flex items-center justify-center p-4">
      <div class="max-w-md w-full bg-gray-900 border border-gray-800 p-6 md:p-8 rounded-3xl space-y-6 shadow-2xl">
        <div className="text-center space-y-2">
          <div class="w-12 h-12 rounded-2xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center mx-auto text-xl font-bold">
            🔑
          </div>
          <h1 class="text-xl font-extrabold text-white">نافذة مصادقة منصة الدفعة (ChatGPT Auth)</h1>
          <p class="text-xs text-gray-400">أدخل مفتاح الـ API الخاص بك المصدر من لوحة التحكم لمنح شات جي بي تي الصلاحية</p>
        </div>

        <form method="POST" action="/api/mcp/oauth/authorize" class="space-y-4">
          <input type="hidden" name="redirect_uri" value="${redirectUri}" />
          <input type="hidden" name="state" value="${state}" />

          <div class="space-y-1">
            <label class="text-xs font-medium text-gray-300">مفتاح API Key *</label>
            <input
              type="text"
              name="api_key"
              placeholder="bmp_key_..."
              required
              class="w-full bg-gray-950 border border-gray-800 rounded-xl px-3.5 py-2.5 text-sm text-gray-100 focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>

          <button
            type="submit"
            class="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-xl transition shadow-lg shadow-blue-600/25 text-sm"
          >
            تأكيد الربط مع شات جي بي تي
          </button>
        </form>
      </div>
    </body>
    </html>
  `;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const apiKey = formData.get("api_key")?.toString() || "";
  const redirectUri = formData.get("redirect_uri")?.toString() || "";
  const state = formData.get("state")?.toString() || "";

  if (!apiKey) {
    return new Response("مفتاح API مطلوب", { status: 400 });
  }

  // Generate authorization code containing encoded API key
  const authCode = Buffer.from(apiKey).toString("base64");

  if (redirectUri) {
    const callbackUrl = new URL(redirectUri);
    callbackUrl.searchParams.set("code", authCode);
    if (state) callbackUrl.searchParams.set("state", state);
    return NextResponse.redirect(callbackUrl.toString());
  }

  return NextResponse.json({
    success: true,
    code: authCode,
    message: "تم التوثيق بنجاح! يمكنك العودة لشات جي بي تي الآن.",
  });
}
