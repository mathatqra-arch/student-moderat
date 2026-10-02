"use client";

import { useCallback, useEffect, useState } from "react";
import { Tag, Plus, Trash2, Check, X, Pencil, Loader2, ChevronDown, ChevronUp, ShieldAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { hasPermission, PermissionMap } from "@/lib/permissions";
import { defaultCategories, type CategoryType } from "@/lib/categories";

// ==========================================
// مدير التصنيفات — مركّب واحد للإعلانات والاستفسارات
// - الإضافة/التعديل/الحذف على جدول categories مباشرة من المتصفح
//   وـ RLS في القاعدة بيفحص صلاحيات المورد الأب (announcements/inquiries)
// - أزرار كل عملية بتظهر حسب صلاحية العضو (الليدر يشوف كل شيء)
// ==========================================

interface MeInfo {
  role: string;
  permissions: PermissionMap;
}

interface CategoryRow {
  id: string;
  type: CategoryType;
  name: string;
  sort_order: number;
  is_active: boolean;
}

// كاش وحدة الصلاحيات على مستوى الموديول — ريكوست واحد مهما اتحمّل المركّب أكتر من مرة
let mePromise: Promise<MeInfo | null> | null = null;
function fetchMe(): Promise<MeInfo | null> {
  if (!mePromise) {
    mePromise = fetch("/api/admin/me")
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null);
  }
  return mePromise;
}

const RESOURCE_BY_TYPE: Record<CategoryType, "announcements" | "inquiries"> = {
  announcement: "announcements",
  inquiry: "inquiries",
};

const TYPE_LABEL: Record<CategoryType, string> = {
  announcement: "الإعلانات",
  inquiry: "الاستفسارات",
};

export default function CategoriesManager({ type }: { type: CategoryType }) {
  const resource = RESOURCE_BY_TYPE[type];
  const [rows, setRows] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<MeInfo | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canCreate = me ? hasPermission(me.permissions, resource, "create", me.role) : false;
  const canEdit = me ? hasPermission(me.permissions, resource, "edit", me.role) : false;
  const canDelete = me ? hasPermission(me.permissions, resource, "delete", me.role) : false;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data, error: err } = await supabase
        .from("categories")
        .select("id, type, name, sort_order, is_active")
        .eq("type", type)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
      if (err) throw err;
      setRows((data as CategoryRow[]) || []);
    } catch (err: unknown) {
      // الجدول مش موجود لسه (الميجيشن مش اتنفذ) → نعرض الافتراضيات للعرض فقط
      const fallback = defaultCategories(type).map((name, i) => ({
        id: `default-${i}`,
        type,
        name,
        sort_order: i + 1,
        is_active: true,
      }));
      setRows(fallback);
      setError((err as Error)?.message || "فشل تحميل التصنيفات");
    } finally {
      setLoading(false);
    }
  }, [type]);

  useEffect(() => {
    load();
    fetchMe().then(setMe);
  }, [load]);

  const flash = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(null), 3000);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name || busy) return;
    setBusy(true);
    try {
      const supabase = createClient();
      const { error: err } = await supabase
        .from("categories")
        .insert([{ type, name, sort_order: rows.length + 1 }]);
      if (err) throw err;
      setNewName("");
      flash("تمت إضافة التصنيف ✅");
      await load();
    } catch (err: unknown) {
      setError((err as Error)?.message || "فشل إضافة التصنيف");
    } finally {
      setBusy(false);
    }
  };

  const handleRename = async (id: string) => {
    const name = editName.trim();
    if (!name || busy) return;
    setBusy(true);
    try {
      const supabase = createClient();
      const { error: err } = await supabase
        .from("categories")
        .update({ name, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (err) throw err;
      setEditingId(null);
      flash("تم تعديل التصنيف ✅");
      await load();
    } catch (err: unknown) {
      setError((err as Error)?.message || "فشل تعديل التصنيف");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`حذف تصنيف "${name}"؟ المحتوى القديم بهالتصنيف هيفضل موجود لكن التصنيف هيتشال من القوائم.`)) return;
    setBusy(true);
    try {
      const supabase = createClient();
      const { error: err } = await supabase.from("categories").delete().eq("id", id);
      if (err) throw err;
      flash("تم حذف التصنيف 🗑️");
      await load();
    } catch (err: unknown) {
      setError((err as Error)?.message || "فشل حذف التصنيف");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="brutal-card-flat rounded-lg">
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-right"
        aria-expanded={expanded}
      >
        <span className="flex items-center gap-2 font-extrabold text-sm text-ink">
          <Tag className="w-4 h-4" />
          تصنيفات {TYPE_LABEL[type]} ({rows.length})
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </span>
        <span className="text-2xs text-gray font-bold">إضافة / تعديل / حذف</span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t-2 border-dashed border-gray/30 pt-3">
          {message && (
            <p className="text-xs font-bold text-green bg-green/10 border-2 border-ink rounded-md px-3 py-1.5">{message}</p>
          )}
          {error && (
            <p className="text-xs font-bold text-ink bg-coral/20 border-2 border-ink rounded-md px-3 py-1.5 break-words">
              {error.includes("relation") || error.includes("schema")
                ? "جدول التصنيفات مش موجود بعد — لازم تشغّل ملف الميجيشن 20261003_categories_table.sql في Supabase أولاً"
                : error}
            </p>
          )}

          {/* List */}
          {loading ? (
            <div className="flex justify-center py-3"><Loader2 className="w-5 h-5 animate-spin text-ink" /></div>
          ) : (
            <ul className="space-y-1.5">
              {rows.map((row) => (
                <li key={row.id} className="flex items-center gap-2 bg-cream-light border-2 border-ink rounded-md px-2.5 py-1.5">
                  {editingId === row.id ? (
                    <>
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleRename(row.id)}
                        autoFocus
                        className="brutal-input flex-1 px-2 py-1 text-xs"
                        aria-label="اسم التصنيف الجديد"
                      />
                      {canEdit && (
                        <button onClick={() => handleRename(row.id)} disabled={busy} className="p-1.5 rounded-md border-2 border-ink bg-green transition hover:opacity-80" aria-label="حفظ">
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button onClick={() => setEditingId(null)} className="p-1.5 rounded-md border-2 border-ink bg-cream-light" aria-label="إلغاء">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="w-6 h-6 rounded-md border-2 border-ink bg-yellow flex items-center justify-center text-2xs font-extrabold flex-shrink-0">
                        {row.sort_order}
                      </span>
                      <span className="flex-1 text-xs font-bold text-ink truncate">{row.name}</span>
                      {canEdit && (
                        <button
                          onClick={() => { setEditingId(row.id); setEditName(row.name); }}
                          className="p-1.5 rounded-md border-2 border-ink bg-blue transition hover:opacity-80"
                          aria-label={`تعديل تصنيف ${row.name}`}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => handleDelete(row.id, row.name)}
                          disabled={busy}
                          className="p-1.5 rounded-md border-2 border-ink bg-coral transition hover:opacity-80"
                          aria-label={`حذف تصنيف ${row.name}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}

          {/* Add form */}
          {canCreate ? (
            <form onSubmit={handleAdd} className="flex items-center gap-2">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={`تصنيف جديد لـ${TYPE_LABEL[type]}...`}
                maxLength={50}
                className="brutal-input flex-1 px-2.5 py-1.5 text-xs"
                aria-label="اسم التصنيف الجديد"
              />
              <button type="submit" disabled={busy || !newName.trim()} className="brutal-btn px-3 py-1.5 text-xs flex items-center gap-1.5 disabled:opacity-50 flex-shrink-0">
                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                إضافة
              </button>
            </form>
          ) : (
            me && (
              <p className="text-2xs text-gray font-bold flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" />
                محتاج صلاحية «إضافة» على {TYPE_LABEL[type]} من الليدر عشان تضيف تصنيفات
              </p>
            )
          )}
        </div>
      )}
    </div>
  );
}
