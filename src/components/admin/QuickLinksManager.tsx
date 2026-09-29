"use client";

import { useEffect, useState } from "react";
import {
  Link2,
  Plus,
  Trash2,
  Edit2,
  Loader2,
  RefreshCw,
  ExternalLink,
  X,
  Check,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface QuickLink {
  id: string;
  title: string;
  url: string;
  type: string;
  icon?: string;
  order_index: number;
  category?: string;
}

const LINK_TYPES = [
  { value: "schedule", label: "جدول" },
  { value: "group", label: "جروب" },
  { value: "material", label: "مواد" },
  { value: "drive", label: "درايف" },
  { value: "website", label: "موقع" },
  { value: "other", label: "أخرى" },
];

export default function QuickLinksManager() {
  const [links, setLinks] = useState<QuickLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingLink, setEditingLink] = useState<QuickLink | null>(null);

  // Form
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [type, setType] = useState("website");
  const [category, setCategory] = useState("general");
  const [orderIndex, setOrderIndex] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchLinks();
  }, []);

  const fetchLinks = async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase.from("quick_links").select("*").order("order_index", { ascending: true });
    setLinks(data || []);
    setLoading(false);
  };

  const openAddModal = () => {
    setEditingLink(null);
    setTitle("");
    setUrl("");
    setType("website");
    setCategory("general");
    setOrderIndex(links.length);
    setShowModal(true);
  };

  const openEditModal = (link: QuickLink) => {
    setEditingLink(link);
    setTitle(link.title);
    setUrl(link.url);
    setType(link.type);
    setCategory(link.category || "general");
    setOrderIndex(link.order_index);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !url.trim()) return;
    setSaving(true);
    const supabase = createClient();

    if (editingLink) {
      // تعديل
      await supabase.from("quick_links").update({
        title: title.trim(),
        url: url.trim(),
        type,
        category,
        order_index: orderIndex,
      }).eq("id", editingLink.id);
    } else {
      // إضافة
      await supabase.from("quick_links").insert([{
        title: title.trim(),
        url: url.trim(),
        type,
        category,
        order_index: orderIndex,
      }]);
    }

    setSaving(false);
    setShowModal(false);
    fetchLinks();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("حذف هذا الرابط نهائياً؟")) return;
    const supabase = createClient();
    await supabase.from("quick_links").delete().eq("id", id);
    fetchLinks();
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-extrabold text-base text-ink flex items-center gap-2">
          <Link2 className="w-5 h-5" />
          الروابط السريعة ({links.length})
        </h3>
        <div className="flex gap-2">
          <button onClick={fetchLinks} disabled={loading} className="p-2 rounded-lg border-2 border-ink bg-cream-light hover:bg-gray-bg transition">
            <RefreshCw className={`w-4 h-4 text-ink ${loading ? "animate-spin" : ""}`} />
          </button>
          <button onClick={openAddModal} className="brutal-btn-accent px-4 py-2 text-xs flex items-center gap-1.5">
            <Plus className="w-4 h-4" />
            إضافة رابط
          </button>
        </div>
      </div>

      {/* Links List */}
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-ink" /></div>
      ) : links.length === 0 ? (
        <div className="brutal-card p-8 rounded-xl text-center space-y-3">
          <div className="w-12 h-12 rounded-full border-2 border-ink bg-cream-dark mx-auto flex items-center justify-center">
            <Link2 className="w-6 h-6 text-gray" />
          </div>
          <p className="text-xs text-ink-soft font-bold">لا توجد روابط بعد</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {links.map((link) => (
            <div key={link.id} className="brutal-card p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="w-9 h-9 rounded-lg border-2 border-ink bg-yellow flex items-center justify-center flex-shrink-0">
                    <ExternalLink className="w-4 h-4 text-ink" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-ink truncate">{link.title}</p>
                    <p className="text-2xs text-gray truncate font-mono">{link.url}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between pt-2 border-t-2 border-ink">
                <span className="brutal-badge bg-cream-dark">{LINK_TYPES.find(t => t.value === link.type)?.label || link.type}</span>
                <div className="flex gap-1.5">
                  <button onClick={() => openEditModal(link)} className="p-2 rounded-lg border-2 border-ink bg-blue hover:opacity-80 transition">
                    <Edit2 className="w-3.5 h-3.5" style={{ color: "#000" }} />
                  </button>
                  <button onClick={() => handleDelete(link.id)} className="p-2 rounded-lg border-2 border-ink bg-coral hover:opacity-80 transition">
                    <Trash2 className="w-3.5 h-3.5" style={{ color: "#000" }} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="brutal-card p-6 max-w-md w-full space-y-4">
            <div className="flex items-center justify-between pb-3 border-b-2 border-ink">
              <h3 className="font-extrabold text-base text-ink flex items-center gap-2">
                <Link2 className="w-5 h-5" />
                {editingLink ? "تعديل رابط" : "إضافة رابط جديد"}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-cream-dark text-gray hover:text-ink">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-ink mb-1 block">العنوان *</label>
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="مثال: جدول الامتحانات" className="brutal-input w-full px-3 py-2.5 text-sm" />
              </div>
              <div>
                <label className="text-xs font-bold text-ink mb-1 block">الرابط *</label>
                <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} required placeholder="https://..." dir="ltr" className="brutal-input w-full px-3 py-2.5 text-sm text-left font-mono" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-ink mb-1 block">النوع</label>
                  <select value={type} onChange={(e) => setType(e.target.value)} className="brutal-input w-full px-3 py-2.5 text-sm">
                    {LINK_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-ink mb-1 block">الترتيب</label>
                  <input type="number" value={orderIndex} onChange={(e) => setOrderIndex(parseInt(e.target.value) || 0)} className="brutal-input w-full px-3 py-2.5 text-sm" />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="brutal-btn-ghost flex-1 py-2.5 text-sm">إلغاء</button>
                <button type="submit" disabled={saving} className="brutal-btn flex-1 py-2.5 text-sm flex items-center justify-center gap-2">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {editingLink ? "حفظ التعديل" : "إضافة"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
