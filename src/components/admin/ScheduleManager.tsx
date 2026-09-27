"use client";

import { useEffect, useState } from "react";
import {
  Calendar,
  BookOpen,
  Plus,
  Trash2,
  Clock,
  Loader2,
  RefreshCw,
  MapPin,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/Card";

const DAYS = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

export default function ScheduleManager() {
  const [subjects, setSubjects] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<"schedule" | "subjects">("schedule");

  // Add schedule form
  const [newSubject, setNewSubject] = useState("");
  const [newDay, setNewDay] = useState(0);
  const [newStart, setNewStart] = useState("09:00");
  const [newEnd, setNewEnd] = useState("11:00");
  const [newRoom, setNewRoom] = useState("");
  const [newType, setNewType] = useState("lecture");
  const [adding, setAdding] = useState(false);

  // Add subject form
  const [subjName, setSubjName] = useState("");
  const [subjCode, setSubjCode] = useState("");
  const [subjInstructor, setSubjInstructor] = useState("");
  const [subjColor, setSubjColor] = useState("#3b82f6");
  const [addingSubject, setAddingSubject] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const supabase = createClient();
    const [subjsRes, schedRes] = await Promise.all([
      supabase.from("subjects").select("*").order("name"),
      supabase.from("schedules").select("*, subjects(*)").eq("is_active", true).order("day_of_week").order("start_time"),
    ]);
    setSubjects(subjsRes.data || []);
    setSchedules(schedRes.data || []);
    setLoading(false);
  };

  const handleAddSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubject) return;
    setAdding(true);
    const supabase = createClient();
    await supabase.from("schedules").insert([{
      subject_id: newSubject,
      day_of_week: newDay,
      start_time: newStart,
      end_time: newEnd,
      room: newRoom || null,
      type: newType,
      is_active: true,
    }]);
    setNewRoom("");
    setAdding(false);
    fetchData();
  };

  const handleDeleteSchedule = async (id: string) => {
    if (!confirm("حذف هذه الجلسة؟")) return;
    const supabase = createClient();
    await supabase.from("schedules").delete().eq("id", id);
    fetchData();
  };

  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjName.trim()) return;
    setAddingSubject(true);
    const supabase = createClient();
    await supabase.from("subjects").insert([{
      name: subjName.trim(),
      code: subjCode.trim() || null,
      instructor: subjInstructor.trim() || null,
      color: subjColor,
    }]);
    setSubjName(""); setSubjCode(""); setSubjInstructor("");
    setAddingSubject(false);
    fetchData();
  };

  const handleDeleteSubject = async (id: string) => {
    if (!confirm("حذف هذه المادة؟ سيتم حذف كل الجداول المرتبطة بها.")) return;
    const supabase = createClient();
    await supabase.from("subjects").delete().eq("id", id);
    fetchData();
  };

  const grouped: Record<number, any[]> = {};
  schedules.forEach((s) => {
    if (!grouped[s.day_of_week]) grouped[s.day_of_week] = [];
    grouped[s.day_of_week].push(s);
  });

  return (
    <div className="space-y-6">
      {/* View Toggle */}
      <div className="flex gap-2 bg-[rgb(var(--surface))] p-1.5 rounded-2xl border border-[rgb(var(--border))]">
        <button
          onClick={() => setActiveView("schedule")}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition ${activeView === "schedule" ? "gradient-brand text-white shadow-lg" : "text-[rgb(var(--text-muted))]"}`}
        >
          <Calendar className="w-4 h-4" />
          الجداول الأسبوعية
        </button>
        <button
          onClick={() => setActiveView("subjects")}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition ${activeView === "subjects" ? "gradient-brand text-white shadow-lg" : "text-[rgb(var(--text-muted))]"}`}
        >
          <BookOpen className="w-4 h-4" />
          المواد الدراسية
        </button>
      </div>

      {activeView === "schedule" && (
        <>
          {/* Add Schedule Form */}
          <Card className="space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-[rgb(var(--border))]">
              <div className="p-2 rounded-xl gradient-brand text-white">
                <Plus className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-base">إضافة جلسة جديدة</h3>
            </div>
            <form onSubmit={handleAddSchedule} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium mb-1 block">المادة</label>
                <select value={newSubject} onChange={(e) => setNewSubject(e.target.value)} required className="w-full bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-xl px-3 py-2 text-sm">
                  <option value="">— اختر مادة —</option>
                  {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">اليوم</label>
                <select value={newDay} onChange={(e) => setNewDay(parseInt(e.target.value))} className="w-full bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-xl px-3 py-2 text-sm">
                  {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium mb-1 block">من</label>
                  <input type="time" value={newStart} onChange={(e) => setNewStart(e.target.value)} className="w-full bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-xl px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">إلى</label>
                  <input type="time" value={newEnd} onChange={(e) => setNewEnd(e.target.value)} className="w-full bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-xl px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">القاعة</label>
                <input type="text" value={newRoom} onChange={(e) => setNewRoom(e.target.value)} placeholder="قاعة 101" className="w-full bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-xl px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">النوع</label>
                <select value={newType} onChange={(e) => setNewType(e.target.value)} className="w-full bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-xl px-3 py-2 text-sm">
                  <option value="lecture">محاضرة</option>
                  <option value="lab">معمل</option>
                  <option value="tutorial">سكشن</option>
                  <option value="exam">امتحان</option>
                </select>
              </div>
              <button type="submit" disabled={adding} className="sm:col-span-2 gradient-brand text-white font-semibold py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-60">
                {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                إضافة الجلسة
              </button>
            </form>
          </Card>

          {/* Schedule List */}
          <Card className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[rgb(var(--border))]">
              <h3 className="font-bold text-base flex items-center gap-2">
                <Calendar className="w-5 h-5 text-brand-500" />
                الجدول الأسبوعي ({schedules.length})
              </h3>
              <button onClick={fetchData} disabled={loading} className="p-2 rounded-lg bg-[rgb(var(--surface-subtle))] hover:bg-[rgb(var(--surface-muted))] transition border border-[rgb(var(--border))]">
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-brand-500" /></div>
            ) : schedules.length === 0 ? (
              <p className="text-xs text-center text-[rgb(var(--text-muted))] py-8">لا توجد جلسات بعد</p>
            ) : (
              <div className="space-y-4">
                {Object.entries(grouped).map(([day, sessions]) => (
                  <div key={day}>
                    <h4 className="text-xs font-bold text-[rgb(var(--text-muted))] mb-2">{DAYS[parseInt(day)]}</h4>
                    <div className="space-y-2">
                      {sessions.map((s) => (
                        <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl bg-[rgb(var(--surface-subtle))] border border-[rgb(var(--border))]">
                          <div className="w-1.5 h-10 rounded-full" style={{ backgroundColor: s.subjects?.color || "#3b82f6" }} />
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm">{s.subjects?.name || "—"}</p>
                            <div className="flex items-center gap-2 text-[10px] text-[rgb(var(--text-muted))] mt-0.5">
                              <Clock className="w-3 h-3" />
                              <span className="font-mono">{s.start_time?.slice(0, 5)} - {s.end_time?.slice(0, 5)}</span>
                              {s.room && <><MapPin className="w-3 h-3" /><span>{s.room}</span></>}
                              <span className="px-1.5 py-0.5 rounded bg-[rgb(var(--surface-muted))]">
                                {s.type === "lecture" ? "محاضرة" : s.type === "lab" ? "معمل" : s.type}
                              </span>
                            </div>
                          </div>
                          <button onClick={() => handleDeleteSchedule(s.id)} className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 transition border border-rose-500/30">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}

      {activeView === "subjects" && (
        <>
          <Card className="space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-[rgb(var(--border))]">
              <div className="p-2 rounded-xl gradient-emerald text-white">
                <Plus className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-base">إضافة مادة جديدة</h3>
            </div>
            <form onSubmit={handleAddSubject} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium mb-1 block">اسم المادة</label>
                <input type="text" value={subjName} onChange={(e) => setSubjName(e.target.value)} required className="w-full bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-xl px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">الكود</label>
                <input type="text" value={subjCode} onChange={(e) => setSubjCode(e.target.value)} placeholder="CS401" className="w-full bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-xl px-3 py-2 text-sm font-mono" />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">المدرس</label>
                <input type="text" value={subjInstructor} onChange={(e) => setSubjInstructor(e.target.value)} placeholder="د. أحمد" className="w-full bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-xl px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">اللون</label>
                <input type="color" value={subjColor} onChange={(e) => setSubjColor(e.target.value)} className="w-full h-10 bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-xl px-3 py-2 cursor-pointer" />
              </div>
              <button type="submit" disabled={addingSubject} className="sm:col-span-2 gradient-emerald text-white font-semibold py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-60">
                {addingSubject ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                إضافة المادة
              </button>
            </form>
          </Card>

          <Card className="space-y-4">
            <h3 className="font-bold text-base flex items-center gap-2 pb-3 border-b border-[rgb(var(--border))]">
              <BookOpen className="w-5 h-5 text-brand-500" />
              المواد ({subjects.length})
            </h3>
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-brand-500" /></div>
            ) : subjects.length === 0 ? (
              <p className="text-xs text-center text-[rgb(var(--text-muted))] py-8">لا توجد مواد بعد</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {subjects.map((s) => (
                  <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl bg-[rgb(var(--surface-subtle))] border border-[rgb(var(--border))]">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold" style={{ backgroundColor: s.color }}>
                      {s.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{s.name}</p>
                      <p className="text-[10px] text-[rgb(var(--text-muted))]">{s.code || "—"} • {s.instructor || "—"}</p>
                    </div>
                    <button onClick={() => handleDeleteSubject(s.id)} className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 transition border border-rose-500/30">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
