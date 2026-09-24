#!/usr/bin/env bash
# ==========================================
# Supabase Edge Function Deployment Helper
# ينشر خادم MCP المحدّث على Supabase Edge Functions
# ==========================================
set -e

cd "$(dirname "$0")/.."

echo "═══════════════════════════════════════════════════"
echo "🚀 نشر خادم MCP على Supabase Edge Function"
echo "═══════════════════════════════════════════════════"

# التحقق من تثبيت Supabase CLI
if ! command -v supabase &> /dev/null; then
  echo "❌ Supabase CLI غير مثبّت."
  echo "   ثبّته عبر: npm install -g supabase"
  echo "   أو: brew install supabase/tap/supabase"
  exit 1
fi

# التحقق من تسجيل الدخول
if ! supabase projects list &> /dev/null; then
  echo "⚠️  يجب تسجيل الدخول لـ Supabase أولاً"
  supabase login
fi

# إعداد المشروع
PROJECT_REF="apcxwxnkntegbkimsmty"
echo ""
echo "📌 المشروع المستهدف: $PROJECT_REF"
echo ""

# نشر الـ Edge Function (مع --no-verify-jwt للسماح بـ bearer tokens خارجية)
echo "📦 نشر Edge Function..."
supabase functions deploy mcp \
  --project-ref "$PROJECT_REF" \
  --no-verify-jwt

echo ""
echo "🔐 ضبط متغيرات البيئة..."

# ضبط MCP_SECRET_TOKEN (يولّد عشوائياً لو غير موجود)
if [ -z "$MCP_SECRET_TOKEN" ]; then
  MCP_SECRET_TOKEN="bmp_prod_$(openssl rand -hex 24)"
  echo "   توليد MCP_SECRET_TOKEN جديد: $MCP_SECRET_TOKEN"
fi

supabase secrets set \
  --project-ref "$PROJECT_REF" \
  MCP_SECRET_TOKEN="$MCP_SECRET_TOKEN"

echo ""
echo "✅ تم النشر بنجاح!"
echo ""
echo "🔗 رابط Edge Function:"
echo "   https://$PROJECT_REF.supabase.co/functions/v1/mcp"
echo ""
echo "🔑 التوكن السري للاختبار: $MCP_SECRET_TOKEN"
echo "   استخدمه في: Authorization: Bearer $MCP_SECRET_TOKEN"
echo ""
echo "📋 لاختبار الـ Edge Function:"
echo "   node scripts/test-mcp.js --edge --token=$MCP_SECRET_TOKEN"
echo "═══════════════════════════════════════════════════"
