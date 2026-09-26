import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ==========================================
// OAuth 2.1 Authorize Endpoint (PKCE + resource parameter)
// ==========================================

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function getSupabaseAdmin() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

async function verifyApiKey(apiKey: string): Promise<{ valid: boolean; keyId?: string; name?: string }> {
  if (!apiKey) return { valid: false };

  const envToken = process.env.MCP_SECRET_TOKEN;
  if (envToken && apiKey === envToken) {
    return { valid: true, name: "MCP Secret Token" };
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("api_keys")
      .select("id, name")
      .eq("key_value", apiKey)
      .is("revoked_at", null)
      .single();

    if (!error && data) {
      await supabase
        .from("api_keys")
        .update({ last_used_at: new Date().toISOString() })
        .eq("id", data.id);
      return { valid: true, keyId: data.id, name: data.name };
    }
  } catch (err) {
    console.error("API key verification error:", err);
  }

  return { valid: false };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const redirectUri = searchParams.get("redirect_uri") || "";
  const state = searchParams.get("state") || "";
  const clientId = searchParams.get("client_id") || "";
  const responseType = searchParams.get("response_type") || "code";
  const codeChallenge = searchParams.get("code_challenge") || "";
  const codeChallengeMethod = searchParams.get("code_challenge_method") || "";
  const resource = searchParams.get("resource") || "";
  const scope = searchParams.get("scope") || "";
  const errorParam = searchParams.get("error") || "";

  if (!redirectUri) {
    return new Response("redirect_uri مطلوب", { status: 400 });
  }

  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>مصادقة منصة الدفعة لـ ChatGPT</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Cairo', sans-serif; background-color: #0b0f19; color: #f3f4f6; }
    .glass { background: rgba(17, 24, 39, 0.7); backdrop-filter: blur(12px); }
    .pulse-ring { animation: pulse-ring 2s cubic-bezier(0.215, 0.61, 0.355, 1) infinite; }
    @keyframes pulse-ring {
      0% { transform: scale(0.95); opacity: 1; }
      80%, 100% { transform: scale(1.4); opacity: 0; }
    }
  </style>
</head>
<body class="min-h-screen flex items-center justify-center p-4">
  <div class="absolute top-1/3 left-1/2 -translate-x-1/2 w-72 h-72 bg-blue-600/20 rounded-full blur-3xl pointer-events-none"></div>
  <div class="max-w-md w-full glass border border-gray-800 p-6 md:p-8 rounded-3xl space-y-6 shadow-2xl relative z-10">
    <div class="text-center space-y-3">
      <div class="relative w-14 h-14 mx-auto">
        <div class="absolute inset-0 rounded-2xl bg-blue-600/30 pulse-ring"></div>
        <div class="relative w-14 h-14 rounded-2xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center mx-auto text-2xl">🔑</div>
      </div>
      <h1 class="text-xl font-extrabold text-white">منح صلاحية ChatGPT للوصول للمنصة</h1>
      <p class="text-xs text-gray-400 leading-relaxed">
        أدخل مفتاح الـ API المولّد من لوحة الأدمن لتأكيد الربط مع ChatGPT.
      </p>
    </div>
    ${errorParam ? `<div class="bg-rose-950/60 border border-rose-500/30 text-rose-300 text-xs p-3 rounded-xl text-center">${errorParam}</div>` : ""}
    <form method="POST" action="/api/mcp/oauth/authorize" class="space-y-4">
      <input type="hidden" name="redirect_uri" value="${redirectUri.replace(/"/g, "&quot;")}" />
      <input type="hidden" name="state" value="${state.replace(/"/g, "&quot;")}" />
      <input type="hidden" name="client_id" value="${clientId.replace(/"/g, "&quot;")}" />
      <input type="hidden" name="response_type" value="${responseType}" />
      <input type="hidden" name="code_challenge" value="${codeChallenge.replace(/"/g, "&quot;")}" />
      <input type="hidden" name="code_challenge_method" value="${codeChallengeMethod.replace(/"/g, "&quot;")}" />
      <input type="hidden" name="resource" value="${resource.replace(/"/g, "&quot;")}" />
      <input type="hidden" name="scope" value="${scope.replace(/"/g, "&quot;")}" />
      <div class="space-y-2">
        <label class="text-xs font-medium text-gray-300">مفتاح API (BMP Key)</label>
        <input type="password" name="api_key" placeholder="bmp_key_..." required autocomplete="off"
          class="w-full bg-gray-950 border border-gray-800 rounded-xl px-3.5 py-2.5 text-sm text-gray-100 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 font-mono transition" />
        <p class="text-[10px] text-gray-500">يبدأ بـ <code class="text-blue-400">bmp_key_</code></p>
      </div>
      <div class="bg-blue-950/30 border border-blue-500/20 p-3 rounded-xl text-[11px] text-blue-200/80 space-y-1">
        <p><strong class="text-blue-300">الصلاحيات الممنوحة:</strong></p>
        <ul class="space-y-0.5 text-blue-200/70">
          <li>• قراءة استفسارات الطلاب المعلقة</li>
          <li>• اقتراح ردود ذكية على الاستفسارات</li>
          <li>• نشر إعلانات وتكليفات جديدة</li>
          <li>• الوصول لسياق الدفعة والجداول</li>
        </ul>
      </div>
      <button type="submit" class="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-xl transition shadow-lg shadow-blue-600/25 text-sm">
        تأكيد ومنح الصلاحية
      </button>
    </form>
    <div class="pt-3 border-t border-gray-800/80 text-center">
      <a href="/admin" class="text-[11px] text-gray-500 hover:text-gray-300 transition">ليس لديك مفتاح؟ أنشئ واحداً من لوحة الأدمن</a>
    </div>
  </div>
</body>
</html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const apiKey = formData.get("api_key")?.toString().trim() || "";
    const redirectUri = formData.get("redirect_uri")?.toString().trim() || "";
    const state = formData.get("state")?.toString().trim() || "";
    const clientId = formData.get("client_id")?.toString().trim() || "";
    const codeChallenge = formData.get("code_challenge")?.toString().trim() || "";
    const codeChallengeMethod = formData.get("code_challenge_method")?.toString().trim() || "";
    const resource = formData.get("resource")?.toString().trim() || "";
    const scope = formData.get("scope")?.toString().trim() || "";

    if (!apiKey || !redirectUri) {
      return new Response("مطلوب: api_key + redirect_uri", { status: 400 });
    }

    const { valid, keyId, name } = await verifyApiKey(apiKey);
    if (!valid) {
      const errUrl = new URL("/api/mcp/oauth/authorize", request.url);
      errUrl.searchParams.set("redirect_uri", redirectUri);
      errUrl.searchParams.set("state", state);
      errUrl.searchParams.set("client_id", clientId);
      if (codeChallenge) errUrl.searchParams.set("code_challenge", codeChallenge);
      if (codeChallengeMethod) errUrl.searchParams.set("code_challenge_method", codeChallengeMethod);
      if (resource) errUrl.searchParams.set("resource", resource);
      errUrl.searchParams.set("error", "مفتاح API غير صحيح أو منتهي");
      return NextResponse.redirect(errUrl.toString());
    }

    const codePayload = {
      k: apiKey,
      t: Date.now(),
      kid: keyId || null,
      name: name || null,
      cid: clientId,
      cc: codeChallenge,
      ccm: codeChallengeMethod,
      res: resource,
      scp: scope,
    };
    const authCode = Buffer.from(JSON.stringify(codePayload)).toString("base64url");

    const callbackUrl = new URL(redirectUri);
    callbackUrl.searchParams.set("code", authCode);
    if (state) callbackUrl.searchParams.set("state", state);

    return NextResponse.redirect(callbackUrl.toString());
  } catch (error: any) {
    return new Response(`OAuth authorize error: ${error.message}`, { status: 500 });
  }
}
