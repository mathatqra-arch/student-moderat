// ==========================================
// التصنيفات الديناميكية — مصدر واحد للفرونت إند
// الجدول: categories (type: announcement | inquiry)
// - لو الجدول فاضي أو فشل القراءة → نرجع للتصنيفات الافتراضية
//   (نفس القيم اللي كانت مكتوبة يدوي قبل الميجيشن — مفيش كسر)
// ==========================================

import type { SupabaseClient } from "@supabase/supabase-js";

export type CategoryType = "announcement" | "inquiry";

export const DEFAULT_ANNOUNCEMENT_CATEGORIES = ["عاجل", "أكاديمي", "هام", "عام"];
export const DEFAULT_INQUIRY_CATEGORIES = ["أكاديمي", "جدول", "تكليف", "عام"];

export function defaultCategories(type: CategoryType): string[] {
  return type === "announcement" ? [...DEFAULT_ANNOUNCEMENT_CATEGORIES] : [...DEFAULT_INQUIRY_CATEGORIES];
}

export interface CategoryRow {
  id: string;
  type: CategoryType;
  name: string;
  color: string | null;
  sort_order: number;
  is_active: boolean;
}

/** قراءة التصنيفات النشطة مرتبة — لو فشلت ترجع الافتراضية (fallback آمن) */
export async function fetchCategoryNames(
  supabase: SupabaseClient,
  type: CategoryType
): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from("categories")
      .select("name")
      .eq("type", type)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (error || !data || data.length === 0) return defaultCategories(type);
    return data.map((row: { name: string }) => row.name);
  } catch {
    return defaultCategories(type);
  }
}
