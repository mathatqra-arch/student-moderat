# 🤖 رابط ودليل ربط خادم MCP بشات جي بي تي (ChatGPT Edge Function)

منصة الدفعة مربوطة برابط **Supabase Edge Function المباشر** والمؤمن التالي:

🔗 **رابط الـ MCP المباشر لشات جي بي تي:**
```http
https://apcxwxnkntegbkimsmty.supabase.co/functions/v1/mcp
```

---

## 📌 1. كود التكوين لخادم MCP (MCP JSON Configuration)

ضع التكوين التالي في ملف إعدادات MCP في تطبيق ChatGPT Desktop أو Claude أو AGY:

```json
{
  "mcpServers": {
    "batch-management-system": {
      "url": "https://apcxwxnkntegbkimsmty.supabase.co/functions/v1/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_GENERATED_API_KEY"
      }
    }
  }
}
```

---

## 🛠️ 2. طريقة الربط مع ChatGPT Custom Actions

1. ادخل على حساب شات جي بي تي واذهب إلى **Explore GPTs ⬅️ Create a GPT**.
2. اختر قسم **Configure** ثم **Add Action**.
3. في قسم Authentication اختر **Bearer Token** وانقش مفتاح الـ API المولد من لوحة تحكم الأدمن.
4. استخدم رابط السيرفر المباشر:
   `https://apcxwxnkntegbkimsmty.supabase.co/functions/v1/mcp`

---

## ⚡ 3. الأوامر المتاحة لشات جي بي تي (Available MCP Tools)

* **`get_pending_inquiries`**: استرجاع استفسارات الطلاب المعلقة ورقم الهاتف ونوع المشكلة.
* **`suggest_inquiry_reply`**: تسجيل الرد المقترح وتحديث حالة طلب الطالب في المنصة.
* **`create_announcement`**: نشر إعلان عاجل أو أكاديمي فوراً للطلاب في تطبيق PWA.
* **`create_academic_task`**: إضافة واجب أو مشروع دراسي وتحديد موعد التسليم النهائي (Deadline).
* **`get_batch_context`**: تزويد شات جي بي تي بكل سياق المواد والجداول الرسمية للرد بدقة.
