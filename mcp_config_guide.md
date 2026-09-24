# 🤖 دليل ربط خادم MCP مع ChatGPT و Supabase Edge Function

> **الإصدار:** 2.0.0 — يدعم MCP protocol `2025-03-26` + Streamable HTTP + OAuth2 + API Key

---

## 🎯 ثلاث طرق لتشغيل خادم MCP

| الطريقة | URL / Command | الاستخدام |
|---------|--------------|-----------|
| **1. Next.js API Route** | `http://localhost:3000/api/mcp` | تطوير محلي + نشر على Cloudflare |
| **2. Supabase Edge Function** | `https://apcxwxnkntegbkimsmty.supabase.co/functions/v1/mcp` | الإنتاج — أسرع وأرخص |
| **3. Local stdio** | `npm run mcp:start` | Claude Desktop / VS Code MCP integration |

---

## 📌 1. تكوين MCP لـ ChatGPT Custom GPT (HTTP)

في ChatGPT → Explore GPTs → Create → Configure → Add Action:

### Schema URL:
```
https://student-moderat.mathatqra.workers.dev/api/mcp/openapi.json
```

### Authentication:
- اختر **Bearer Token**
- أدخل مفتاح `bmp_key_...` المولّد من لوحة الأدمن

أو استخدم **OAuth 2.0** (الإعداد الموصى به):
- Authorization URL: `https://student-moderat.mathatqra.workers.dev/api/mcp/oauth/authorize`
- Token URL: `https://student-moderat.mathatqra.workers.dev/api/mcp/oauth/token`

---

## 📌 2. تكوين MCP JSON لـ Claude Desktop / VS Code

### الطريقة A — عبر HTTP (Next.js route):

```json
{
  "mcpServers": {
    "batch-management": {
      "url": "http://localhost:3000/api/mcp",
      "headers": {
        "Authorization": "Bearer bmp_key_YOUR_KEY_HERE"
      }
    }
  }
}
```

### الطريقة B — عبر Supabase Edge Function:

```json
{
  "mcpServers": {
    "batch-management": {
      "url": "https://apcxwxnkntegbkimsmty.supabase.co/functions/v1/mcp",
      "headers": {
        "Authorization": "Bearer bmp_key_YOUR_KEY_HERE"
      }
    }
  }
}
```

### الطريقة C — عبر stdio (local):

```json
{
  "mcpServers": {
    "batch-management": {
      "command": "npx",
      "args": ["tsx", "mcp/server.ts"],
      "cwd": "/absolute/path/to/student-moderat"
    }
  }
}
```

---

## 🛠️ الأدوات المتاحة (7 tools)

| الأداة | الوصف | المعطيات المطلوبة |
|------|------|---------|
| `get_pending_inquiries` | استرجاع استفسارات الطلاب | `status` (اختياري: new/in_progress/resolved/archived/all), `limit` |
| `suggest_inquiry_reply` | حفظ رد مقترح وتحديث الحالة | `inquiry_id`, `reply_text`, `new_status` |
| `create_announcement` | نشر إعلان جديد | `title`, `content`, `category`, `is_pinned` |
| `create_academic_task` | إضافة تكليف دراسي | `subject`, `title`, `deadline` (ISO 8601), `description` |
| `get_batch_context` | سياق شامل (إعلانات + مهام + روابط) | لا شيء |
| `get_inquiry_stats` | إحصائيات الاستفسارات | لا شيء |
| `resolve_inquiry` | إغلاق استفسار كمحلول | `inquiry_id`, `resolution_note` |

---

## 🔐 المصادقة

يدعم خادم MCP ثلاث طرق للمصادقة:

### 1. Bearer Token (موصى به)
```http
Authorization: Bearer bmp_key_xxxxxxxxxxxxxxxx
```

### 2. API Key Header
```http
x-api-key: bmp_key_xxxxxxxxxxxxxxxx
```

### 3. OAuth 2.0 (Authorization Code flow)
- Authorize: `/api/mcp/oauth/authorize`
- Token: `/api/mcp/oauth/token`
- يدعم redirect URIs من ChatGPT و Claude Desktop

### توليد مفتاح API
1. ادخل لوحة الأدمن: `/admin` → تبويب "مفاتيح API & ChatGPT"
2. أدخل اسماً للمفتاح واضغط "توليد مفتاح جديد"
3. احفظ المفتاح في مكان آمن — لا يُعرض مرة أخرى

---

## 🧪 اختبار خادم MCP

### اختبار HTTP route (Next.js):
```bash
# بعد تشغيل npm run dev
npm run mcp:test
```

### اختبار stdio server (local):
```bash
npm run mcp:test:stdio
```

### اختبار Supabase Edge Function:
```bash
# بعد نشر Edge Function
npm run mcp:test:edge --token=$MCP_SECRET_TOKEN
```

### اختبار يدوي بـ curl:
```bash
# Discovery
curl http://localhost:3000/api/mcp \
  -H "Authorization: Bearer bmp_key_..."

# Initialize
curl -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer bmp_key_..." \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{},"id":1}'

# List tools
curl -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer bmp_key_..." \
  -d '{"jsonrpc":"2.0","method":"tools/list","params":{},"id":2}'

# Create announcement
curl -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer bmp_key_..." \
  -d '{
    "jsonrpc":"2.0",
    "method":"tools/call",
    "params":{
      "name":"create_announcement",
      "arguments":{
        "title":"إعلان تجريبي",
        "content":"تم النشر عبر MCP!",
        "category":"هام"
      }
    },
    "id":3
  }'
```

---

## 🚀 نشر Supabase Edge Function

```bash
# 1. ثبّت Supabase CLI (إن لم يكن مثبّتاً)
npm install -g supabase

# 2. سجّل الدخول
supabase login

# 3. شغّل سكربت النشر التلقائي
./scripts/deploy-edge.sh
```

السكربت سـ:
- ينشر `supabase/functions/mcp/index.ts` كـ Edge Function
- يولّد `MCP_SECRET_TOKEN` عشوائياً ويضبطه كـ secret
- يطبع لك الـ URL والتوكن للاختبار

---

## 🔍 استكشاف الأخطاء

### المشكلة: `401 Unauthorized`
- تأكد أن المفتاح يبدأ بـ `bmp_key_` وأنه لم يُلغَ من لوحة الأدمن
- لو تستخدم `MCP_SECRET_TOKEN`، تأكد أنه مضبوط في `.env.local`

### المشكلة: Edge Function ترفض service_role key
- النسخة المنشورة قديمة. أعد نشرها عبر: `./scripts/deploy-edge.sh`

### المشكلة: `Cannot connect to localhost:3000`
- تأكد أن `npm run dev` يعمل في نافذة أخرى

### المشكلة: Claude Desktop لا يرى الأدوات
- في إعدادات Claude → Developer → Edit Config → أضف الإعداد
- أعد تشغيل Claude Desktop

---

## 📊 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    ChatGPT / Claude / VS Code                │
└─────────────────────────┬───────────────────────────────────┘
                          │ JSON-RPC 2.0 / HTTP / stdio
                          ▼
        ┌─────────────────┴─────────────────┐
        │                                    │
        ▼                                    ▼
┌──────────────────────┐        ┌──────────────────────────┐
│  Next.js API Route    │        │  Supabase Edge Function  │
│  /api/mcp             │        │  /functions/v1/mcp        │
│  (Streamable HTTP)   │        │  (HTTP + SSE)            │
└──────────┬───────────┘        └──────────┬───────────────┘
           │                                 │
           └──────────┬──────────────────────┘
                      ▼
           ┌──────────────────────┐
           │   Supabase Database  │
           │  - inquiries         │
           │  - announcements     │
           │  - tasks             │
           │  - api_keys          │
           │  - quick_links       │
           │  - team_members      │
           └──────────────────────┘
```

---

## 📚 المراجع

- [MCP Specification](https://spec.modelcontextprotocol.io/)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Next.js App Router](https://nextjs.org/docs/app)
