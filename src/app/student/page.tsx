"use client";

import { useEffect, useState } from "react";
import {
  Megaphone,
  Calendar,
  CheckCircle2,
  MessageSquarePlus,
  Link2,
  BookOpen,
  Clock,
  Pin,
  AlertCircle,
  Phone,
  Send,
  ExternalLink,
  User,
  MapPin,
  Video,
  Users,
  Search,
  ChevronLeft,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { PWAPrompts } from "@/components/ui/pwa/Prompts";

type Tab = "home" | "schedule" | "tasks" | "inquiry" | "links";

const DAYS = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const GROUPS = ["الكل", "أ", "ب", "ج", "د"];

export default function StudentPage() {
  const [activeTab, setActiveTab] = useState<Tab>("home");

  return (
    <div className="min-h-screen bg-[rgb(var(--bg))] text-[rgb(var(--text))]">
      <div className="flex">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex flex-col w-64 min-h-screen glass-panel border-l border-[rgb(var(--border))] sticky top-0 h-screen">
          <div className="p-6 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl gradient-brand flex items-center justify-center shadow-lg shadow-brand-600/30">
                <BookOpen className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-base">منصة الدفعة</h1>
                <p className="text-[10px] text-[rgb(var(--text-muted))]">إدارة أكاديمية</p>
              </div>
            </div>

            <nav className="space-y-1.5">
              <SidebarButton active={activeTab === "home"} onClick={() => setActiveTab("home")} icon={Megaphone} label="الرئيسية" />
              <SidebarButton active={activeTab === "schedule"} onClick={() => setActiveTab("schedule")} icon={Calendar} label="الجدول الأسبوعي" />
              <SidebarButton active={activeTab === "tasks"} onClick={() => setActiveTab("tasks")} icon={CheckCircle2} label="التكليفات" />
              <SidebarButton active={activeTab === "inquiry"} onClick={() => setActiveTab("inquiry")} icon={MessageSquarePlus} label="استفسار" />
              <SidebarButton active={activeTab === "links"} onClick={() => setActiveTab("links")} icon={Link2} label="روابط سريعة" />
            </nav>

            <div className="mt-auto pt-6 border-t border-[rgb(var(--border))]">
              <ThemeToggle />
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-h-screen">
          {/* Mobile Header */}
          <header className="lg:hidden sticky top-0 z-30 glass-panel border-b border-[rgb(var(--border))] px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl gradient-brand flex items-center justify-center shadow-lg shadow-brand-600/20">
                  <BookOpen className="w-4 h-4 text-white" />
                </div>
                <h1 className="font-bold text-sm">منصة الدفعة</h1>
              </div>
              <ThemeToggle />
            </div>
          </header>

          {/* Content Area */}
          <main className="flex-1 p-4 lg:p-8 pb-28 lg:pb-8">
            <div className="max-w-4xl mx-auto">
              <div key={activeTab} className="tab-content">
                {activeTab === "home" && <HomeTab />}
                {activeTab === "schedule" && <ScheduleTab />}
                {activeTab === "tasks" && <TasksTab />}
                {activeTab === "inquiry" && <InquiryTab />}
                {activeTab === "links" && <LinksTab />}
              </div>
            </div>
          </main>
        </div>
      </div>

      {/* Mobile Bottom Nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 glass-panel border-t border-[rgb(var(--border))]">
        <div className="grid grid-cols-5 gap-1 p-2">
          <MobileTabButton active={activeTab === "home"} onClick={() => setActiveTab("home")} icon={Megaphone} label="الرئيسية" />
          <MobileTabButton active={activeTab === "schedule"} onClick={() => setActiveTab("schedule")} icon={Calendar} label="الجدول" />
          <MobileTabButton active={activeTab === "tasks"} onClick={() => setActiveTab("tasks")} icon={CheckCircle2} label="التكليفات" />
          <MobileTabButton active={activeTab === "inquiry"} onClick={() => setActiveTab("inquiry")} icon={MessageSquarePlus} label="استفسار" />
          <MobileTabButton active={activeTab === "links"} onClick={() => setActiveTab("links")} icon={Link2} label="روابط" />
        </div>
      </nav>

      <PWAPrompts />
    </div>
  );
}

// ==========================================
// Sidebar Button (Desktop)
// ==========================================
function SidebarButton({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: any; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
        active
          ? "gradient-brand text-white shadow-lg shadow-brand-600/20"
          : "text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text))] hover:bg-[rgb(var(--surface-subtle))]"
      }`}
    >
      <Icon className="w-4 h-4" />
      <span>{label}</span>
    </button>
  );
}

function MobileTabButton({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: any; label: string }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition ${active ? "text-brand-500" : "text-[rgb(var(--text-muted))]"}`}>
      <Icon className={`w-5 h-5 ${active ? "scale-110" : ""} transition-transform`} />
      <span className="text-[10px] mt-0.5">{label}</span>
    </button>
  );
}

// ==========================================
// Home Tab — الإعلانات كبيرة + مواعيد قادمة على الجنب
// ==========================================
function HomeTab() {
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [upcomingDates, setUpcomingDates] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient();
      const [annRes, datesRes] = await Promise.all([
        supabase.from("announcements").select("*").order("is_pinned", { ascending: false }).order("created_at", { ascending: false }),
        supabase.from("important_dates").select("*, subjects(*)").gte("date", new Date().toISOString()).order("date", { ascending: true }).limit(5),
      ]);
      setAnnouncements(annRes.data || []);
      setUpcomingDates(datesRes.data || []);
      setLoading(false);
    };
    fetchData();
  }, []);

  const filtered = announcements.filter(
    (a) => !search || a.title.includes(search) || a.content.includes(search)
  );

  if (loading) return <LoadingState />;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* الإعلانات — الجزء الأكبر */}
      <div className="lg:col-span-2 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-brand-500" />
            الإعلانات
          </h2>
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[rgb(var(--text-subtle))]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث في الإعلانات..."
              className="w-full bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-xl pr-9 pl-3 py-2 text-xs focus:outline-none focus:border-brand-500"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon={Megaphone} message="لا توجد إعلانات" />
        ) : (
          <div className="space-y-3">
            {filtered.map((ann) => (
              <AnnouncementCard key={ann.id} announcement={ann} />
            ))}
          </div>
        )}
      </div>

      {/* المواعيد القادمة — على الجنب */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Clock className="w-5 h-5 text-amber-500" />
          مواعيد قادمة
        </h2>
        {upcomingDates.length === 0 ? (
          <EmptyState icon={Clock} message="لا توجد مواعيد" />
        ) : (
          <div className="space-y-2">
            {upcomingDates.map((date) => (
              <DateCard key={date.id} date={date} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ==========================================
// Schedule Tab — جدول ذكي مع المجموعات والأنواع
// ==========================================
function ScheduleTab() {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState("الكل");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient();
      const [schedRes, subjRes] = await Promise.all([
        supabase.from("schedules").select("*, subjects(*)").eq("is_active", true).order("day_of_week").order("start_time"),
        supabase.from("subjects").select("*").order("name"),
      ]);
      setSchedules(schedRes.data || []);
      setSubjects(subjRes.data || []);
      setLoading(false);
    };
    fetchData();
  }, []);

  // فلترة حسب المجموعة
  const filtered = schedules.filter((s) => {
    if (selectedGroup === "الكل") return true;
    // لو الجلسة ملهاش مجموعة محددة (محاضرة أونلاين مثلاً) → تظهر للكل
    if (!s.group || s.group === "all") return true;
    return s.group === selectedGroup;
  });

  const grouped: Record<number, any[]> = {};
  filtered.forEach((s) => {
    if (!grouped[s.day_of_week]) grouped[s.day_of_week] = [];
    grouped[s.day_of_week].push(s);
  });

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Calendar className="w-5 h-5 text-brand-500" />
          الجدول الأسبوعي
        </h2>
        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <div className="flex gap-1 bg-[rgb(var(--surface-subtle))] p-1 rounded-lg">
            <button
              onClick={() => setViewMode("list")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${viewMode === "list" ? "gradient-brand text-white" : "text-[rgb(var(--text-muted))]"}`}
            >
              قائمة
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${viewMode === "grid" ? "gradient-brand text-white" : "text-[rgb(var(--text-muted))]"}`}
            >
              شبكة
            </button>
          </div>
        </div>
      </div>

      {/* Group Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-medium text-[rgb(var(--text-muted))]">المجموعة:</span>
        {GROUPS.map((g) => (
          <button
            key={g}
            onClick={() => setSelectedGroup(g)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              selectedGroup === g
                ? "gradient-brand text-white shadow-md"
                : "bg-[rgb(var(--surface-subtle))] text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text))]"
            }`}
          >
            {g}
          </button>
        ))}
      </div>

      {/* Schedule Content */}
      {filtered.length === 0 ? (
        <EmptyState icon={Calendar} message="لا توجد جلسات" />
      ) : viewMode === "list" ? (
        // List View
        <div className="space-y-5">
          {Object.entries(grouped).map(([day, sessions]) => (
            <div key={day}>
              <h3 className="text-sm font-bold text-[rgb(var(--text-muted))] mb-2 flex items-center gap-2">
                <span className="w-1 h-4 rounded-full gradient-brand" />
                {DAYS[parseInt(day)]}
              </h3>
              <div className="space-y-2">
                {sessions.map((s) => (
                  <SessionCard key={s.id} session={s} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        // Grid View (Desktop)
        <div className="hidden lg:grid grid-cols-7 gap-2">
          {DAYS.map((day, dayIdx) => (
            <div key={day} className="space-y-2">
              <h3 className="text-xs font-bold text-center text-[rgb(var(--text-muted))] py-1 bg-[rgb(var(--surface-subtle))] rounded-lg">
                {day}
              </h3>
              {grouped[dayIdx]?.map((s) => (
                <GridSessionCard key={s.id} session={s} />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ==========================================
// Session Card (List View) — ذكي يعرض نوع الجلسة والمجموعة
// ==========================================
function SessionCard({ session }: { session: any }) {
  const subject = session.subjects;
  const color = subject?.color || "#3b82f6";

  const getTypeInfo = (type: string) => {
    switch (type) {
      case "lecture": return { label: "محاضرة", icon: BookOpen, gradient: "gradient-brand" };
      case "lab": return { label: "معمل", icon: Users, gradient: "gradient-purple" };
      case "tutorial": return { label: "سكشن", icon: Users, gradient: "gradient-emerald" };
      case "exam": return { label: "امتحان", icon: AlertCircle, gradient: "gradient-rose" };
      default: return { label: type, icon: BookOpen, gradient: "gradient-brand" };
    }
  };

  const typeInfo = getTypeInfo(session.type);
  const TypeIcon = typeInfo.icon;

  const getLocationInfo = () => {
    // لو في location يحتوي "أونلاين" أو "online"
    const loc = (session.location || session.room || "").toLowerCase();
    if (loc.includes("online") || loc.includes("أونلاين") || loc.includes("اونلاين")) {
      return { icon: Video, label: "أونلاين", color: "text-cyan-500" };
    }
    if (session.room) {
      return { icon: MapPin, label: session.room, color: "text-amber-500" };
    }
    return null;
  };

  const locInfo = getLocationInfo();
  const LocIcon = locInfo?.icon;

  return (
    <div className="glass-card p-3 rounded-2xl flex items-center gap-3 card-hover">
      {/* Color bar */}
      <div className="w-1.5 h-14 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />

      {/* Time */}
      <div className="text-center flex-shrink-0 min-w-[60px]">
        <p className="text-xs font-mono font-bold">{session.start_time?.slice(0, 5)}</p>
        <p className="text-[10px] text-[rgb(var(--text-muted))]">{session.end_time?.slice(0, 5)}</p>
      </div>

      {/* Subject + details */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm truncate">{subject?.name || "—"}</p>
        <div className="flex items-center gap-2 text-[10px] text-[rgb(var(--text-muted))] mt-0.5">
          <span className={`px-1.5 py-0.5 rounded font-medium text-white ${typeInfo.gradient} flex items-center gap-1`}>
            <TypeIcon className="w-2.5 h-2.5" />
            {typeInfo.label}
          </span>
          {session.group && session.group !== "all" && (
            <span className="px-1.5 py-0.5 rounded bg-[rgb(var(--surface-muted))] font-medium">
              مجموعة {session.group}
            </span>
          )}
          {locInfo && LocIcon && (
            <span className={`flex items-center gap-0.5 ${locInfo.color}`}>
              <LocIcon className="w-2.5 h-2.5" />
              {locInfo.label}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ==========================================
// Grid Session Card (Grid View - Desktop)
// ==========================================
function GridSessionCard({ session }: { session: any }) {
  const subject = session.subjects;
  const color = subject?.color || "#3b82f6";
  const loc = (session.location || session.room || "").toLowerCase();
  const isOnline = loc.includes("online") || loc.includes("أونلاين") || loc.includes("اونلاين");

  return (
    <div
      className="p-2 rounded-lg text-[10px] space-y-1 border-r-2"
      style={{ backgroundColor: `${color}15`, borderRightColor: color }}
    >
      <p className="font-semibold truncate">{subject?.name || "—"}</p>
      <p className="font-mono text-[rgb(var(--text-muted))]">{session.start_time?.slice(0, 5)}</p>
      <div className="flex items-center gap-1 flex-wrap">
        <span className="px-1 py-0.5 rounded bg-[rgb(var(--surface))] font-medium">
          {session.type === "lecture" ? "محاضرة" : session.type === "lab" ? "معمل" : session.type === "tutorial" ? "سكشن" : session.type}
        </span>
        {isOnline && <Video className="w-2.5 h-2.5 text-cyan-500" />}
        {session.group && session.group !== "all" && (
          <span className="px-1 py-0.5 rounded bg-[rgb(var(--surface))]">مجموعة {session.group}</span>
        )}
      </div>
      {session.room && !isOnline && <p className="text-[rgb(var(--text-muted))]">{session.room}</p>}
    </div>
  );
}

// ==========================================
// Tasks Tab
// ==========================================
function TasksTab() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTasks = async () => {
      const supabase = createClient();
      const { data } = await supabase.from("tasks").select("*").eq("status", "active").order("deadline", { ascending: true });
      setTasks(data || []);
      setLoading(false);
    };
    fetchTasks();
  }, []);

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold flex items-center gap-2">
        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
        التكليفات النشطة
      </h2>
      {tasks.length === 0 ? (
        <EmptyState icon={CheckCircle2} message="لا توجد تكليفات نشطة" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
      )}
    </div>
  );
}

// ==========================================
// Inquiry Tab
// ==========================================
function InquiryTab() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState("أكاديمي");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || !message.trim()) return;
    setSubmitting(true);
    try {
      const supabase = createClient();
      await supabase.from("inquiries").insert([{ full_name: name.trim(), whatsapp_number: phone.trim(), message: message.trim(), category, status: "new" }]);
      setSuccess(true);
      setName(""); setPhone(""); setMessage("");
    } catch (err) { console.error(err); }
    finally { setSubmitting(false); }
  };

  if (success) {
    return (
      <div className="glass-card p-8 rounded-3xl text-center space-y-4 animate-bounce-in max-w-md mx-auto">
        <div className="w-16 h-16 rounded-full gradient-emerald flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-8 h-8 text-white" />
        </div>
        <h3 className="font-bold text-lg">تم إرسال استفسارك!</h3>
        <p className="text-xs text-[rgb(var(--text-muted))]">سيتم التواصل معك عبر الواتساب</p>
        <button onClick={() => setSuccess(false)} className="text-xs text-brand-500 hover:text-brand-400 font-medium">إرسال استفسار آخر</button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto space-y-4">
      <h2 className="text-lg font-bold flex items-center gap-2">
        <MessageSquarePlus className="w-5 h-5 text-brand-500" />
        تقديم استفسار
      </h2>
      <form onSubmit={handleSubmit} className="glass-card p-5 rounded-2xl space-y-4">
        <div>
          <label className="text-xs font-medium text-[rgb(var(--text-muted))] mb-1.5 block flex items-center gap-1.5">
            <User className="w-3 h-3" /> الاسم الكامل
          </label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className="w-full bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition" />
        </div>
        <div>
          <label className="text-xs font-medium text-[rgb(var(--text-muted))] mb-1.5 block flex items-center gap-1.5">
            <Phone className="w-3 h-3" /> رقم الواتساب
          </label>
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required dir="ltr" className="w-full bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition text-left font-mono" />
        </div>
        <div>
          <label className="text-xs font-medium text-[rgb(var(--text-muted))] mb-1.5 block">تصنيف الاستفسار</label>
          <div className="grid grid-cols-4 gap-2">
            {["أكاديمي", "جدول", "تكليف", "عام"].map((cat) => (
              <button key={cat} type="button" onClick={() => setCategory(cat)} className={`py-2 text-xs font-medium rounded-xl border transition ${category === cat ? "gradient-brand text-white border-transparent" : "bg-[rgb(var(--surface))] text-[rgb(var(--text-muted))] border-[rgb(var(--border))]"}`}>{cat}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-[rgb(var(--text-muted))] mb-1.5 block">الرسالة</label>
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} required rows={4} className="w-full bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition resize-none" />
        </div>
        <button type="submit" disabled={submitting} className="w-full gradient-brand text-white font-semibold py-3 rounded-xl transition shadow-lg shadow-brand-600/25 flex items-center justify-center gap-2 text-sm disabled:opacity-60">
          <Send className="w-4 h-4" /> {submitting ? "جاري الإرسال..." : "إرسال الاستفسار"}
        </button>
      </form>
    </div>
  );
}

// ==========================================
// Links Tab
// ==========================================
function LinksTab() {
  const [links, setLinks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLinks = async () => {
      const supabase = createClient();
      const { data } = await supabase.from("quick_links").select("*").order("order_index", { ascending: true });
      setLinks(data || []);
      setLoading(false);
    };
    fetchLinks();
  }, []);

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold flex items-center gap-2">
        <Link2 className="w-5 h-5 text-brand-500" /> روابط سريعة
      </h2>
      {links.length === 0 ? (
        <EmptyState icon={Link2} message="لا توجد روابط" />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {links.map((link) => (
            <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer" className="glass-card p-4 rounded-2xl hover:scale-[1.02] transition-all group">
              <div className="w-10 h-10 rounded-xl gradient-brand flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                <ExternalLink className="w-5 h-5 text-white" />
              </div>
              <h3 className="font-semibold text-sm mb-1">{link.title}</h3>
              <p className="text-[10px] text-[rgb(var(--text-muted))]">{link.type}</p>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

// ==========================================
// Shared Components
// ==========================================
function AnnouncementCard({ announcement }: { announcement: any }) {
  const getBadgeColor = (category: string) => {
    switch (category) {
      case "عاجل": return "gradient-rose";
      case "أكاديمي": return "gradient-brand";
      case "هام": return "gradient-amber";
      default: return "gradient-purple";
    }
  };
  return (
    <div className={`glass-card p-4 rounded-2xl space-y-2 ${announcement.is_pinned ? "border-brand-500/40" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold text-white ${getBadgeColor(announcement.category)}`}>{announcement.category}</span>
          {announcement.is_pinned && <Pin className="w-3 h-3 text-brand-500 fill-current" />}
        </div>
        <span className="text-[10px] text-[rgb(var(--text-muted))]">{new Date(announcement.created_at).toLocaleDateString("ar-EG", { day: "numeric", month: "short" })}</span>
      </div>
      <h3 className="font-bold text-sm leading-snug">{announcement.title}</h3>
      <p className="text-xs text-[rgb(var(--text-muted))] leading-relaxed whitespace-pre-line">{announcement.content}</p>
    </div>
  );
}

function DateCard({ date }: { date: any }) {
  const getIcon = (type: string) => {
    switch (type) { case "exam": return AlertCircle; case "deadline": return Clock; case "holiday": return Calendar; default: return Calendar; }
  };
  const Icon = getIcon(date.type);
  const getGradient = (type: string) => {
    switch (type) { case "exam": return "gradient-rose"; case "deadline": return "gradient-amber"; case "holiday": return "gradient-emerald"; default: return "gradient-brand"; }
  };
  const dateObj = new Date(date.date);
  const daysUntil = Math.ceil((dateObj.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  return (
    <div className="glass-card p-3 rounded-2xl flex items-center gap-3 card-hover">
      <div className={`w-10 h-10 rounded-xl ${getGradient(date.type)} flex items-center justify-center flex-shrink-0`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-sm truncate">{date.title}</h3>
        <p className="text-[10px] text-[rgb(var(--text-muted))]">{dateObj.toLocaleDateString("ar-EG", { day: "numeric", month: "long" })}</p>
      </div>
      {daysUntil <= 7 && daysUntil >= 0 && (
        <span className="text-[10px] font-bold text-amber-500 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 flex-shrink-0">
          {daysUntil === 0 ? "اليوم" : `${daysUntil} يوم`}
        </span>
      )}
    </div>
  );
}

function TaskCard({ task }: { task: any }) {
  const deadline = new Date(task.deadline);
  const daysLeft = Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const isUrgent = daysLeft <= 3 && daysLeft >= 0;
  const isOverdue = daysLeft < 0;
  return (
    <div className={`glass-card p-4 rounded-2xl space-y-2 ${isUrgent ? "border-amber-500/40" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full gradient-brand text-white">{task.subject}</span>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isOverdue ? "bg-rose-500/10 text-rose-500 border border-rose-500/30" : isUrgent ? "bg-amber-500/10 text-amber-500 border border-amber-500/30" : "bg-[rgb(var(--surface-subtle))] text-[rgb(var(--text-muted))]"}`}>
          {isOverdue ? "انتهى" : daysLeft === 0 ? "اليوم" : `${daysLeft} يوم`}
        </span>
      </div>
      <h3 className="font-bold text-sm">{task.title}</h3>
      {task.description && <p className="text-xs text-[rgb(var(--text-muted))] leading-relaxed">{task.description}</p>}
      <div className="flex items-center gap-1 text-[10px] text-[rgb(var(--text-muted))] pt-1">
        <Clock className="w-3 h-3" />
        <span>التسليم: {deadline.toLocaleDateString("ar-EG", { day: "numeric", month: "long" })}</span>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-3">
      {[...Array(3)].map((_, i) => (<div key={i} className="skeleton h-24 rounded-2xl" style={{ animationDelay: `${i * 0.1}s` }} />))}
    </div>
  );
}

function EmptyState({ icon: Icon, message }: { icon: any; message: string }) {
  return (
    <div className="glass-card p-8 rounded-2xl text-center space-y-3">
      <div className="w-12 h-12 rounded-full bg-[rgb(var(--surface-subtle))] flex items-center justify-center mx-auto">
        <Icon className="w-6 h-6 text-[rgb(var(--text-muted))]" />
      </div>
      <p className="text-xs text-[rgb(var(--text-muted))]">{message}</p>
    </div>
  );
}
