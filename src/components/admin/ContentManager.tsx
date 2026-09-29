"use client";

import { useState, useEffect } from "react";
import {
  Plus,
  Megaphone,
  CheckSquare,
  Trash2,
  Edit2,
  Loader2,
  RefreshCw,
  Pin,
  Calendar,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface Announcement {
  id: string;
  title: string;
  content: string;
  category: string;
  is_pinned: boolean;
  created_at: string;
}

interface Task {
  id: string;
  subject: string;
  title: string;
  description?: string;
  deadline: string;
  status: string;
  created_at: string;
}

export default function ContentManager() {
  const [activeTab, setActiveTab] = useState<"announcements" | "tasks">("announcements");
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("عام");
  const [isPinned, setIsPinned] = useState(false);
  const [subject, setSubject] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDesc, setTaskDesc] = useState("");
  const [taskDeadline, setTaskDeadline] = useState("");
  const [saving, setSaving] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingType, setEditingType] = useState<"announcement" | "task" | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const supabase = createClient();
    const [annRes, taskRes] = await Promise.all([
      supabase.from("announcements").select("*").order("created_at", { ascending: false }),
      supabase.from("tasks").select("*").order("created_at", { ascending: false }),
    ]);
    setAnnouncements(annRes.data || []);
    setTasks(taskRes.data || []);
    setLoading(false);
  };

  const handleSaveAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    setSaving(true);
    const supabase = createClient();

    if (editingId && editingType === "announcement") {
      await supabase.from("announcements").update({
        title: title.trim(),
        content: content.trim(),
        category,
        is_pinned: isPinned,
      }).eq("id", editingId);
      setMessage("تم تعديل الإعلان بنجاح ✅");
    } else {
      await supabase.from("announcements").insert([{
        title: title.trim(),
        content: content.trim(),
        category,
        is_pinned: isPinned,
      }]);
      setMessage("تم نشر الإعلان بنجاح 📢");
    }

    setTitle(""); setContent(""); setCategory("عام"); setIsPinned(false);
    setEditingId(null); setEditingType(null);
    setSaving(false);
    setTimeout(() => setMessage(null), 3000);
    fetchData();
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !taskTitle.trim() || !taskDeadline) return;
    setSaving(true);
    const supabase = createClient();

    if (editingId && editingType === "task") {
      await supabase.from("tasks").update({
        subject: subject.trim(),
        title: taskTitle.trim(),
        description: taskDesc.trim(),
        deadline: new Date(taskDeadline).toISOString(),
      }).eq("id", editingId);
      setMessage("تم تعديل التكليف بنجاح ✅");
    } else {
      await supabase.from("tasks").insert([{
        subject: subject.trim(),
        title: taskTitle.trim(),
        description: taskDesc.trim(),
        deadline: new Date(taskDeadline).toISOString(),
        status: "active",
      }]);
      setMessage("تم إضافة التكليف بنجاح 📝");
    }

    setSubject(""); setTaskTitle(""); setTaskDesc(""); setTaskDeadline("");
    setEditingId(null); setEditingType(null);
    setSaving(false);
    setTimeout(() => setMessage(null), 3000);
    fetchData();
  };

  const handleEditAnnouncement = (ann: Announcement) => {
    setEditingId(ann.id);
    setEditingType("announcement");
    setTitle(ann.title);
    setContent(ann.content);
    setCategory(ann.category);
    setIsPinned(ann.is_pinned);
    setActiveTab("announcements");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleEditTask = (task: Task) => {
    setEditingId(task.id);
    setEditingType("task");
    setSubject(task.subject);
    setTaskTitle(task.title);
    setTaskDesc(task.description || "");
    setTaskDeadline(new Date(task.deadline).toISOString().slice(0, 16));
    setActiveTab("tasks");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDeleteAnnouncement = async (id: string) => {
    if (!confirm("حذف هذا الإعلان نهائياً؟")) return;
    const supabase = createClient();
    await supabase.from("announcements").delete().eq("id", id);
    setMessage("تم حذف الإعلان 🗑️");
    setTimeout(() => setMessage(null), 3000);
    fetchData();
  };

  const handleDeleteTask = async (id: string) => {
    if (!confirm("حذف هذا التكليف نهائياً؟")) return;
    const supabase = createClient();
    await supabase.from("tasks").delete().eq("id", id);
    setMessage("تم حذف التكليف 🗑️");
    setTimeout(() => setMessage(null), 3000);
    fetchData();
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingType(null);
    setTitle(""); setContent(""); setCategory("عام"); setIsPinned(false);
    setSubject(""); setTaskTitle(""); setTaskDesc(""); setTaskDeadline("");
  };

  return (
    <div className="space-y-5">
      {message && (
        <div className="brutal-card-flat bg-green px-4 py-3 rounded-lg text-sm font-bold text-ink flex items-center gap-2 animate-fade-in">
          {message}
        </div>
      )}

      {/* Tab Toggle */}
      <div className="flex gap-2 p-1 brutal-card-flat rounded-lg">
        <button onClick={() => setActiveTab("announcements")} className={`flex-1 py-2.5 rounded-md text-xs font-extrabold flex items-center justify-center gap-2 transition ${activeTab === "announcements" ? "bg-ink text-cream-light shadow-brutal-sm" : "text-gray"}`}>
          <Megaphone className="w-4 h-4" /> الإعلانات ({announcements.length})
        </button>
        <button onClick={() => setActiveTab("tasks")} className={`flex-1 py-2.5 rounded-md text-xs font-extrabold flex items-center justify-center gap-2 transition ${activeTab === "tasks" ? "bg-ink text-cream-light shadow-brutal-sm" : "text-gray"}`}>
          <CheckSquare className="w-4 h-4" /> التكليفات ({tasks.length})
        </button>
      </div>

      {/* Announcements */}
      {activeTab === "announcements" && (
        <div className="space-y-4">
          {/* Add/Edit Form */}
          <div className="brutal-card p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b-2 border-ink">
              <h3 className="font-extrabold text-base text-ink flex items-center gap-2">
                <Plus className="w-5 h-5" />
                {editingId && editingType === "announcement" ? "تعديل إعلان" : "نشر إعلان جديد"}
              </h3>
              {editingId && editingType === "announcement" && (
                <button onClick={cancelEdit} className="brutal-btn-ghost px-3 py-1 text-2xs">إلغاء التعديل</button>
              )}
            </div>
            <form onSubmit={handleSaveAnnouncement} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-ink mb-1 block">العنوان *</label>
                  <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="عنوان الإعلان" className="brutal-input w-full px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-bold text-ink mb-1 block">التصنيف</label>
                  <select value={category} onChange={(e) => setCategory(e.target.value)} className="brutal-input w-full px-3 py-2 text-sm">
                    <option value="عاجل">عاجل</option>
                    <option value="أكاديمي">أكاديمي</option>
                    <option value="هام">هام</option>
                    <option value="عام">عام</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-ink mb-1 block">المحتوى *</label>
                <textarea value={content} onChange={(e) => setContent(e.target.value)} required rows={4} placeholder="نص الإعلان..." className="brutal-input w-full px-3 py-2 text-sm resize-none" />
              </div>
              <label className="flex items-center gap-2 text-xs font-bold text-ink cursor-pointer">
                <input type="checkbox" checked={isPinned} onChange={(e) => setIsPinned(e.target.checked)} className="w-4 h-4 border-2 border-ink" />
                <Pin className="w-3 h-3" /> تثبيت في الأعلى
              </label>
              <button type="submit" disabled={saving} className="brutal-btn w-full py-3 text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {editingId && editingType === "announcement" ? "حفظ التعديل" : "نشر الإعلان"}
              </button>
            </form>
          </div>

          {/* Announcements List */}
          <div className="brutal-card p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b-2 border-ink">
              <h4 className="font-extrabold text-sm text-ink">الإعلانات المنشورة ({announcements.length})</h4>
              <button onClick={fetchData} disabled={loading} className="p-2 rounded-lg border-2 border-ink bg-cream-light hover:bg-gray-bg transition">
                <RefreshCw className={`w-4 h-4 text-ink ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>
            {loading ? (
              <div className="flex justify-center py-4"><Loader2 className="w-6 h-6 animate-spin text-ink" /></div>
            ) : announcements.length === 0 ? (
              <p className="text-xs text-gray font-bold text-center py-4">لا توجد إعلانات</p>
            ) : (
              <div className="space-y-2">
                {announcements.map((ann) => (
                  <div key={ann.id} className="brutal-card-flat p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="brutal-badge bg-cream-dark">{ann.category}</span>
                          {ann.is_pinned && <Pin className="w-3 h-3 text-ink" />}
                        </div>
                        <p className="font-bold text-sm text-ink">{ann.title}</p>
                        <p className="text-2xs text-ink-soft mt-1 line-clamp-2">{ann.content}</p>
                        <p className="text-2xs text-gray mt-1">{new Date(ann.created_at).toLocaleDateString("ar-EG")}</p>
                      </div>
                      <div className="flex gap-1.5 flex-shrink-0">
                        <button onClick={() => handleEditAnnouncement(ann)} className="p-2 rounded-lg border-2 border-ink bg-blue hover:opacity-80 transition">
                          <Edit2 className="w-3.5 h-3.5" style={{ color: "#000" }} />
                        </button>
                        <button onClick={() => handleDeleteAnnouncement(ann.id)} className="p-2 rounded-lg border-2 border-ink bg-coral hover:opacity-80 transition">
                          <Trash2 className="w-3.5 h-3.5" style={{ color: "#000" }} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tasks */}
      {activeTab === "tasks" && (
        <div className="space-y-4">
          {/* Add/Edit Form */}
          <div className="brutal-card p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b-2 border-ink">
              <h3 className="font-extrabold text-base text-ink flex items-center gap-2">
                <Plus className="w-5 h-5" />
                {editingId && editingType === "task" ? "تعديل تكليف" : "إضافة تكليف جديد"}
              </h3>
              {editingId && editingType === "task" && (
                <button onClick={cancelEdit} className="brutal-btn-ghost px-3 py-1 text-2xs">إلغاء التعديل</button>
              )}
            </div>
            <form onSubmit={handleSaveTask} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-ink mb-1 block">المادة *</label>
                  <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} required placeholder="مثال: الذكاء الاصطناعي" className="brutal-input w-full px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-bold text-ink mb-1 block">عنوان التكليف *</label>
                  <input type="text" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} required placeholder="مثال: الواجب الأول" className="brutal-input w-full px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-ink mb-1 block">موعد التسليم *</label>
                <input type="datetime-local" value={taskDeadline} onChange={(e) => setTaskDeadline(e.target.value)} required className="brutal-input w-full px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-bold text-ink mb-1 block">التفاصيل</label>
                <textarea value={taskDesc} onChange={(e) => setTaskDesc(e.target.value)} rows={3} placeholder="تعليمات التسليم..." className="brutal-input w-full px-3 py-2 text-sm resize-none" />
              </div>
              <button type="submit" disabled={saving} className="brutal-btn w-full py-3 text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {editingId && editingType === "task" ? "حفظ التعديل" : "إضافة التكليف"}
              </button>
            </form>
          </div>

          {/* Tasks List */}
          <div className="brutal-card p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b-2 border-ink">
              <h4 className="font-extrabold text-sm text-ink">التكليفات ({tasks.length})</h4>
              <button onClick={fetchData} disabled={loading} className="p-2 rounded-lg border-2 border-ink bg-cream-light hover:bg-gray-bg transition">
                <RefreshCw className={`w-4 h-4 text-ink ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>
            {loading ? (
              <div className="flex justify-center py-4"><Loader2 className="w-6 h-6 animate-spin text-ink" /></div>
            ) : tasks.length === 0 ? (
              <p className="text-xs text-gray font-bold text-center py-4">لا توجد تكليفات</p>
            ) : (
              <div className="space-y-2">
                {tasks.map((task) => (
                  <div key={task.id} className="brutal-card-flat p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="brutal-badge bg-cream-dark">{task.subject}</span>
                          <span className={`brutal-badge ${task.status === "active" ? "bg-green" : "bg-gray-bg"}`}>{task.status === "active" ? "نشط" : "مغلق"}</span>
                        </div>
                        <p className="font-bold text-sm text-ink">{task.title}</p>
                        {task.description && <p className="text-2xs text-ink-soft mt-1 line-clamp-2">{task.description}</p>}
                        <div className="flex items-center gap-1 text-2xs text-gray mt-1">
                          <Calendar className="w-3 h-3" />
                          <span className="font-bold">{new Date(task.deadline).toLocaleDateString("ar-EG", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                      </div>
                      <div className="flex gap-1.5 flex-shrink-0">
                        <button onClick={() => handleEditTask(task)} className="p-2 rounded-lg border-2 border-ink bg-blue hover:opacity-80 transition">
                          <Edit2 className="w-3.5 h-3.5" style={{ color: "#000" }} />
                        </button>
                        <button onClick={() => handleDeleteTask(task.id)} className="p-2 rounded-lg border-2 border-ink bg-coral hover:opacity-80 transition">
                          <Trash2 className="w-3.5 h-3.5" style={{ color: "#000" }} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
