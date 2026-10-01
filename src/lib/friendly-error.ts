// ==========================================
// رسائل خطأ واضحة للمستخدم — مصدر موحد مشترك
// - أخطاء الشبكة (انقطاع إنترنت / DNS) تظهر للمتصفح كـ TypeError: Failed to fetch
// - أخطاء الـ API تصل في data.error بالعربي من السيرفر — لازم تظهر كما هي
// ==========================================

export function friendlyError(err: unknown): string {
  const e = err as any;
  const msg = e?.message || "";
  if (
    e instanceof TypeError ||
    msg === "Failed to fetch" ||
    msg === "NetworkError when attempting to fetch resource." ||
    msg.includes("ERR_NAME") ||
    msg.includes("NetworkError")
  ) {
    return "تعذر الاتصال بالسيرفر — تأكد من اتصالك بالإنترنت وحاول تاني";
  }
  return msg || "حدث خطأ غير متوقع";
}
