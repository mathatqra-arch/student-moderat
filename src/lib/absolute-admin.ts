// ==========================================
// الأدمن المطلق (super_admin) — المتحكم الوحيد في النظام
// ⚠️ ملف سيرفر فقط — ممنوع استيراده من أي Client Component
//    (الثوابت هنا تبقى خارج bundle المتصفح عمداً)
//
// التسلسل الهرمي للأدوار:
//   super_admin — الأدمن المطلق: يرى كل الشجرات، لا يراه ولا يُمَس
//                 من أي حساب آخر مهما كان دوره، ووحده من ينشئ الليدرات
//   leader      — ليدر: كل الصلاحيات داخل شجرته فقط (شجرة جديدة تحته)
//   assistant   — مشرف مساعد: حسب JSON الصلاحيات داخل شجرته
// ==========================================

// أرقام حساب الأدمن المطلق — بصيغ مصرية مطبّعة (أرقام فقط بدون +
// أو مسافات): دولي 201040945655 / محلي 01040945655 / وطني 1040945655
const ABSOLUTE_ADMIN_PHONE_DIGITS = [
  "201040945655",
  "01040945655",
  "1040945655",
];

/**
 * هل الرقم (أي صيغة: +20/002/01...) يطابق حساب الأدمن المطلق؟
 * تُستخدم من السيرفر فقط لترقية الدور ذاتياً ومنع أي تجاوز عليه
 */
export function isAbsoluteAdminPhone(phone?: string | null): boolean {
  if (!phone) return false;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return false;
  const withoutIntlPrefix = digits.startsWith("002")
    ? digits.slice(3)
    : digits;
  return (
    ABSOLUTE_ADMIN_PHONE_DIGITS.includes(digits) ||
    ABSOLUTE_ADMIN_PHONE_DIGITS.includes(withoutIntlPrefix)
  );
}
