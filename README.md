# 🎓 منصة إدارة الدفعة (Batch Management Platform)

> منصة طلابية ذكية تعتمد على **Next.js 16 + Supabase + خادم MCP** لربط ChatGPT مباشرة.
> **v2.1.0 — إصدار الإنتاج:** أمان محصّن، Rate Limiting، دعم 1000+ مستخدم متزامن.

[![Status](https://img.shields.io/badge/status-production--ready-brightgreen)]()
[![Version](https://img.shields.io/badge/version-2.1.0-blue)]()
[![MCP](https://img.shields.io/badge/MCP-2025--06--18-purple)]()

---

## ✨ المميزات

- 📱 **واجهة طلاب PWA** بدون تسجيل دخول — إعلانات، تكليفات، استفسارات، روابط سريعة
- 🛡️ **لوحة أدمن محمية** بـ Supabase Auth + Middleware (fail-closed) + Rate Limiting
- 🤖 **خادم MCP v3.1** — ~55 أداة تغطي كل وظائف الأدمن عبر Supabase Edge Function
- 🔐 **مصادقة مرنة**: Bearer Token، x-api-key، OAuth 2.0 (كود صالح 10 دقائق، توكن 30 يوماً)
- 📊 **Supabase Database** مع RLS مقوّى (فحص دور فعلي) + RPC + فهارس أداء
- 🚦 **Rate Limiting ذري** في قاعدة البيانات — يحمي كل النقاط حتى مع 1000+ مستخدم
- 🧾 **سجل تدقيق MCP** — كل استدعاء أداة يُسجَّل (من/ماذا/متى/IP/النتيجة)
- ☁️ **Cloudflare Workers** deployment جاهز (دليل موحّد: `DEPLOYMENT.md`)

---

## 🚀 البدء السريع

```bash
# 1. تثبيت الحزم
npm install

# 2. تجهيز البيئة
cp .env.example .env.local   # عدّل القيم

# 3. تشغيل التطوير
npm run dev
# → http://localhost:3000

# 4. فحص الأنواع قبل النشر
npm run typecheck
```

> ⚠️ **مطلوب قبل الإنتاج:** تشغيل `supabase/migrations/20260930_production_hardening.sql` في SQL Editor (راجع `DEPLOYMENT.md`).

---

## 📋 المسارات الأساسية

| المسار | الوصف |
|-------|------|
| `/` | تحويل تلقائي لواجهة الطلاب |
| `/student` | واجهة الطلاب PWA |
| `/go/admin/login` | تسجيل دخول الأدمن (مسار مخفي) |
| `/go/admin` | لوحة تحكم الأدمن (محمية) |
| `/oauth/authorize` | صفحة موافقة OAuth لربط ChatGPT |
| `/api/health` | فحص صحة حقيقي (يفحص قاعدة البيانات) |
| `/api/mcp` | ⚠️ متقادم (410) — الخادم الرسمي: Supabase Edge Function |
| `/api/admin/*` | APIs الأدمن (محمية + Rate Limited) |

---

## 🤖 خادم MCP — Supabase Edge Function (الرسمي)

```json
{
  "mcpServers": {
    "batch-management": {
      "url": "https://<project-ref>.supabase.co/functions/v1/mcp",
      "headers": { "Authorization": "Bearer bmp_key_..." }
    }
  }
}
```

- **~55 أداة**: إعلانات، تكليفات، مواد، جدول (بمجموعاته)، مواعيد، **روابط المحاضرات**، استفسارات، تسليمات، حضور، إعدادات، فريق، **مفاتيح API**
- **Rate Limit**: 120 طلب/دقيقة لكل مفتاح (قابل للضبط)
- **OAuth**: كود صالح 10 دقائق، access token صالح 30 يوماً
- **Audit**: كل استدعاء يُسجَّل في `mcp_audit_log`

📖 **الدليل الكامل + ربط ChatGPT:** `mcp_config_guide.md`

---

## 🧪 الاختبار

```bash
# فحص أنواع TypeScript
npm run typecheck

# اختبار Edge Function MCP
npm run mcp:test:edge -- --token=$MCP_SECRET_TOKEN
```

---

## 📊 قاعدة البيانات

شغّل migrations في Supabase SQL Editor **بالترتيب**:

1. `supabase/migrations/20260924_initial_schema.sql` — الجداول الأساسية + RLS + RPC
2. `supabase/migrations/20260924_api_keys_table.sql` — جدول مفاتيح API
3. `supabase/migrations/20260925_api_keys_update.sql` — تحديثات أمان المفاتيح
4. `supabase/migrations/20260925_v3_schema.sql` — مواد وجدول ومواعيد وحضور
5. `supabase/migrations/20260925_admin_otp_table.sql` — (اختياري)
6. `supabase/migrations/20260925_admin_permissions.sql` — أذونات الفريق
7. `supabase/migrations/20260928_schedule_groups.sql` — مجموعات الجدول
8. **`supabase/migrations/20260930_production_hardening.sql` — إلزامي للإنتاج** (Rate Limits + RLS مقوّى + فهارس + Audit)

---

## ☁️ النشر

الدليل الموحّد الكامل: **`DEPLOYMENT.md`**

```bash
# نشر خادم MCP
./scripts/deploy-edge.sh

# تطبيق Next.js → Cloudflare Workers
npx opennextjs-cloudflare build
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx opennextjs-cloudflare deploy
```

---

## 🏗️ Architecture

```
الطلاب (1000+ متزامن) ──► Cloudflare Worker (Next.js PWA) ──► Supabase REST + RLS
الأدمن ────────────────► Cloudflare Worker (لوحة محمية) ────► Supabase Auth + DB
ChatGPT / Claude ──────► Supabase Edge Function (MCP v3.1) ─► Supabase DB
                                │
                                ├─ Rate Limit (rate_limits — ذرّي)
                                └─ Audit Log (mcp_audit_log)
```

---

## 🔒 الأمان — ما تم تحصينه في v2.1

| الثغرة | الإصلاح |
|---|---|
| Service Role Key مكشوف في المستودع | إزالة كاملة + انتقال لـ `wrangler secret` + إلزامية التدوير |
| Middleware يفشل مفتوحاً | أصبح fail-closed (أي خطأ مصادقة = رفض) |
| بيانات أدمن افتراضية معروضة في صفحة الدخول | أُزيلت |
| Brute Force على تسجيل الدخول | Rate Limit 10 محاولات/5 دقائق + رسائل موحدة (لا كشف للأرقام المسجلة) |
| OTP يستبدل كلمة مرور الأدمن | مسار OTP أُزيل بالكامل (دخول بكلمة المرور فقط) |
| Firebase SDK غير مستخدم | أُزيل من التبعيات (حزمة أخف وأسرع) |
| RLS تسمح لأي مستخدم مسجل بالكتابة | فحص دور فعلي `is_team_admin()` |
| مفاتيح API قابلة للقراءة من العميل | مقفلة على service role فقط |
| سبام الاستفسارات (إدخال مجهول) | Trigger Rate Limit في قاعدة البيانات + قيود طول |
| كشف أنواع TypeScript مخفي | `ignoreBuildErrors: false` |
| OAuth توكن صالح 10 سنوات | أصبح 30 يوماً + كود صالح 10 دقائق |

---

## 📚 التوثيق

- `DEPLOYMENT.md` — دليل النشر الموحّد + Checklist ما قبل الإطلاق
- `mcp_config_guide.md` — دليل ربط ChatGPT/Claude + قائمة الأدوات
- `PROJECT_EXECUTION_PLAN.md` — خطة التنفيذ

---

## 🆕 ما الجديد في v2.1.0

### 🔒 الأمان
- إزالة كل الأسرار من المستودع + `.gitignore` محصّن + إلزامية تدوير المفاتيح
- إزالة مسار OTP بالكامل مع ثغرة استبدال كلمة المرور
- إزالة Firebase (SDK غير مستخدم — حزمة أصغر)
- تقوية RLS: `is_team_admin()` بدل "أي مستخدم مسجل"
- قفل `api_keys` على service role فقط

### 🚦 Rate Limiting
- دالة ذرية `rate_limit_hit` في قاعدة البيانات (تعمل مع أي تزامن)
- حماية تلقائية للاستفسارات/التسليمات/الاشتراكات عبر Triggers
- حدود على الدخول وتغيير كلمة المرور وMCP

### 🤖 MCP v3.1
- ~55 أداة (كانت 7 في HTTP القديم) تشمل إدارة المفاتيح وروابط المحاضرات
- سجل تدقيق + Rate Limit لكل مفتاح + تحقق مدخلات
- إصلاح syntax error كان يمنع نشر الـ Edge Function

### ⚡ الأداء
- فهارس لكل الاستعلامات الساخنة (واجهة الطلاب)
- `/api/health` يفحص قاعدة البيانات فعلياً + `typecheck` script

---

## 📝 الترخيص

MIT License — حر للاستخدام والتعديل.
