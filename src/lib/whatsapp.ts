/**
 ============================================
 WhatsApp Helpers — روابط واتساب مع رسالة مثبتة
 ============================================
 - normalizeWhatsappNumber: تطبيع الرقم للصيغة الدولية (افتراضي مصر 20)
 - whatsappChatUrl:         فتح شات رقم معين مع رسالة جاهزة
 - whatsappShareUrl:        فتح واتساب مع رسالة جاهزة واختيار المستلم لاحقاً
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
 * رابط فتح شات واتساب مع رقم محدد + رسالة مثبتة جاهزة للإرسال.
 * لو الرقم غير صالح يرجع رابط مشاركة عادي حتى لا يتعطل الزر.
 */
export function whatsappChatUrl(number: string, message: string): string {
  const normalized = normalizeWhatsappNumber(number);
  const base = normalized ? `https://wa.me/${normalized}` : "https://wa.me/";
  return `${base}?text=${encodeURIComponent(message)}`;
}

/**
 * رابط فتح واتساب مع رسالة مثبتة بدون تحديد مستلم —
 * واتساب يفتح شاشة اختيار جهة الاتصال والرسالة مكتوبة جاهزة.
 */
export function whatsappShareUrl(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
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

/**
 * الرسالة المثبتة التي يرسلها الطالب —
 * تفتح واتساب والرسالة مكتوبة باسمه وتصنيف مشكلته ونص مشكلته.
 */
export function buildStudentInquiryMessage(opts: {
  name: string;
  category: string;
  message: string;
}): string {
  const name = (opts.name || "").trim();
  const problem = (opts.message || "").trim();

  return [
    "السلام عليكم،",
    `أنا ${name || "طالب بالدفعة"}`,
    `تصنيف المشكلة: ${opts.category}`,
    "",
    "المشكلة / الاستفسار:",
    problem || "(اكتب مشكلتك هنا)",
  ].join("\n");
}
