# 🤖 دليل إعداد خادم MCP — Edge Function (الرسمي)

> ⚠️ **مهم:** خادم MCP عبر Next.js (`/api/mcp`) **قُدِّم للتقادم** (يرجع 410).
> الخادم الرسمي الوحيد الآن: **Supabase Edge Function**

**رابط الخادم:**
```
https://apcxwxnkntegbkimsmty.supabase.co/functions/v1/mcp
```

**الإصدار:** v3.7.0 — بروتوكول `2025-06-18` | 67 أداة | Rate Limit 120 طلب/دقيقة لكل مفتاح | سجل تدقيق كامل | **صلاحيات مرتبطة بحساب الأدمن**

---

## 🔑 المصادقة — طريقتان

### 1. مفتاح API (موصى به)
أنشئ مفتاحاً من **لوحة الأدمن → tab مفاتيح API** — أو حتى عبر MCP نفسه بأداة `create_api_key`.
المفاتيح قابلة للإبطال وتُسجَّل كل استخداماتها (IP + وقت).

### 2. التوكن السري (للاختبار فقط)
`MCP_SECRET_TOKEN` — يُضبط عبر: `supabase secrets set MCP_SECRET_TOKEN=...`

---

## ⚙️ الربط مع ChatGPT (Custom Connector)

1. **Settings → Connectors → Create** → اختر **MCP**
2. **Server URL:** `https://apcxwxnkntegbkimsmty.supabase.co/functions/v1/mcp`
3. **Authentication:** `OAuth` — سيكتشف ChatGPT تلقائياً:
   - `/.well-known/oauth-protected-resource` (RFC 9728)
   - `/.well-known/oauth-authorization-server` (RFC 8414)
   - تسجيل ديناميكي + صفحة موافقة على `/oauth/authorize`
4. الصق مفتاح API عند طلب الموافقة، وسيُصدر access token صالح 30 يوماً

أو مباشرة بـ Bearer:
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

## ⚙️ الربط مع Claude Desktop / VS Code

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

---

## 🛠️ الأدوات المتاحة (67)

### لوحة التحكم
| أداة | الوظيفة |
|---|---|
| `get_dashboard_stats` | إحصائيات شاملة (مفلترة حسب صلاحية العرض) |
| `search_platform` | بحث شامل في كل المحتوى (كل قسم بيرجع لو صاحب المفتاح مسموح له بعرضه) |
| `get_batch_context` | سياق شامل قبل توليد الردود (إعلانات + مهام + روابط + مواعيد) |

### التصنيفات (ديناميكية — جديدة في v3.7)
`list_categories` · `create_category` · `update_category` · `delete_category`

> تصنيفات **الإعلانات** و**الاستفسارات** بقت ديناميكية من جدول `categories` —
> الأدمن يضيفها/يعدلها من اللوحة (قسم الإعلانات والاستفسارات) أو الـ MCP هنا.
> `create_announcement` / `update_inquiry` بيتحققوا إن التصنيف معرف فعلاً (لو الجدول شغال).

### الإعلانات والتكليفات
`list_announcements` · `get_announcement` · `create_announcement` · `update_announcement` · `delete_announcement` · `list_tasks` · `get_task` · `create_task` · `create_academic_task` · `update_task` · `delete_task`

### المواد والجدول
`list_subjects` · `create_subject` · `update_subject` · `delete_subject` · **`upsert_subject_by_name` (بالاسم مباشرة — بدون UUID)** · `list_schedule` (فلترة باليوم والمجموعة والنوع والحضور + كل جلسة مع `time_display` بنظام 12 ساعة) · **`get_week_schedule` (الجدول كاملاً — الأيام بالترتيب والحصص مرتبة حسب الوقت)** · `create_schedule_session` · **`set_schedule_session` (بالاسم مباشرة — يُنشئ المادة تلقائياً لو غير موجودة)** · `update_schedule_session` · `delete_schedule_session`

> 💡 **أسهل طريقة لإضافة المواد والجدول من ChatGPT:** قل للـ MCP:
> "ضيف مادة قواعد بيانات وسكشن يوم الإثنين 2:30 م - 4:00 م أونلاين بلينك zoom" → سيستخدم `upsert_subject_by_name` ثم `set_schedule_session` بدون أي معرفات.

#### ⏰ قاعدة الوقت الموحدة (12 ساعة)
- ✍️ **الإدخال:** اكتب الوقت بنظام 12 ساعة بالعربي أو إنجليزي — `2:30 م` · `10:00 صباحاً` · `2:30 PM` · أو 24 ساعة `14:30` — التحويل تلقائي.
- 👁️ **الإخراج:** كل جلسة تعود مع `time_display` مثل `2:30 م - 4:00 م` + تسميات عربية `type_ar` و `mode_ar`.
- 🗄️ **التخزين:** HH:MM بنظام 24 (قاعدة البيانات) — والواجهة كلها تعرض 12 ساعة ص/م.

#### 🎯 نوع الحصة والحضور (عربي أو إنجليزي)
| الحقل | القيم المقبولة | تُخزن كـ |
|---|---|---|
| `type` (نوع الحصة) | `محاضرة` / `lecture` · `سكشن` / `section` / `tutorial` · `معمل` / `lab` · `امتحان` / `exam` · `أي` / `أي حصة` / `other` | lecture / tutorial / lab / exam / other |
| `lecture_type` (الحضور) | `أونلاين` / `online` · `اوفلاين` / `offline` / `جامعة` · `مختلط` / `hybrid` | online / university / hybrid |
| `room` (العنوان) | نص حر — مثل: قاعة 101 · مبنى 3 | room |
| `link` (اللينك) | رابط Zoom/Meet — يجب أن يبدأ بـ https:// | link |

> 📌 الطلاب يرون اللينك كزر **«انضم للحصة»** في الجدول والصفحة الرئيسية للحصص الأونلاين.

### المواعيد والروابط
`list_important_dates` · `create_important_date` · `update_important_date` · `delete_important_date` · `list_quick_links` · `create_quick_link` (**روابط المحاضرات** — يتطلب http/https صالح) · `update_quick_link` · `delete_quick_link`

### الاستفسارات
`list_inquiries` · `get_pending_inquiries` · `get_inquiry` · `update_inquiry` · `suggest_inquiry_reply` · `resolve_inquiry` · `delete_inquiry` · `get_inquiry_stats`

### التسليمات والحضور
`list_submissions` · `update_submission` (درجة + ملاحظات + حالة) · `delete_submission` · `list_attendance` · `upsert_attendance` · `delete_attendance`

### الإعدادات والفريق والمفاتيح
`list_settings` · `set_setting` · `delete_setting` · `list_notification_logs` · `create_notification_log` · `delete_notification_log` · `list_team_members` · `create_team_member` · `update_team_member` · `delete_team_member` · **`list_api_keys` · `create_api_key` · `revoke_api_key` · `delete_api_key`** · `list_push_subscriptions` · `delete_push_subscription`

---

## 🔐 الصلاحيات — الـ MCP بيتصرف بصلاحيات صاحب المفتاح (v3.7)

كل مفتاح API مربوط بحساب اللي أنشأه (`api_keys.created_by`) وصلاحياته هي نفس صلاحياته في لوحة التحكم:

- **الليدر / التوكن السري**: كل الأدوات (67)
- **المساعد**: بيوصله بس الأدوات اللي ليها علاقة بصلاحياته —
  ومحجوب من مورد (مثلاً `الاستفسارات → عرض = مفعّل ❌`) معناه:
  `list_inquiries` / `get_inquiry` / `delete_inquiry` كلها بترجع رفض **-32003** برسالة عربية واضحة،
  و`tools/list` مش بيعرضها من الأصل، وحتى `search_platform` بيرجع بدون قسم الاستفسارات
- **بوابة `MCP → عرض`**: أي عضو منفعلهش من الليدر مش يقدر يستخدم الـ MCP خالص
- **مفيش تصعيد**: مفتاح مساعد بيعمل مفتاح جديد بـ `create_api_key` → المفتاح الجديد بيرث صلاحياته هو
- **فشل آمن**: مفتاح مربوط بحساب مش عضو فريق أو فشل جلب الصلاحيات → كل الأدوات مرفوضة

> 🧪 **الشيك الحي** بعد النشر:
> `MCP_URL=... MCP_LEADER_KEY=... MCP_LIMITED_KEY=... node scripts/test-mcp-permissions.mjs`
> وفحص ثابت لتغطية الخريطة: `node scripts/check-mcp-tool-map.mjs`

## 🔒 ما الجديد في v3.3

- ✅ **الوقت 12 ساعة في كل مكان**: الـ MCP يقبل `2:30 م` / `10:00 ص` / `2:30 PM` / `14:30` ويوحدها تلقائياً + مخرجات `time_display` بنظام 12 ساعة عربي
- ✅ **نوع الحصة بالعربي**: `محاضرة` / `سكشن` (أو section) / `معمل` / `امتحان` / `أي` — تُحوّل تلقائياً وتُرفض القيم غير المعروفة برسالة واضحة
- ✅ **الحضور بالعربي**: `أونلاين` / `اوفلاين` / `جامعة` / `مختلط` — تُوحد لقيم قاعدة البيانات
- ✅ **حقل `link` جديد لجلسات الجدول** (migration: `20260930_schedule_link.sql`): رابط Zoom/Meet منفصل عن القاعة/العنوان + تحقق من صيغة الرابط — ويظهر كزر «انضم للحصة» للطلاب
- ✅ الواجهة كلها (الطالب + الإدارة) تعرض الوقت 12 ساعة ص/م + حقل منفصل للعنوان واللينك في إضافة الجلسة
- ✅ اختُبرت السلسلة كاملة على PostgreSQL 16 محلي (24 اختبار) + 65 اختبار لتوحيد المدخلات

## 🔒 ما الجديد في v3.2

- ✅ **`upsert_subject_by_name`** — إضافة مادة بالاسم مباشرة بدون UUID (يرجع الموجودة لو اسمها مطابق)
- ✅ **`set_schedule_session`** — إضافة جلسة للجدول بالاسم مباشرة، **يُنشئ المادة تلقائياً** لو غير موجودة + تحقق من صيغة الوقت HH:MM
- ✅ **`get_week_schedule`** — الجدول الأسبوعي كاملاً: الأيام بالترتيب والحصص مرتبة حسب الوقت + ملخص سريع لكل يوم
- ✅ ترتيب الجدول في الواجهة حسب الوقت + مواعيد قادمة تجمع أقرب الحصص من الجدول + تكليفات جديدة مرتبة من الأقرب انتهاءً

## 🔒 ما الجديد في v3.1

- ✅ إصلاح خطأ syntax كان يمنع نشر الـ Edge Function
- ✅ إضافة أدوات إدارة **مفاتيح API** كاملة (create/revoke/delete/list)
- ✅ إضافة `get_batch_context` و `suggest_inquiry_reply` و `resolve_inquiry` و `get_pending_inquiries` (توافق مع ChatGPT)
- ✅ دعم **مجموعات الجدول** (أ/ب/ج/د) و**نوع الحضور** (university/online/hybrid)
- ✅ **Rate Limiting** لكل مفتاح: 120 طلب/دقيقة (ذرّي في قاعدة البيانات، fail-open)
- ✅ **سجل تدقيق** لكل استدعاء أداة: من/ماذا/متى/نتيجة/مدة/IP → جدول `mcp_audit_log`
- ✅ تحقق من المدخلات: حد أقصى للنصوص + تحقق من صحة الروابط + حدود استعلامات
- ✅ أمان OAuth: كود صالح 10 دقائق، access token صالح 30 يوماً (كان 10 سنوات!)
- ✅ حقل `OAUTH_AUTHORIZE_URL` قابل للضبط في الـ secrets

---

## 🧪 الاختبار

```bash
npm run mcp:test:edge -- --token=$MCP_SECRET_TOKEN
```

## 🚀 النشر

```bash
./scripts/deploy-edge.sh
```
