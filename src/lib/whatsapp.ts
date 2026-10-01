/**
 ============================================
 WhatsApp Helpers — فتح شات واتساب مع الرسالة المثبتة
 ============================================
 - normalizeWhatsappNumber: تطبيع الرقم (أرقام عربية/فارسية + صيغ مصرية محلية) للصيغة الدولية
 - isValidWhatsappNumber:   التحقق أن الرقم صالح للفتح الشات المباشر
 - whatsappChatUrl:         فتح شات رقم معين مع رسالة جاهزة (يفتح فوراً حسب الجهاز)
 - whatsappDirectChatUrl:   فتح شات رقم معين مباشرة بدون رسالة (الدوس على الشخص)
 - isDesktopDevice:         كشف الكمبيوتر لاستخدام واتساب ويب مباشرة
 ⚠️ لو الرقم غير صالح الدوال ترجع "" — الواجهة تعرض تحذير بدل فتح شاشة اختيار مستلم
 */

/** رمز دولة مصر الافتراضي */
const DEFAULT_COUNTRY_CODE = "20";

/** تحويل الأرقام العربية الهندية (٠-٩) والفارسية (۰-۹) إلى أرقام لاتينية */
function toLatinDigits(input: string): string {
  return input
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06F0));
}

/**
 * تطبيع رقم واتساب لأي صيغة يدخلها المستخدم إلى الصيغة الدولية المطلوبة في wa.me
 *
 * أمثلة (مصر):
 *   "٠١٠١٢٣٤٥٦٧٨"     → "201012345678"  (أرقام عربية من كيبورد عربي)
 *   "+20 101 234 5678" → "201012345678"
 *   "00201012345678"   → "201012345678"
 *   "01012345678"      → "201012345678"  (الصيغة المحلية الشائعة)
 *   "1012345678"       → "201012345678"  (لو نسي الصفر)
 *   "201012345678"     → "201012345678"  (جاهزة كما هي)
 */
export function normalizeWhatsappNumber(raw: string): string {
  let digits = toLatinDigits(raw || "").replace(/\D/g, "");
  if (!digits) return "";

  // 00xxxx → xxxx (إزالة بادئة الاتصال الدولي)
  if (digits.startsWith("00")) digits = digits.slice(2);

  // محلي مصري: 0xxxxxxxxx → 20xxxxxxxxx
  if (digits.startsWith("0")) {
    digits = DEFAULT_COUNTRY_CODE + digits.slice(1);
  } else if (digits.length === 10 && digits.startsWith("1")) {
    // نسي الصفر: 1xxxxxxxxx → 201xxxxxxxxx
    digits = DEFAULT_COUNTRY_CODE + digits;
  }

  return digits;
}

/**
 * التحقق أن الرقم صالح لفتح شات مباشر —
 * الصيغة الدولية E.164 بين 10 و15 خانة بعد التطبيع.
 * لو أقل من كده wa.me هيفتح شاشة اختيار مستلم بدل الشات — فنعتبره غير صالح.
 */
export function isValidWhatsappNumber(raw: string): boolean {
  const n = normalizeWhatsappNumber(raw);
  return n.length >= 10 && n.length <= 15;
}

/**
 * كشف إذا كنا على كمبيوتر (وليس موبايل/تابلت) —
 * على الكمبيوتر wa.me يعرض صفحة وسيطة بدل فتح الشات،
 * لذلك نستخدم web.whatsapp.com لفتح الشات فوراً.
 */
export function isDesktopDevice(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent || "";
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(ua);
  // iPad على iPadOS 13+ يظهر كـ Mac — نفحص اللمس
  const isIpadOS = navigator.platform === "MacIntel" && (navigator as unknown as { maxTouchPoints: number }).maxTouchPoints > 1;
  return !isMobileUA && !isIpadOS;
}

/**
 * رابط فتح شات واتساب مع رقم محدد مباشرةً + رسالة مثبتة جاهزة.
 * - على الموبايل: يفتح تطبيق واتساب على الشات فوراً (wa.me)
 * - على الكمبيوتر: يفتح واتساب ويب على الشات فوراً (preferWeb) بدون صفحة وسيطة
 * - رقم غير صالح → "" (الواجهة تعرض تحذير بدل فتح شاشة اختيار مستلم)
 */
export function whatsappChatUrl(number: string, message: string, opts?: { preferWeb?: boolean }): string {
  const normalized = normalizeWhatsappNumber(number);
  if (normalized.length < 10 || normalized.length > 15) return "";

  const text = `text=${encodeURIComponent(message)}`;

  if (opts?.preferWeb) {
    return `https://web.whatsapp.com/send?phone=${normalized}&${text}`;
  }

  return `https://wa.me/${normalized}?${text}`;
}

/**
 * رابط فتح شات واتساب مع شخص مباشرةً بدون رسالة جاهزة —
 * يُستخدم عند الدوس على اسم/شخص الطالب في لوحة الإدارة.
 * رقم غير صالح → "" (الواجهة تعرض تحذير).
 */
export function whatsappDirectChatUrl(number: string, opts?: { preferWeb?: boolean }): string {
  const normalized = normalizeWhatsappNumber(number);
  if (normalized.length < 10 || normalized.length > 15) return "";

  if (opts?.preferWeb) {
    return `https://web.whatsapp.com/send?phone=${normalized}`;
  }

  return `https://wa.me/${normalized}`;
}

/**
 * الرسالة المثبتة لرد الإدارة على استفسار طالب —
 * تتضمن مشكلة الطالب نفسها + الرد المقترح حتى يكون السياق كاملاً في الواتساب.
 */
export function buildInquiryReplyMessage(inquiry: {
  full_name: string;
  category: string;
  message: string;
  ai_suggestion?: string;
}): string {
  const problem = (inquiry.message || "").trim() || "—";
  const reply =
    (inquiry.ai_suggestion || "").trim() ||
    "شكراً لتواصلك معنا، تم استلام استفسارك وسيتم الرد عليك بالتفاصيل قريباً.";

  return [
    `مرحباً ${inquiry.full_name}،`,
    "",
    `رداً على استفسارك بخصوص (${inquiry.category}):`,
    "",
    "📝 مشكلتك:",
    problem,
    "",
    "✅ الرد:",
    reply,
  ].join("\n");
}
