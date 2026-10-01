/**
 ============================================
 WhatsApp Helpers — فتح شات واتساب مع الرسالة المثبتة
 ============================================
 - normalizeWhatsappNumber: تطبيع الرقم للصيغة الدولية (افتراضي مصر 20)
 - whatsappChatUrl:         فتح شات رقم معين مع رسالة جاهزة (يفتح فوراً حسب الجهاز)
 - whatsappDirectChatUrl:   فتح شات رقم معين مباشرة بدون رسالة (الدوس على الشخص)
 - isDesktopDevice:         كشف الكمبيوتر لاستخدام واتساب ويب مباشرة
 */

/** رمز دولة مصر الافتراضي */
const DEFAULT_COUNTRY_CODE = "20";

/**
 * تطبيع رقم واتساب لأي صيغة يدخلها المستخدم إلى الصيغة الدولية المطلوبة في wa.me
 *
 * أمثلة (مصر):
 *   "+20 101 234 5678" → "201012345678"
 *   "00201012345678"   → "201012345678"
 *   "01012345678"      → "201012345678"  (الصيغة المحلية الشائعة)
 *   "1012345678"       → "201012345678"  (لو نسي الصفر)
 *   "201012345678"     → "201012345678"  (جاهزة كما هي)
 */
export function normalizeWhatsappNumber(raw: string): string {
  let digits = (raw || "").replace(/\D/g, "");
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
 */
export function whatsappChatUrl(number: string, message: string, opts?: { preferWeb?: boolean }): string {
  const normalized = normalizeWhatsappNumber(number);
  const text = `text=${encodeURIComponent(message)}`;

  if (opts?.preferWeb && normalized) {
    return `https://web.whatsapp.com/send?phone=${normalized}&${text}`;
  }

  const base = normalized ? `https://wa.me/${normalized}` : "https://wa.me/";
  return `${base}?${text}`;
}

/**
 * رابط فتح شات واتساب مع شخص مباشرةً بدون رسالة جاهزة —
 * يُستخدم عند الدوس على اسم/شخص الطالب في لوحة الإدارة.
 */
export function whatsappDirectChatUrl(number: string, opts?: { preferWeb?: boolean }): string {
  const normalized = normalizeWhatsappNumber(number);

  if (opts?.preferWeb && normalized) {
    return `https://web.whatsapp.com/send?phone=${normalized}`;
  }

  return normalized ? `https://wa.me/${normalized}` : "https://wa.me/";
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
