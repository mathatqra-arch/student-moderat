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

PROJECT_REF="apcxwxnkntegbkimsmty"
FUNCTION_NAME="mcp"
FUNCTION_FILE="supabase/functions/mcp/index.ts"

# التحقق من وجود ملف الكود
if [ ! -f "$FUNCTION_FILE" ]; then
  echo "❌ ملف الكود غير موجود: $FUNCTION_FILE"
  exit 1
fi

echo "📁 الملف: $FUNCTION_FILE"
echo "📌 المشروع: $PROJECT_REF"
echo "🏷️  اسم الـ Function: $FUNCTION_NAME"
echo ""

# ==========================================
# الطريقة 1: supabase CLI
# ==========================================
if command -v supabase &> /dev/null; then
  echo "✅ تم العثور على Supabase CLI"
  
  # التحقق من تسجيل الدخول
  if ! supabase projects list &> /dev/null; then
    echo "⚠️  يجب تسجيل الدخول لـ Supabase أولاً"
    supabase login
  fi

  echo ""
  echo "📦 نشر Edge Function..."
  
  # نشر الـ Function
  supabase functions deploy $FUNCTION_NAME \
    --project-ref "$PROJECT_REF" \
    --no-verify-jwt
  
  echo ""
  echo "🔐 ضبط MCP_SECRET_TOKEN..."
  
  # توليد secret عشوائي
  MCP_SECRET_TOKEN="bmp_prod_$(openssl rand -hex 24)"
  echo "   توليد MCP_SECRET_TOKEN جديد"
  
  supabase secrets set \
    --project-ref "$PROJECT_REF" \
    MCP_SECRET_TOKEN="$MCP_SECRET_TOKEN"
  
  echo ""
  echo "✅ تم النشر بنجاح عبر Supabase CLI!"
  echo ""
  echo "🔑 MCP_SECRET_TOKEN:"
  echo "   $MCP_SECRET_TOKEN"
  
  exit 0
fi

# ==========================================
# الطريقة 2: تعليمات يدوية
# ==========================================
echo "⚠️  Supabase CLI غير مثبّت لديك"
echo ""
echo "📋 اختر طريقة للنشر:"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🅰️  الطريقة الأولى (موصى بها): ثبّت Supabase CLI"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  1. ثبّت CLI:"
echo "     npm install -g supabase"
echo ""
echo "  2. سجّل الدخول:"
echo "     supabase login"
echo ""
echo "  3. أعد تشغيل هذا السكربت:"
echo "     ./scripts/deploy-mcp-edge.sh"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🅱️  الطريقة الثانية: نشر يدوي من Supabase Dashboard"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  1. افتح: https://supabase.com/dashboard/project/$PROJECT_REF/functions/new"
echo ""
echo "  2. في حقل Name: اكتب"
echo "     $FUNCTION_NAME"
echo ""
echo "  3. في Body: الصق محتوى ملف $FUNCTION_FILE"
echo "     (تقدر تفتحه من: https://github.com/mathatqra-arch/student-moderat/blob/main/$FUNCTION_FILE)"
echo ""
echo "  4. اضغط Deploy"
echo ""
echo "  5. بعد النشر، أضف Secret:"
echo "     - افتح: https://supabase.com/dashboard/project/$PROJECT_REF/functions/$FUNCTION_NAME/secrets"
echo "     - Add new secret"
echo "     - Name: MCP_SECRET_TOKEN"
echo "     - Value: bmp_prod_$(openssl rand -hex 24)"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🅲️  الطريقة الثالثة: استخدم Supabase Personal Access Token"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  1. احصل على PAT من: https://supabase.com/dashboard/account/tokens"
echo "  2. شغّل:"
echo ""
echo "     export SUPABASE_ACCESS_TOKEN=sbp_your_token_here"
echo "     ./scripts/deploy-mcp-edge.sh"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "بعد النشر، استخدم:"
echo ""
echo "  🔗 MCP URL: https://$PROJECT_REF.supabase.co/functions/v1/$FUNCTION_NAME"
echo ""
echo "  🧪 اختبار OAuth discovery:"
echo "     curl https://$PROJECT_REF.supabase.co/functions/v1/$FUNCTION_NAME/.well-known/oauth-protected-resource"
echo ""

# لو عندك PAT، استخدمه
if [ -n "$SUPABASE_ACCESS_TOKEN" ]; then
  echo ""
  echo "🔐 استخدام SUPABASE_ACCESS_TOKEN للنشر..."
  
  # zip the function file
  FUNCTION_CONTENT=$(cat "$FUNCTION_FILE")
  
  # نشر عبر Management API
  curl -s -X POST \
    "https://api.supabase.com/v1/projects/$PROJECT_REF/functions" \
    -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d "$(jq -n --arg name "$FUNCTION_NAME" --arg body "$FUNCTION_CONTENT" --argjson verify_jwt false '{
      slug: $name,
      name: $name,
      body: $body,
      verify_jwt: $verify_jwt
    }')" 2>&1 | head -20
  
  exit $?
fi

exit 0
