# 🎓 منصة إدارة الدفعة (Batch Management Platform)

> منصة طلابية ذكية تعتمد على **Next.js 16 + Supabase + خادم MCP** لربط ChatGPT مباشرة.

[![Status](https://img.shields.io/badge/status-production--ready-brightgreen)]()
[![Version](https://img.shields.io/badge/version-2.0.0-blue)]()
[![MCP](https://img.shields.io/badge/MCP-2025--03--26-purple)]()

---

## ✨ المميزات

- 📱 **واجهة طلاب PWA** بدون تسجيل دخول — إعلانات، تكليفات، استفسارات، روابط سريعة
- 🛡️ **لوحة أدمن محمية** بـ Supabase Auth مع middleware
- 🤖 **خادم MCP v2.0.0** — 7 أدوات ذكاء اصطناعي عبر HTTP/SSE/stdio
- 🔐 **3 طرق مصادقة**: Bearer Token، x-api-key، OAuth 2.0 Authorization Code
- 📊 **Supabase Database** مع RLS + RPC functions + 7 جداول
- ☁️ **Cloudflare Pages** deployment جاهز

---

## 🚀 البدء السريع

```bash
# 1. تثبيت الحزم
npm install

# 2. تجهيز البيئة
cp .env.example .env.local   # عدّل القيم إن لزم

# 3. تشغيل التطوير
npm run dev
# → http://localhost:3000

# 4. (اختياري) تشغيل خادم MCP stdio لـ Claude Desktop
npm run mcp:start
```

---

## 📋 المسارات الأساسية

| المسار | الوصف |
|-------|------|
| `/` | الصفحة الرئيسية |
| `/student` | واجهة الطلاب PWA |
| `/admin/login` | تسجيل دخول الأدمن |
| `/admin` | لوحة تحكم الأدمن (محمية) |
| `/api/mcp` | خادم MCP عبر HTTP |
| `/api/mcp/oauth/authorize` | نافذة OAuth لـ ChatGPT |
| `/api/mcp/oauth/token` | تبديل OAuth code بـ access token |
| `/api/mcp/openapi.json` | مخطط OpenAPI |
| `/api/admin/keys` | إدارة مفاتيح API (محمي) |
| `/api/health` | فحص صحة النظام |

---

## 🤖 خادم MCP — ثلاث طرق للربط

### 1️⃣ عبر HTTP (Next.js API Route)
```json
{
  "mcpServers": {
    "batch-management": {
      "url": "http://localhost:3000/api/mcp",
      "headers": { "Authorization": "Bearer bmp_key_..." }
    }
  }
}
```

### 2️⃣ عبر Supabase Edge Function (الإنتاج)
```json
{
  "mcpServers": {
    "batch-management": {
      "url": "https://apcxwxnkntegbkimsmty.supabase.co/functions/v1/mcp",
      "headers": { "Authorization": "Bearer bmp_key_..." }
    }
  }
}
```

### 3️⃣ عبر stdio (محلي مع Claude Desktop)
```json
{
  "mcpServers": {
    "batch-management": {
      "command": "npx",
      "args": ["tsx", "mcp/server.ts"]
    }
  }
}
```

📖 **دليل التكوين الكامل:** `mcp_config_guide.md`

---

## 🛠️ أدوات MCP المتاحة (7 tools)

| الأداة | الوصف |
|------|------|
| `get_pending_inquiries` | استرجاع استفسارات الطلاب المعلقة |
| `suggest_inquiry_reply` | حفظ رد مقترح وتحديث الحالة |
| `create_announcement` | نشر إعلان جديد للطلاب |
| `create_academic_task` | إضافة تكليف دراسي بموعد تسليم |
| `get_batch_context` | سياق شامل (إعلانات + مهام + روابط) |
| `get_inquiry_stats` 🆕 | إحصائيات الاستفسارات |
| `resolve_inquiry` 🆕 | إغلاق استفسار كمحلول |

---

## 🧪 الاختبار

```bash
# اختبار HTTP MCP server (11 اختبار)
npm run mcp:test

# اختبار stdio MCP server (5 اختبارات)
npm run mcp:test:stdio

# اختبار Supabase Edge Function
npm run mcp:test:edge --token=$MCP_SECRET_TOKEN
```

---

## 📊 قاعدة البيانات

شغّل migration SQL في Supabase SQL Editor بالترتيب:

1. `supabase/migrations/20260924_initial_schema.sql` — كل الجداول + RLS + RPC
2. `supabase/migrations/20260924_api_keys_table.sql` — جدول مفاتيح API
3. `supabase/migrations/20260925_api_keys_update.sql` 🆕 — تحديثات الأمان على api_keys

---

## ☁️ النشر

### Supabase Edge Function
```bash
./scripts/deploy-edge.sh
```

### Cloudflare Pages
انظر `cloudflare_deployment_guide.md`

---

## 🏗️ Architecture

```
ChatGPT / Claude / VS Code
        │
        ▼
┌─────────────────────────────────────────┐
│  MCP HTTP Server                        │
│  ├─ /api/mcp            (Next.js)       │
│  ├─ /functions/v1/mcp   (Supabase)      │
│  └─ mcp/server.ts       (stdio)         │
└─────────────┬───────────────────────────┘
              ▼
┌─────────────────────────────────────────┐
│  Supabase Database                       │
│  ├─ inquiries (RLS)                     │
│  ├─ announcements (RLS)                 │
│  ├─ tasks (RLS)                         │
│  ├─ api_keys (revoked_at, last_used_ip) │
│  ├─ quick_links, team_members, settings │
│  └─ push_subscriptions                  │
└─────────────────────────────────────────┘
```

---

## 📚 التوثيق

- `PROJECT_EXECUTION_PLAN.md` — خطة التنفيذ الكاملة
- `mcp_config_guide.md` — دليل تكوين MCP الشامل
- `cloudflare_deployment_guide.md` — دليل النشر على Cloudflare

---

## 🆕 ما الجديد في v2.0.0

### 🔒 الأمان
- ✅ إزالة backdoor في تسجيل دخول الأدمن
- ✅ Middleware لحماية `/admin` و `/api/admin/*`
- ✅ إزالة ثغرة "fallback no-token" في MCP server
- ✅ تحقق من revoked API keys + تسجيل IP آخر استخدام

### 🛠️ MCP Server
- ✅ ترقية لـ MCP protocol `2025-03-26`
- ✅ Streamable HTTP transport + SSE + Session management
- ✅ إضافة `get_inquiry_stats` و `resolve_inquiry` (7 أدوات الآن)
- ✅ JSON-RPC batch requests support

### 🎨 OAuth
- ✅ إصلاح bug الـ `className` في HTML
- ✅ نافذة OAuth محسّنة بتصميم احترافي
- ✅ base64url JSON payload للـ authorization code

### 🧪 الاختبار والتوثيق
- ✅ 11 اختبار HTTP + 5 اختبارات stdio
- ✅ سكربت نشر تلقائي للـ Edge Function
- ✅ توثيق شامل محدّث

---

## 📝 الترخيص

MIT License — حر للاستخدام والتعديل.
