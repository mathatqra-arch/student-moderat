# ☁️ دليل إصلاح النشر على Cloudflare Pages (الإصدار المحدَّث)

## 🔴 سبب الخطأ السابق:
```
✘ [ERROR] The entry-point file at ".open-next/worker.js" was not found.
```
كان Cloudflare يحاول نشر كـ **Worker** باستخدام OpenNext، لكن الكود المنشور يستخدم `@cloudflare/next-on-pages` الذي يعمل مع **Cloudflare Pages** (ليس Workers).

---

## ✅ الحل: تغيير إعدادات Build في Cloudflare Dashboard

### اذهب إلى:
**Cloudflare Dashboard** → **Workers & Pages** → مشروعك → **Settings** → **Builds & Deployments**

---

### 🔧 إعدادات البناء الصحيحة:

| الإعداد | القيمة الصحيحة |
|---|---|
| **Framework preset** | `Next.js (Static HTML Export)` أو `None` |
| **Build command** | `npx @cloudflare/next-on-pages` |
| **Build output directory** | `.vercel/output/static` |
| **Deploy command** | *(اتركه فارغاً تماماً)* |
| **Root directory** | *(اتركه فارغاً)* |

---

### 📌 متغيرات البيئة (Environment Variables):
في قسم **Environment Variables** أضف:

| الاسم | القيمة |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://apcxwxnkntegbkimsmty.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | *(مفتاح الـ anon الخاص بك)* |
| `SUPABASE_SERVICE_ROLE_KEY` | *(مفتاح الـ service_role)* |
| `NODE_VERSION` | `18` |

---

## ⚠️ ملاحظة مهمة:
إذا كان نوع مشروعك **Worker** (وليس Pages)، يجب إنشاء مشروع جديد من نوع **Pages**:

1. احذف أو تجاهل المشروع الحالي (Worker)
2. اذهب إلى **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
3. اختر مستودع GitHub الخاص بك
4. ضع الإعدادات المذكورة أعلاه

---

## 🔗 روابط المشروع بعد النجاح:
- **الموقع:** `https://student-moderat.pages.dev`
- **MCP لـ ChatGPT:** `https://apcxwxnkntegbkimsmty.supabase.co/functions/v1/mcp`
