// ==========================================
// فحص إعدادات السيرفر — يمنع 500 غامضة
// لو متغيرات البيئة ناقصة، الـ APIs ترجع 503 برسالة واضحة
// بدل انفجار استثناءات في عمق الكود (500 "حدث خطأ داخلي")
// ==========================================

/**
 * يرجع أسماء المتغيرات الناقصة، أو null لو كل شيء مُهيّأ.
 * يُستخدم في بداية الـ API routes الحساسة (login / password).
 */
export function missingServerConfig(): string | null {
  const missing: string[] = [];

  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    missing.push("SUPABASE_SERVICE_ROLE_KEY");
  }

  return missing.length > 0 ? missing.join(", ") : null;
}

/**
 * استجابة 503 جاهزة مع رسالة واضحة للمستخدم وتفاصيل كاملة في سجل السيرفر فقط
 */
export function configErrorResponse(route: string): Response {
  const missing = missingServerConfig();
  console.error(
    `[${route}] إعدادات السيرفر ناقصة: ${missing}. ` +
      `أنشئ ملف .env من .env.example وضع القيم الصحيحة (أو اضبط wrangler secret في الإنتاج).`
  );
  return new Response(
    JSON.stringify({
      ok: false,
      error:
        "السيرفر غير مُهيّأ بعد — إعدادات قاعدة البيانات ناقصة على السيرفر. راجع ملف .env (راجع .env.example)",
      missing_config: true,
    }),
    {
      status: 503,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    }
  );
}
