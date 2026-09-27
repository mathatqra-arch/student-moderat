#!/usr/bin/env bash
# ==========================================
# Deploy MCP Edge Function to Supabase
# ينشر خادم MCP المحدّث على Supabase Edge Functions
# ==========================================
set -e

cd "$(dirname "$0")/.."

echo "═══════════════════════════════════════════════════"
echo "🚀 نشر خادم MCP على Supabase Edge Function"
echo "═══════════════════════════════════════════════════"
echo ""

# التحقق من تثبيت Supabase CLI
if ! command -v supabase &> /dev/null; then
  echo "❌ Supabase CLI غير مثبّت."
  echo ""
  echo "📝 لتثبيته عبر npm:"
  echo "   npm install -g supabase"
  echo ""
  echo "📝 أو عبر Homebrew (Mac):"
  echo "   brew install supabase/tap/supabase"
  echo ""
  echo "بعد التثبيت، شغّل:"
  echo "   supabase login"
  echo "   $0"
  exit 1
fi

# التحقق من تسجيل الدخول
if ! supabase projects list &> /dev/null; then
  echo "⚠️  يجب تسجيل الدخول لـ Supabase أولاً"
  supabase login
fi

PROJECT_REF="apcxwxnkntegbkimsmty"
echo "📌 المشروع المستهدف: $PROJECT_REF"
echo "📁 الملف: supabase/functions/mcp/index.ts"
echo ""

# نشر الـ Edge Function
echo "📦 نشر Edge Function..."
supabase functions deploy mcp \
  --project-ref "$PROJECT_REF" \
  --no-verify-jwt

echo ""
echo "🔐 ضبط MCP_SECRET_TOKEN..."

# توليد secret عشوائي لو مش موجود
if [ -z "$MCP_SECRET_TOKEN" ]; then
  MCP_SECRET_TOKEN="bmp_prod_$(openssl rand -hex 24)"
  echo "   توليد MCP_SECRET_TOKEN جديد: $MCP_SECRET_TOKEN"
fi

supabase secrets set \
  --project-ref "$PROJECT_REF" \
  MCP_SECRET_TOKEN="$MCP_SECRET_TOKEN"

echo ""
echo "═══════════════════════════════════════════════════"
echo "✅ تم النشر بنجاح!"
echo "═══════════════════════════════════════════════════"
echo ""
echo "🔗 رابط MCP:"
echo "   https://$PROJECT_REF.supabase.co/functions/v1/mcp"
echo ""
echo "🔗 OAuth endpoints:"
echo "   • Protected Resource: https://$PROJECT_REF.supabase.co/functions/v1/mcp/.well-known/oauth-protected-resource"
echo "   • AS Metadata:        https://$PROJECT_REF.supabase.co/functions/v1/mcp/.well-known/oauth-authorization-server"
echo "   • Authorize:          https://$PROJECT_REF.supabase.co/functions/v1/mcp/oauth/authorize"
echo "   • Token:              https://$PROJECT_REF.supabase.co/functions/v1/mcp/oauth/token"
echo "   • Register:           https://$PROJECT_REF.supabase.co/functions/v1/mcp/oauth/register"
echo ""
echo "🔑 MCP Secret Token:"
echo "   $MCP_SECRET_TOKEN"
echo ""
echo "📋 لربط ChatGPT:"
echo "   URL: https://$PROJECT_REF.supabase.co/functions/v1/mcp"
echo "   Token: $MCP_SECRET_TOKEN (أو مفتاح bmp_key_... من لوحة الأدمن)"
echo ""
echo "🧪 للاختبار:"
echo "   curl https://$PROJECT_REF.supabase.co/functions/v1/mcp/.well-known/oauth-protected-resource"
echo ""
