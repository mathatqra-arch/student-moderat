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
  Video,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const DAYS = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
// Groups removed
const TYPES = [
  { value: "lecture", label: "محاضرة", icon: BookOpen, color: "bg-blue" },
  { value: "tutorial", label: "سكشن", icon: Users, color: "bg-teal" },
  { value: "lab", label: "معمل", icon: Users, color: "bg-purple-soft" },
  { value: "exam", label: "امتحان", icon: Calendar, color: "bg-coral" },
];
const MODES = [
  { value: "university", label: "في الكلية", icon: MapPin, color: "bg-yellow" },
  { value: "online", label: "أونلاين", icon: Video, color: "bg-green" },
];

export default function ScheduleManager() {
  const [subjects, setSubjects] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<"schedule" | "subjects">("schedule");

  // Form state
  const [newSubject, setNewSubject] = useState("");
  const [newDay, setNewDay] = useState(0);
  const [newStart, setNewStart] = useState("09:00");
  const [newEnd, setNewEnd] = useState("11:00");
  const [newRoom, setNewRoom] = useState("");
  const [newType, setNewType] = useState("lecture");
  
  const [newMode, setNewMode] = useState("university");
  const [adding, setAdding] = useState(false);

  // Subject form
  const [subjName, setSubjName] = useState("");
  const [subjCode, setSubjCode] = useState("");
  const [subjInstructor, setSubjInstructor] = useState("");
  const [subjColor, setSubjColor] = useState("#5C95FF");
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
      lecture_type: newMode,
      location: newMode === "online" ? "أونلاين" : (newRoom || "الكلية"),
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
    <div className="space-y-5">
      {/* View Toggle */}
      <div className="flex gap-2 p-1 brutal-card-flat rounded-lg">
        <button
          onClick={() => setActiveView("schedule")}
          className={`flex-1 py-2.5 rounded-md text-xs font-extrabold flex items-center justify-center gap-2 transition ${activeView === "schedule" ? "bg-ink text-cream-light shadow-brutal-sm" : "text-gray"}`}
        >
          <Calendar className="w-4 h-4" /> الجداول
        </button>
        <button
          onClick={() => setActiveView("subjects")}
          className={`flex-1 py-2.5 rounded-md text-xs font-extrabold flex items-center justify-center gap-2 transition ${activeView === "subjects" ? "bg-ink text-cream-light shadow-brutal-sm" : "text-gray"}`}
        >
          <BookOpen className="w-4 h-4" /> المواد
        </button>
      </div>

      {activeView === "schedule" && (
        <>
          {/* Add Schedule Form */}
          <div className="brutal-card p-5 space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b-2 border-ink">
              <div className="w-9 h-9 rounded-lg border-2 border-ink bg-green shadow-brutal-sm flex items-center justify-center">
                <Plus className="w-5 h-5 text-ink" />
              </div>
              <h3 className="font-extrabold text-base text-ink">إضافة جلسة جديدة</h3>
            </div>

            <form onSubmit={handleAddSchedule} className="space-y-3">
              {/* Row 1: Subject + Day */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-ink mb-1 block">المادة</label>
                  <select value={newSubject} onChange={(e) => setNewSubject(e.target.value)} required className="brutal-input w-full px-3 py-2 text-sm">
                    <option value="">— اختر مادة —</option>
                    {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-ink mb-1 block">اليوم</label>
                  <select value={newDay} onChange={(e) => setNewDay(parseInt(e.target.value))} className="brutal-input w-full px-3 py-2 text-sm">
                    {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                  </select>
                </div>
              </div>

              {/* Row 2: Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-ink mb-1 block">من</label>
                  <input type="time" value={newStart} onChange={(e) => setNewStart(e.target.value)} className="brutal-input w-full px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-bold text-ink mb-1 block">إلى</label>
                  <input type="time" value={newEnd} onChange={(e) => setNewEnd(e.target.value)} className="brutal-input w-full px-3 py-2 text-sm" />
                </div>
              </div>

              {/* Row 3: Type + Mode */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-ink mb-1 block">النوع</label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {TYPES.map((t) => {
                      const Icon = t.icon;
                      return (
                        <button
                          key={t.value}
                          type="button"
                          onClick={() => setNewType(t.value)}
                          className={`flex flex-col items-center py-2 rounded-md border-2 text-2xs font-bold transition ${newType === t.value ? `border-ink ${t.color} shadow-brutal-sm` : "border-ink bg-cream-light text-gray"}`}
                        >
                          <Icon className="w-4 h-4 mb-0.5" />
                          {t.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-ink mb-1 block">الحضور</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {MODES.map((m) => {
                      const Icon = m.icon;
                      return (
                        <button
                          key={m.value}
                          type="button"
                          onClick={() => setNewMode(m.value)}
                          className={`flex items-center justify-center gap-1.5 py-3 rounded-md border-2 text-xs font-bold transition ${newMode === m.value ? `border-ink ${m.color} shadow-brutal-sm` : "border-ink bg-cream-light text-gray"}`}
                        >
                          <Icon className="w-4 h-4" />
                          {m.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Row 4: Room */}
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="text-xs font-bold text-ink mb-1 block">القاعة / المكان</label>
                  <input
                    type="text"
                    value={newRoom}
                    onChange={(e) => setNewRoom(e.target.value)}
                    placeholder={newMode === "online" ? "رابط الاجتماع (اختياري)" : "قاعة 101"}
                    className="brutal-input w-full px-3 py-2.5 text-sm"
                    disabled={newMode === "online"}
                  />
                </div>
              </div>

              <button type="submit" disabled={adding} className="brutal-btn w-full py-3 text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                إضافة الجلسة
              </button>
            </form>
          </div>

          {/* Schedule List */}
          <div className="brutal-card p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b-2 border-ink">
              <h3 className="font-extrabold text-base text-ink flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                الجدول الأسبوعي ({schedules.length})
              </h3>
              <button onClick={fetchData} disabled={loading} className="p-2 rounded-lg border-2 border-ink bg-cream-light hover:bg-gray-bg transition">
                <RefreshCw className={`w-4 h-4 text-ink ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>

            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-ink" /></div>
            ) : schedules.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 rounded-full border-2 border-ink bg-cream-dark mx-auto flex items-center justify-center mb-2">
                  <Calendar className="w-6 h-6 text-gray" />
                </div>
                <p className="text-xs text-gray font-bold">لا توجد جلسات بعد</p>
              </div>
            ) : (
              <div className="space-y-4">
                {Object.entries(grouped).map(([day, sessions]) => (
                  <div key={day}>
                    <h4 className="text-xs font-extrabold text-ink mb-2 flex items-center gap-2">
                      <span className="w-1.5 h-4 rounded-full bg-ink" />
                      {DAYS[parseInt(day)]}
                    </h4>
                    <div className="space-y-2">
                      {sessions.map((s) => {
                        const subject = s.subjects;
                        const color = subject?.color || "#5C95FF";
                        const typeInfo = TYPES.find((t) => t.value === s.type) || TYPES[0];
                        const modeInfo = MODES.find((m) => m.value === s.lecture_type) || MODES[0];
                        const TypeIcon = typeInfo.icon;
                        const ModeIcon = modeInfo.icon;
                        const isOnline = s.lecture_type === "online" || (s.location || "").toLowerCase().includes("online") || (s.location || "").includes("أونلاين");

                        return (
                          <div key={s.id} className="brutal-card-flat p-3 flex items-center gap-3">
                            {/* Color bar */}
                            <div className="w-1.5 h-12 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />

                            {/* Time */}
                            <div className="text-center flex-shrink-0 min-w-[52px]">
                              <p className="text-xs font-mono font-bold text-ink">{s.start_time?.slice(0, 5)}</p>
                              <p className="text-2xs text-gray">{s.end_time?.slice(0, 5)}</p>
                            </div>

                            {/* Subject + badges */}
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-sm text-ink truncate">{subject?.name || "—"}</p>
                              <div className="flex items-center gap-1.5 flex-wrap mt-1">
                                {/* Type badge */}
                                <span className={`brutal-badge ${typeInfo.color} text-ink`}>
                                  <TypeIcon className="w-2.5 h-2.5" />
                                  {typeInfo.label}
                                </span>
                                {/* Mode badge */}
                                <span className={`brutal-badge ${modeInfo.color} text-ink`}>
                                  <ModeIcon className="w-2.5 h-2.5" />
                                  {modeInfo.label}
                                </span>

                                {/* Room */}
                                {s.room && !isOnline && (
                                  <span className="flex items-center gap-0.5 text-2xs font-bold text-gray">
                                    <MapPin className="w-2.5 h-2.5" />
                                    {s.room}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Delete */}
                            <button
                              onClick={() => handleDeleteSchedule(s.id)}
                              className="p-2 rounded-lg border-2 border-ink bg-coral hover:bg-coral-light transition flex-shrink-0"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-ink" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {activeView === "subjects" && (
        <>
          {/* Add Subject */}
          <div className="brutal-card p-5 space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b-2 border-ink">
              <div className="w-9 h-9 rounded-lg border-2 border-ink bg-teal shadow-brutal-sm flex items-center justify-center">
                <Plus className="w-5 h-5 text-ink" />
              </div>
              <h3 className="font-extrabold text-base text-ink">إضافة مادة جديدة</h3>
            </div>
            <form onSubmit={handleAddSubject} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-ink mb-1 block">اسم المادة</label>
                <input type="text" value={subjName} onChange={(e) => setSubjName(e.target.value)} required className="brutal-input w-full px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-bold text-ink mb-1 block">الكود</label>
                <input type="text" value={subjCode} onChange={(e) => setSubjCode(e.target.value)} placeholder="CS401" className="brutal-input w-full px-3 py-2 text-sm font-mono" />
              </div>
              <div>
                <label className="text-xs font-bold text-ink mb-1 block">المدرس</label>
                <input type="text" value={subjInstructor} onChange={(e) => setSubjInstructor(e.target.value)} placeholder="د. أحمد" className="brutal-input w-full px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-bold text-ink mb-1 block">اللون</label>
                <input type="color" value={subjColor} onChange={(e) => setSubjColor(e.target.value)} className="w-full h-10 brutal-input px-2 py-1 cursor-pointer" />
              </div>
              <button type="submit" disabled={addingSubject} className="sm:col-span-2 brutal-btn-accent py-2.5 text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                {addingSubject ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                إضافة المادة
              </button>
            </form>
          </div>

          {/* Subjects List */}
          <div className="brutal-card p-5 space-y-4">
            <h3 className="font-extrabold text-base text-ink flex items-center gap-2 pb-3 border-b-2 border-ink">
              <BookOpen className="w-5 h-5" />
              المواد ({subjects.length})
            </h3>
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-ink" /></div>
            ) : subjects.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 rounded-full border-2 border-ink bg-cream-dark mx-auto flex items-center justify-center mb-2">
                  <BookOpen className="w-6 h-6 text-gray" />
                </div>
                <p className="text-xs text-gray font-bold">لا توجد مواد بعد</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {subjects.map((s) => (
                  <div key={s.id} className="flex items-center gap-3 p-3 brutal-card-flat">
                    <div className="w-10 h-10 rounded-lg border-2 border-ink flex items-center justify-center text-ink font-extrabold flex-shrink-0" style={{ backgroundColor: s.color }}>
                      {s.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-ink truncate">{s.name}</p>
                      <p className="text-2xs text-gray">{s.code || "—"} • {s.instructor || "—"}</p>
                    </div>
                    <button onClick={() => handleDeleteSubject(s.id)} className="p-2 rounded-lg border-2 border-ink bg-coral hover:bg-coral-light transition flex-shrink-0">
                      <Trash2 className="w-3.5 h-3.5 text-ink" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
