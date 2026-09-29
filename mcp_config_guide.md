# 🤖 دليل إعداد خادم MCP — Edge Function (الرسمي)

> ⚠️ **مهم:** خادم MCP عبر Next.js (`/api/mcp`) **قُدِّم للتقادم** (يرجع 410).
> الخادم الرسمي الوحيد الآن: **Supabase Edge Function**

**رابط الخادم:**
```
https://apcxwxnkntegbkimsmty.supabase.co/functions/v1/mcp
```

**الإصدار:** v3.1.0 — بروتوكول `2025-06-18` | ~55 أداة | Rate Limit 120 طلب/دقيقة لكل مفتاح | سجل تدقيق كامل

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

## 🛠️ الأدوات المتاحة (~55)

### لوحة التحكم
| أداة | الوظيفة |
|---|---|
| `get_dashboard_stats` | إحصائيات شاملة لكل الجداول |
| `search_platform` | بحث شامل في كل المحتوى |
| `get_batch_context` | سياق شامل قبل توليد الردود (إعلانات + مهام + روابط + مواعيد) |

### الإعلانات والتكليفات
`list_announcements` · `get_announcement` · `create_announcement` · `update_announcement` · `delete_announcement` · `list_tasks` · `get_task` · `create_task` · `create_academic_task` · `update_task` · `delete_task`

### المواد والجدول
`list_subjects` · `create_subject` · `update_subject` · `delete_subject` · `list_schedule` (بفلتر المجموعة أ/ب/ج/د ونوع الحضور) · `create_schedule_session` · `update_schedule_session` · `delete_schedule_session`

### المواعيد والروابط
`list_important_dates` · `create_important_date` · `update_important_date` · `delete_important_date` · `list_quick_links` · `create_quick_link` (**روابط المحاضرات** — يتطلب http/https صالح) · `update_quick_link` · `delete_quick_link`

### الاستفسارات
`list_inquiries` · `get_pending_inquiries` · `get_inquiry` · `update_inquiry` · `suggest_inquiry_reply` · `resolve_inquiry` · `delete_inquiry` · `get_inquiry_stats`

### التسليمات والحضور
`list_submissions` · `update_submission` (درجة + ملاحظات + حالة) · `delete_submission` · `list_attendance` · `upsert_attendance` · `delete_attendance`

### الإعدادات والفريق والمفاتيح
`list_settings` · `set_setting` · `delete_setting` · `list_notification_logs` · `create_notification_log` · `delete_notification_log` · `list_team_members` · `create_team_member` · `update_team_member` · `delete_team_member` · **`list_api_keys` · `create_api_key` · `revoke_api_key` · `delete_api_key`** · `list_push_subscriptions` · `delete_push_subscription`

---

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
