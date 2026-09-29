# ☁️ دليل النشر الكامل — منصة إدارة الدفعة v2.1

> دليل موحّد رسمي. الدليل القديم (`next-on-pages`) لم يعد مستخدماً — هذا المستودع يُنشر عبر **Cloudflare Workers (OpenNext)**.

---

## 🗺️ نظرة عامة على المعمارية

```
الطلاب (1000+ مستخدم متزامن) ──► Cloudflare Worker (Next.js) ──► Supabase (REST + RLS)
الأدمن ──────────────────────► Cloudflare Worker (Next.js) ──► Supabase Auth + DB
ChatGPT / Claude ───────────► Supabase Edge Function (MCP) ──► Supabase DB (service role)
```

**لماذا هذا التصميم يتحمل 1000 مستخدم متزامن؟**
- الصفحات تُخدَّم من شبكة Cloudflare العالمية (CDN + Workers scale تلقائياً)
- قراءات الطلاب تمر عبر PostgREST (Supabase) — يتحمل آلاف الطلبات/ثانية
- كل الاستعلامات الساخنة مغطاة بفهارس (migration: `20260930_production_hardening.sql`)
- Rate Limiting ذري في قاعدة البيانات يحمي من الإساءة دون تسريب ذاكرة

---

## ✅ قبل النشر — Checklist إلزامي

### 1. تدوير المفاتيح المكشوفة (حرج!)
المفاتيح القديمة ظهرت سابقاً في تاريخ Git — **لا بد من تدويرها**:

| المفتاح | من أين تجدّده |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Settings → API → Rotate service_role |
| `MCP_SECRET_TOKEN` | يُعاد توليده تلقائياً عند نشر الـ Edge Function (`deploy-edge.sh`) |

### 2. تشغيل Migration التقوية (إلزامي — مرة واحدة)
افتح **Supabase Dashboard → SQL Editor** وشغّل الملف:
```
supabase/migrations/20260930_production_hardening.sql
```
هذا الملف يضيف: Rate Limiting، حماية الاستفسارات من السبام، سجل تدقيق MCP، تقوية RLS، وفهارس الأداء.

### 3. ترتيب تشغيل كل الـ Migrations (إن كانت قاعدة جديدة)
1. `20260924_initial_schema.sql`
2. `20260924_api_keys_table.sql`
3. `20260925_api_keys_update.sql`
4. `20260925_v3_schema.sql`
5. `20260925_admin_otp_table.sql` *(اختياري — جدول فقط)*
6. `20260925_admin_permissions.sql`
7. `20260928_schedule_groups.sql`
8. `20260930_production_hardening.sql` ← **الأهم**

---

## 🚀 النشر على Cloudflare Workers

### أ. ربط المستودع (Build تلقائي)
1. Cloudflare Dashboard → **Workers & Pages** → **Create** → **Workers** → **Connect to Git**
2. اختر مستودع `student-moderat`
3. الإعدادات:

| الإعداد | القيمة |
|---|---|
| Build command | `npx opennextjs-cloudflare build` |
| Deploy command | `npx opennextjs-cloudflare deploy` (أو اتركه فارغاً للنشر التلقائي) |
| Root directory | *(فارغ)* |
| Compatibility flags | `nodejs_compat` (موجودة في wrangler.jsonc) |

### ب. متغيرات البيئة العامة (Build variables)
| الاسم | القيمة |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | مفتاح anon العام |
| `NODE_VERSION` | `20` |

### ج. الأسرار (Secrets) — **ليست متغيرات عادية!**
```bash
npm install -g wrangler
wrangler login
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
# الصق قيمة المفتاح عند الطلب
```
> ⚠️ لا تضع `SUPABASE_SERVICE_ROLE_KEY` في `vars` داخل `wrangler.jsonc` أبداً — الأسرار فقط عبر `wrangler secret put` أو Dashboard → Settings → Variables → **Encrypted**.

---

## 🤖 نشر خادم MCP (Supabase Edge Function)

```bash
./scripts/deploy-edge.sh
```
السكربت يقوم بـ:
1. نشر `supabase/functions/mcp` على مشروعك
2. توليد `MCP_SECRET_TOKEN` جديد وضبطه كـ secret
3. طباعة رابط الـ Edge Function والتوكن

**رابط MCP بعد النشر:**
```
https://<project-ref>.supabase.co/functions/v1/mcp
```

**ربط ChatGPT/Claude:** راجع `mcp_config_guide.md` — ينصح بإنشاء مفتاح API من لوحة الأدمن (tab: مفاتيح API) أو أداة `create_api_key` في MCP نفسها.

---

## 🧪 التحقق بعد النشر

```bash
# 1. صحة التطبيق (يفحص قاعدة البيانات فعلياً)
curl https://your-worker.workers.dev/api/health

# 2. صحة MCP
curl -X POST https://<project-ref>.supabase.co/functions/v1/mcp \
  -H "Authorization: Bearer <your-api-key>" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'

# 3. اختبارات شاملة لـ MCP
npm run mcp:test:edge -- --token=<your-token>
```

---

## 📊 حدود الاستخدام المضبوطة (Rate Limits)

| النقطة | الحد | ملاحظة |
|---|---|---|
| MCP (كل مفتاح) | 120 طلب/دقيقة | قابل للتعديل: `supabase secrets set MCP_RATE_LIMIT_PER_MIN` |
| تسجيل دخول الأدمن | 10 محاولات/5 دقائق لكل IP | fail-closed مع رسائل موحدة |
| استفسارات الطلاب | 5 رسائل/10 دقائق لكل IP | Trigger في قاعدة البيانات |
| تسليمات الطلاب | 10/10 دقائق لكل IP | Trigger في قاعدة البيانات |
| تغيير كلمة المرور | 5/10 دقائق لكل IP | |

> الحدود تعمل على مستوى قاعدة البيانات (atomic) — تعمل بنفس الفعالية مع 1000 مستخدم متزامن وبأي عدد من خوادم الويب.

---

## 🔧 صيانة دورية

- **سجل تدقيق MCP:** راجع جدول `mcp_audit_log` أسبوعياً (من مخل؟ ماذا نفّذ؟)
- **تنظيف rate_limits:** تلقائي (تنظيف احتمالي مدمج)
- **تنظيف استفسارات قديمة:** `SELECT public.clean_old_inquiries(90);`
- **مراقبة الأداء:** Supabase Dashboard → Reports (CPU, connections, slow queries)

---

## 🆘 مشاكل شائعة

| المشكلة | الحل |
|---|---|
| `rate_limit_hit function not found` | شغّل `20260930_production_hardening.sql` (النظام سيعمل بلا حدود حتى ذلك — fail-open) |
| `SUPABASE_SERVICE_ROLE_KEY is not configured` | أضف الـ secret عبر `wrangler secret put` |
| أخطاء مصادقة الأدمن بعد النشر | تأكد أن `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY` مضبوطة في Build variables |
| MCP يرجع 401 | المفتاح مُبطل — أنشئ جديداً من لوحة الأدمن |
