# Student Moderat — UI/UX Overhaul + Full-Control MCP

تم تجهيز نسخة تنفيذية جديدة مبنية على المستودع:
`mathatqra-arch/student-moderat`

## الواجهة
- إعادة بناء واجهة `/student` لتكون Dashboard تعليمية قريبة من الـ reference المرفوع.
- إعادة بناء إطار لوحة `/admin` بنفس الهوية، مع Dashboard إدارية، Sidebar، وواجهة موبايل وإضافة قسم الجدول والمواد إلى التنقل.
- Responsive بالكامل: Desktop / Tablet / Mobile.
- Sidebar على الشاشات الكبيرة + Bottom Navigation على الموبايل.
- Hero للتقدم + إحصائيات + إعلانات + مواعيد + تكليفات + مواد + روابط + استفسارات.
- بحث سريع داخل محتوى المنصة.
- ألوان وهوية: Navy / Cyan / Teal / Cream مع دعم Dark Mode.
- الأيقونة المرفوعة أصبحت أيقونة الموقع وPWA.
- `manifest.json` يبدأ التطبيق من `/student`.

## MCP
أُضيف endpoint مستقل حتى لا يتكسر MCP الحالي:

`/functions/v1/mcp-full`

يضم أدوات CRUD وتحكم للموارد الموجودة في قاعدة البيانات:
- Dashboard + search
- Announcements
- Tasks
- Subjects
- Schedule sessions
- Important dates
- Quick links
- Inquiries + stats
- Submissions
- Attendance
- Settings + app_settings
- Notification logs
- Team members
- Push subscriptions

الإجمالي: 50+ أداة في endpoint واحد.

### Authentication
يدعم:
```http
Authorization: Bearer <MCP_SECRET_TOKEN>
```

أو مفتاح نشط من `api_keys.key_value`.

### Deploy
```bash
supabase functions deploy mcp-full
```

ثم استخدم:
```text
https://YOUR_PROJECT.supabase.co/functions/v1/mcp-full
```

## الملفات المعدلة/المضافة
- `src/app/student/page.tsx`
- `src/app/admin/page.tsx`
- `src/app/globals.css`
- `src/app/layout.tsx`
- `public/manifest.json`
- `public/icons/icon-192.png`
- `public/icons/icon-512.png`
- `supabase/functions/mcp-full/index.ts`

## ملاحظة GitHub
اتصال GitHub المتاح في جلسة التنفيذ الحالية كان بصلاحية قراءة فقط (`pull`)، ومحاولة إنشاء branch أعادت 403. لذلك لم يتم الادعاء بعمل push أو commit على المستودع. الحزمة هنا جاهزة للنسخ إلى الريبو ثم البناء والنشر.
