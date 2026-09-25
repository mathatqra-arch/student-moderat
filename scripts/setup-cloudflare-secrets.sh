#!/usr/bin/env bash
# ==========================================
# Cloudflare Workers Secrets Setup
# يضيف FIREBASE_SERVICE_ACCOUNT_JSON كـ secret على Cloudflare
# ==========================================
set -e

cd "$(dirname "$0")/.."

echo "═══════════════════════════════════════════════════"
echo "🔐 إعداد Firebase Service Account كـ secret على Cloudflare"
echo "═══════════════════════════════════════════════════"

# التحقق من تثبيت wrangler
if ! command -v wrangler &> /dev/null; then
  echo "❌ wrangler CLI غير مثبّت."
  echo "   ثبّته عبر: npm install -g wrangler"
  exit 1
fi

# التحقق من تسجيل الدخول
if ! wrangler whoami &> /dev/null; then
  echo "⚠️  يجب تسجيل الدخول لـ Cloudflare أولاً"
  wrangler login
fi

# قراءة FIREBASE_SERVICE_ACCOUNT_JSON من .env.local
echo ""
echo "📄 قراءة FIREBASE_SERVICE_ACCOUNT_JSON من .env.local..."

if [ ! -f ".env.local" ]; then
  echo "❌ .env.local غير موجود"
  exit 1
fi

SA_JSON=$(grep "^FIREBASE_SERVICE_ACCOUNT_JSON=" .env.local | sed 's/^FIREBASE_SERVICE_ACCOUNT_JSON=//' | tr -d '"' | head -1)

if [ -z "$SA_JSON" ]; then
  echo "❌ FIREBASE_SERVICE_ACCOUNT_JSON غير موجود في .env.local"
  echo "   تأكد من إضافته بتنسيق JSON صحيح على سطر واحد"
  exit 1
fi

echo "✅ تم العثور على Service Account JSON (${#SA_JSON} حرف)"
echo ""

# رفع الـ secret لـ Cloudflare
echo "🚀 رفع FIREBASE_SERVICE_ACCOUNT_JSON كـ secret على Cloudflare..."
echo "$SA_JSON" | wrangler secret put FIREBASE_SERVICE_ACCOUNT_JSON

echo ""
echo "✅ تم رفع الـ secret بنجاح!"
echo ""
echo "═══════════════════════════════════════════════════"
echo "🎉 اكتمل الإعداد!"
echo "═══════════════════════════════════════════════════"
echo ""
echo "📋 الخطوات التالية:"
echo "1. اذهب إلى Cloudflare Dashboard → Workers & Pages → student-moderat"
echo "2. تأكد من إنشاء deploy جديد يحتوي على التحديثات الأخيرة"
echo "3. اختبر: https://student-moderat.mathatqra.workers.dev/api/admin/firebase/setup"
echo "   يجب أن يرجع ready: true"
echo ""
