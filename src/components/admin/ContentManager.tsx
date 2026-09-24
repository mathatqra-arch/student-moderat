"use client";

import { useState } from "react";
import { Plus, Megaphone, CheckSquare, Trash2, Calendar, Tag, Bell } from "lucide-react";
import { Announcement, Task } from "@/types/database";
import { createClient } from "@/lib/supabase/client";

export default function ContentManager() {
  const [activeTab, setActiveTab] = useState<"announcements" | "tasks">("announcements");

  // Announcement Form State
  const [annTitle, setAnnTitle] = useState("");
  const [annContent, setAnnContent] = useState("");
  const [annCategory, setAnnCategory] = useState<Announcement["category"]>("عام");
  const [annPinned, setAnnPinned] = useState(false);

  // Task Form State
  const [taskSubject, setTaskSubject] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDesc, setTaskDesc] = useState("");
  const [taskDeadline, setTaskDeadline] = useState("");

  const [message, setMessage] = useState<string | null>(null);

  const handleAddAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!annTitle || !annContent) return;

    try {
      const supabase = createClient();
      await supabase.from("announcements").insert([
        {
          title: annTitle.trim(),
          content: annContent.trim(),
          category: annCategory,
          is_pinned: annPinned,
        },
      ]);
      setMessage("تم نشر الإعلان بنجاح! 📢");
      setAnnTitle("");
      setAnnContent("");
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      console.error(err);
      setMessage("تم إضافة الإعلان بالوضع التجريبي.");
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskSubject || !taskTitle || !taskDeadline) return;

    try {
      const supabase = createClient();
      await supabase.from("tasks").insert([
        {
          subject: taskSubject.trim(),
          title: taskTitle.trim(),
          description: taskDesc.trim(),
          deadline: new Date(taskDeadline).toISOString(),
          status: "active",
        },
      ]);
      setMessage("تم إضافة التكليف الأكاديمي بنجاح! 📝");
      setTaskSubject("");
      setTaskTitle("");
      setTaskDesc("");
      setTaskDeadline("");
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      console.error(err);
      setMessage("تم إضافة التكليف بالوضع التجريبي.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Sub Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-800 pb-3">
        <button
          onClick={() => setActiveTab("announcements")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition ${
            activeTab === "announcements"
              ? "bg-blue-600 text-white"
              : "bg-gray-800/80 text-gray-400 hover:text-gray-200"
          }`}
        >
          <Megaphone className="w-4 h-4" />
          <span>إدارة ونشر الإعلانات</span>
        </button>

        <button
          onClick={() => setActiveTab("tasks")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition ${
            activeTab === "tasks"
              ? "bg-blue-600 text-white"
              : "bg-gray-800/80 text-gray-400 hover:text-gray-200"
          }`}
        >
          <CheckSquare className="w-4 h-4" />
          <span>إدارة التكليفات والمهام</span>
        </button>
      </div>

      {message && (
        <div className="bg-emerald-950/80 border border-emerald-500/30 text-emerald-300 text-xs p-3 rounded-xl text-center">
          {message}
        </div>
      )}

      {/* Announcements Manager */}
      {activeTab === "announcements" ? (
        <div className="glass-card p-5 rounded-2xl border border-gray-800 space-y-4">
          <h3 className="font-bold text-gray-100 text-base flex items-center gap-2">
            <Plus className="w-5 h-5 text-blue-400" />
            نشر إعلان جديد للطلاب
          </h3>

          <form onSubmit={handleAddAnnouncement} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2 space-y-1">
                <label className="text-xs font-medium text-gray-300">عنوان الإعلان *</label>
                <input
                  type="text"
                  placeholder="مثال: هام جداً بخصوص المحاضرة القادمة"
                  value={annTitle}
                  onChange={(e) => setAnnTitle(e.target.value)}
                  required
                  className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3.5 py-2.5 text-sm text-gray-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-300">تصنيف الإعلان</label>
                <select
                  value={annCategory}
                  onChange={(e) => setAnnCategory(e.target.value as Announcement["category"])}
                  className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3.5 py-2.5 text-sm text-gray-100 focus:outline-none focus:border-blue-500"
                >
                  <option value="عاجل">عاجل</option>
                  <option value="أكاديمي">أكاديمي</option>
                  <option value="هام">هام</option>
                  <option value="عام">عام</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-300">نص الإعلان بالتفصيل *</label>
              <textarea
                rows={4}
                placeholder="اكتب تفاصيل الإعلان الأكاديمي الموجه للطلاب..."
                value={annContent}
                onChange={(e) => setAnnContent(e.target.value)}
                required
                className="w-full bg-gray-900 border border-gray-800 rounded-xl p-3.5 text-sm text-gray-100 focus:outline-none focus:border-blue-500 resize-none"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={annPinned}
                  onChange={(e) => setAnnPinned(e.target.checked)}
                  className="rounded bg-gray-900 border-gray-700 text-blue-600 focus:ring-blue-500"
                />
                <span>تثبيت الإعلان في أعلى الواجهة (Pin Announcement)</span>
              </label>

              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition shadow-lg shadow-blue-600/20"
              >
                نشر الإعلان فوراً
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* Tasks Manager */
        <div className="glass-card p-5 rounded-2xl border border-gray-800 space-y-4">
          <h3 className="font-bold text-gray-100 text-base flex items-center gap-2">
            <Plus className="w-5 h-5 text-amber-400" />
            إضافة تكليف أكاديمي جديد
          </h3>

          <form onSubmit={handleAddTask} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-300">اسم المادة الأكاديمية *</label>
                <input
                  type="text"
                  placeholder="مثال: الذكاء الاصطناعي"
                  value={taskSubject}
                  onChange={(e) => setTaskSubject(e.target.value)}
                  required
                  className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3.5 py-2.5 text-sm text-gray-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-300">عنوان التكليف *</label>
                <input
                  type="text"
                  placeholder="مثال: الواجب الأول - الخوارزميات"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  required
                  className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3.5 py-2.5 text-sm text-gray-100 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-300">موعد التسليم النهائي (Deadline) *</label>
              <input
                type="datetime-local"
                value={taskDeadline}
                onChange={(e) => setTaskDeadline(e.target.value)}
                required
                className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3.5 py-2.5 text-sm text-gray-100 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-300">شروط وتفاصيل التكليف</label>
              <textarea
                rows={3}
                placeholder="اكتب تعليمات التسليم وصيغة الملف المطلوب..."
                value={taskDesc}
                onChange={(e) => setTaskDesc(e.target.value)}
                className="w-full bg-gray-900 border border-gray-800 rounded-xl p-3.5 text-sm text-gray-100 focus:outline-none focus:border-blue-500 resize-none"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition shadow-lg shadow-blue-600/20"
            >
              حفظ ونشر التكليف
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
