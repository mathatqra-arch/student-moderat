// ==========================================
// أدوات التنسيق الموحدة — الوقت 12 ساعة (ص/م) + أنواع الحصص
// القاعدة: كل الأوقات المعروضة للمستخدم تكون بنظام 12 ساعة
// مع "ص" (صباحاً/نهار) و "م" (مساءً) — ممنوع عرض 24 ساعة.
// ==========================================

/**
 * تحويل وقت مخزّن (HH:MM أو HH:MM:SS بنظام 24) إلى عرض 12 ساعة عربي.
 * أمثلة:
 *   "09:00"   → "9:00 ص"
 *   "14:30"   → "2:30 م"
 *   "12:00"   → "12:00 م"  (الظهر)
 *   "00:15"   → "12:15 ص"  (بعد منتصف الليل)
 * تقبل أيضاً قيمة 12 ساعة واردة بالخطأ ("2:30 م") وتعيد تنسيقها صح.
 */
export function formatTime12(t?: string | null): string {
  if (!t) return "—";
  const s = String(t).trim();
  // HH:MM(:SS) اختياري مع ساكن مساء/صباح إن وُجد
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return s;
  let h = parseInt(m[1], 10);
  const min = m[2];
  if (Number.isNaN(h) || h < 0 || h > 23) return s;
  // دفاع: لو المصدر قيمة 12 ساعة مع م/PM (لا يحدث من TIME لكن احتياطاً)
  if (/(م|مساء|pm)\s*$/i.test(s) && h >= 1 && h <= 11) h += 12;
  const suffix = h < 12 ? "ص" : "م";
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${min} ${suffix}`;
}

/** وقت من كائن Date بنظام 12 ساعة وأرقام لاتينية (متوافق مع formatTime12). */
export function formatTimeOfDay12(d: Date): string {
  return new Intl.DateTimeFormat("ar-EG-u-nu-latn", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

/** هل التاريخ يحمل وقتاً غير منتصف الليل؟ (لإخفاء الوقت عن المواعيد اليومية فقط) */
export function hasTimeComponent(d: Date): boolean {
  return d.getHours() !== 0 || d.getMinutes() !== 0;
}

// ==========================================
// أنواع الحصص — تسميات موحدة (تدعم section/other الجديدة والقديمة)
// ==========================================
export const SESSION_TYPES: Record<string, { label: string; bg: string }> = {
  lecture: { label: "محاضرة", bg: "bg-blue" },
  tutorial: { label: "سكشن", bg: "bg-teal" },
  section: { label: "سكشن", bg: "bg-teal" },
  lab: { label: "معمل", bg: "bg-purple-soft" },
  exam: { label: "امتحان", bg: "bg-coral" },
  other: { label: "حصة", bg: "bg-yellow" },
};

/** تسمية عربية لنوع الحصة — أي قيمة غير معروفة تعرض "حصة". */
export function sessionTypeLabel(type?: string | null): string {
  if (!type) return "حصة";
  return SESSION_TYPES[String(type).trim().toLowerCase()]?.label ?? "حصة";
}

/** خلفية البادج حسب نوع الحصة. */
export function sessionTypeBg(type?: string | null): string {
  if (!type) return "bg-yellow";
  return SESSION_TYPES[String(type).trim().toLowerCase()]?.bg ?? "bg-yellow";
}

/** هل الجلسة أونلاين؟ (يعتمد lecture_type أولاً ثم نصوص الموقع القديمة) */
export function isSessionOnline(session: any): boolean {
  if (session?.lecture_type === "online") return true;
  if (session?.lecture_type === "university" || session?.lecture_type === "offline") return false;
  const loc = String(session?.location || session?.room || "").toLowerCase();
  return loc.includes("online") || loc.includes("أونلاين") || loc.includes("اونلاين");
}

/** استخراج رابط الحصة الأونلاين (عمود link أولاً ثم الحقول القديمة). */
export function sessionOnlineUrl(session: any): string {
  if (!isSessionOnline(session)) return "";
  const link = String(session?.link || "").trim();
  if (link.startsWith("http")) return link;
  const legacy = String(session?.location || session?.room || session?.notes || "").trim();
  return legacy.startsWith("http") ? legacy : "";
}
