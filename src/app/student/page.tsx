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
    <div className="min-h-screen bg-surface-base text-text-primary">
      <div className="flex">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex flex-col w-64 min-h-screen sticky top-0 h-screen border-l border-border-default" style={{ background: "var(--color-surface-raised)" }}>
          <div className="p-6 space-y-6 flex flex-col h-full">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl gradient-brand flex items-center justify-center shadow-md shadow-glow">
                <BookOpen className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-base tracking-tight">منصة الدفعة</h1>
                <p className="text-xs text-text-muted">إدارة أكاديمية</p>
              </div>
            </div>

            <nav className="space-y-1 flex-1">
              <SidebarButton active={activeTab === "home"} onClick={() => setActiveTab("home")} icon={Megaphone} label="الرئيسية" />
              <SidebarButton active={activeTab === "schedule"} onClick={() => setActiveTab("schedule")} icon={Calendar} label="الجدول الأسبوعي" />
              <SidebarButton active={activeTab === "tasks"} onClick={() => setActiveTab("tasks")} icon={CheckCircle2} label="التكليفات" />
              <SidebarButton active={activeTab === "inquiry"} onClick={() => setActiveTab("inquiry")} icon={MessageSquarePlus} label="استفسار" />
              <SidebarButton active={activeTab === "links"} onClick={() => setActiveTab("links")} icon={Link2} label="روابط سريعة" />
            </nav>

            <div className="pt-4 border-t border-border-default flex items-center justify-between">
              <span className="text-xs text-text-muted">v4.0</span>
              <ThemeToggle />
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-h-screen">
          {/* Mobile Header */}
          <header className="lg:hidden sticky top-0 z-sticky glass-panel border-b border-border-default px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg gradient-brand flex items-center justify-center shadow-sm shadow-glow">
                  <BookOpen className="w-4 h-4 text-white" />
                </div>
                <h1 className="font-bold text-sm">منصة الدفعة</h1>
              </div>
              <ThemeToggle />
            </div>
          </header>

          {/* Content Area */}
          <main className="flex-1 p-4 lg:p-8 pb-28 lg:pb-8">
            <div className="max-w-5xl mx-auto">
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
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-sticky glass-panel border-t border-border-default">
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
      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-md text-sm font-medium transition-all duration-fast ease-standard ${
        active
          ? "gradient-brand text-white shadow-sm shadow-glow"
          : "text-text-secondary hover:text-text-primary hover:bg-surface-overlay"
      }`}
    >
      <Icon className="w-4 h-4" />
      <span>{label}</span>
    </button>
  );
}

function MobileTabButton({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: any; label: string }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-md transition ${active ? "text-brand" : "text-text-muted"}`}>
      <Icon className={`w-5 h-5 ${active ? "scale-110" : ""} transition-transform duration-fast`} />
      <span className="text-2xs mt-0.5">{label}</span>
    </button>
  );
}

// ==========================================
// Home Tab — Bento grid: announcements large + dates sidebar
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

  const filtered = announcements.filter((a) => !search || a.title.includes(search) || a.content.includes(search));

  if (loading) return <LoadingState />;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Announcements — 2/3 */}
      <div className="lg:col-span-2 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-heading tracking-tight flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-brand" />
            الإعلانات
          </h2>
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث في الإعلانات..."
              className="input w-full pr-9 pl-3 py-2 text-xs"
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

      {/* Upcoming Dates — 1/3 */}
      <div className="space-y-4">
        <h2 className="text-xl font-heading tracking-tight flex items-center gap-2">
          <Clock className="w-5 h-5 text-warning" />
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
// Schedule Tab — smart schedule with groups + types
// ==========================================
function ScheduleTab() {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState("الكل");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient();
      const { data } = await supabase.from("schedules").select("*, subjects(*)").eq("is_active", true).order("day_of_week").order("start_time");
      setSchedules(data || []);
      setLoading(false);
    };
    fetchData();
  }, []);

  const filtered = schedules.filter((s) => {
    if (selectedGroup === "الكل") return true;
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
        <h2 className="text-xl font-heading tracking-tight flex items-center gap-2">
          <Calendar className="w-5 h-5 text-brand" />
          الجدول الأسبوعي
        </h2>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-surface-inset p-1 rounded-md">
            <button onClick={() => setViewMode("list")} className={`px-3 py-1.5 rounded text-xs font-medium transition ${viewMode === "list" ? "gradient-brand text-white" : "text-text-muted"}`}>قائمة</button>
            <button onClick={() => setViewMode("grid")} className={`px-3 py-1.5 rounded text-xs font-medium transition ${viewMode === "grid" ? "gradient-brand text-white" : "text-text-muted"}`}>شبكة</button>
          </div>
        </div>
      </div>

      {/* Group filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-medium text-text-muted">المجموعة:</span>
        {GROUPS.map((g) => (
          <button
            key={g}
            onClick={() => setSelectedGroup(g)}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition duration-fast ${
              selectedGroup === g ? "gradient-brand text-white shadow-sm shadow-glow" : "bg-surface-inset text-text-muted hover:text-text-primary"
            }`}
          >
            {g}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Calendar} message="لا توجد جلسات" />
      ) : viewMode === "list" ? (
        <div className="space-y-5">
          {Object.entries(grouped).map(([day, sessions]) => (
            <div key={day}>
              <h3 className="text-sm font-heading text-text-secondary mb-2 flex items-center gap-2">
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
        <div className="hidden lg:grid grid-cols-7 gap-2">
          {DAYS.map((day, dayIdx) => (
            <div key={day} className="space-y-2">
              <h3 className="text-xs font-medium text-center text-text-muted py-1.5 bg-surface-inset rounded-md">{day}</h3>
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
// Session Card (List)
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

  const loc = (session.location || session.room || "").toLowerCase();
  const isOnline = loc.includes("online") || loc.includes("أونلاين") || loc.includes("اونلاين");
  const LocIcon = isOnline ? Video : MapPin;
  const locLabel = isOnline ? "أونلاين" : (session.room || "");

  return (
    <div className="card card-hover p-3 flex items-center gap-3">
      <div className="w-1 h-14 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
      <div className="text-center flex-shrink-0 min-w-[56px]">
        <p className="text-xs font-mono font-medium tabular">{session.start_time?.slice(0, 5)}</p>
        <p className="text-2xs text-text-muted">{session.end_time?.slice(0, 5)}</p>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{subject?.name || "—"}</p>
        <div className="flex items-center gap-2 text-2xs mt-0.5">
          <span className={`px-1.5 py-0.5 rounded font-medium text-white flex items-center gap-1 ${typeInfo.gradient}`}>
            <TypeIcon className="w-2.5 h-2.5" />
            {typeInfo.label}
          </span>
          {session.group && session.group !== "all" && (
            <span className="px-1.5 py-0.5 rounded bg-surface-inset font-medium">مجموعة {session.group}</span>
          )}
          {locLabel && (
            <span className={`flex items-center gap-0.5 ${isOnline ? "text-info" : "text-warning"}`}>
              <LocIcon className="w-2.5 h-2.5" />
              {locLabel}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ==========================================
// Grid Session Card (Desktop grid view)
// ==========================================
function GridSessionCard({ session }: { session: any }) {
  const subject = session.subjects;
  const color = subject?.color || "#3b82f6";
  const loc = (session.location || session.room || "").toLowerCase();
  const isOnline = loc.includes("online") || loc.includes("أونلاين") || loc.includes("اونلاين");

  return (
    <div className="p-2 rounded-md text-2xs space-y-1 border-r-2" style={{ backgroundColor: `${color}15`, borderRightColor: color }}>
      <p className="font-medium truncate">{subject?.name || "—"}</p>
      <p className="font-mono text-text-muted tabular">{session.start_time?.slice(0, 5)}</p>
      <div className="flex items-center gap-1 flex-wrap">
        <span className="px-1 py-0.5 rounded bg-surface-base font-medium">
          {session.type === "lecture" ? "محاضرة" : session.type === "lab" ? "معمل" : session.type === "tutorial" ? "سكشن" : session.type}
        </span>
        {isOnline && <Video className="w-2.5 h-2.5 text-info" />}
        {session.group && session.group !== "all" && <span className="px-1 py-0.5 rounded bg-surface-base">مجموعة {session.group}</span>}
      </div>
      {session.room && !isOnline && <p className="text-text-muted">{session.room}</p>}
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
      <h2 className="text-xl font-heading tracking-tight flex items-center gap-2">
        <CheckCircle2 className="w-5 h-5 text-success" />
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
      <div className="card p-8 rounded-xl text-center space-y-4 animate-bounce-in max-w-md mx-auto">
        <div className="w-16 h-16 rounded-full gradient-emerald flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-8 h-8 text-white" />
        </div>
        <h3 className="font-heading text-lg">تم إرسال استفسارك!</h3>
        <p className="text-sm text-text-secondary">سيتم التواصل معك عبر الواتساب</p>
        <button onClick={() => setSuccess(false)} className="text-xs text-brand hover:text-brand-hover font-medium">إرسال استفسار آخر</button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto space-y-4">
      <h2 className="text-xl font-heading tracking-tight flex items-center gap-2">
        <MessageSquarePlus className="w-5 h-5 text-brand" />
        تقديم استفسار
      </h2>
      <form onSubmit={handleSubmit} className="card p-5 rounded-lg space-y-4">
        <div>
          <label className="text-xs font-medium text-text-secondary mb-1.5 block flex items-center gap-1.5">
            <User className="w-3 h-3" /> الاسم الكامل
          </label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className="input w-full px-3.5 py-2.5 text-sm" />
        </div>
        <div>
          <label className="text-xs font-medium text-text-secondary mb-1.5 block flex items-center gap-1.5">
            <Phone className="w-3 h-3" /> رقم الواتساب
          </label>
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required dir="ltr" className="input w-full px-3.5 py-2.5 text-sm text-left font-mono" />
        </div>
        <div>
          <label className="text-xs font-medium text-text-secondary mb-1.5 block">تصنيف الاستفسار</label>
          <div className="grid grid-cols-4 gap-2">
            {["أكاديمي", "جدول", "تكليف", "عام"].map((cat) => (
              <button key={cat} type="button" onClick={() => setCategory(cat)} className={`py-2 text-xs font-medium rounded-md border transition ${category === cat ? "gradient-brand text-white border-transparent" : "bg-surface-inset text-text-secondary border-border-default"}`}>{cat}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-text-secondary mb-1.5 block">الرسالة</label>
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} required rows={4} className="input w-full px-3.5 py-2.5 text-sm resize-none" />
        </div>
        <button type="submit" disabled={submitting} className="btn-primary w-full py-3 rounded-md flex items-center justify-center gap-2 text-sm">
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
      <h2 className="text-xl font-heading tracking-tight flex items-center gap-2">
        <Link2 className="w-5 h-5 text-brand" /> روابط سريعة
      </h2>
      {links.length === 0 ? (
        <EmptyState icon={Link2} message="لا توجد روابط" />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {links.map((link) => (
            <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer" className="card card-hover p-4 rounded-lg group">
              <div className="w-10 h-10 rounded-lg gradient-brand flex items-center justify-center mb-2 group-hover:scale-110 transition-transform duration-fast">
                <ExternalLink className="w-5 h-5 text-white" />
              </div>
              <h3 className="font-medium text-sm mb-1">{link.title}</h3>
              <p className="text-2xs text-text-muted">{link.type}</p>
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
    <div className={`card p-4 rounded-lg space-y-2 ${announcement.is_pinned ? "border-brand/40" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded text-2xs font-medium text-white ${getBadgeColor(announcement.category)}`}>{announcement.category}</span>
          {announcement.is_pinned && <Pin className="w-3 h-3 text-brand fill-current" />}
        </div>
        <span className="text-2xs text-text-muted">{new Date(announcement.created_at).toLocaleDateString("ar-EG", { day: "numeric", month: "short" })}</span>
      </div>
      <h3 className="font-heading text-sm leading-snug">{announcement.title}</h3>
      <p className="text-xs text-text-secondary leading-relaxed whitespace-pre-line">{announcement.content}</p>
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
    <div className="card card-hover p-3 rounded-lg flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg ${getGradient(date.type)} flex items-center justify-center flex-shrink-0`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-sm truncate">{date.title}</h3>
        <p className="text-2xs text-text-muted">{dateObj.toLocaleDateString("ar-EG", { day: "numeric", month: "long" })}</p>
      </div>
      {daysUntil <= 7 && daysUntil >= 0 && (
        <span className="text-2xs font-bold text-warning px-2 py-0.5 rounded-full bg-warning/10 border border-warning/30 flex-shrink-0">
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
    <div className={`card p-4 rounded-lg space-y-2 ${isUrgent ? "border-warning/40" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-2xs font-bold px-2 py-0.5 rounded-full gradient-brand text-white">{task.subject}</span>
        <span className={`text-2xs font-bold px-2 py-0.5 rounded-full ${isOverdue ? "bg-destructive/10 text-destructive border border-destructive/30" : isUrgent ? "bg-warning/10 text-warning border border-warning/30" : "bg-surface-inset text-text-muted"}`}>
          {isOverdue ? "انتهى" : daysLeft === 0 ? "اليوم" : `${daysLeft} يوم`}
        </span>
      </div>
      <h3 className="font-heading text-sm">{task.title}</h3>
      {task.description && <p className="text-xs text-text-secondary leading-relaxed">{task.description}</p>}
      <div className="flex items-center gap-1 text-2xs text-text-muted pt-1">
        <Clock className="w-3 h-3" />
        <span>التسليم: {deadline.toLocaleDateString("ar-EG", { day: "numeric", month: "long" })}</span>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-3">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="skeleton h-24" style={{ animationDelay: `${i * 0.1}s` }} />
      ))}
    </div>
  );
}

function EmptyState({ icon: Icon, message }: { icon: any; message: string }) {
  return (
    <div className="card p-8 rounded-lg text-center space-y-3">
      <div className="w-12 h-12 rounded-full bg-surface-inset flex items-center justify-center mx-auto">
        <Icon className="w-6 h-6 text-text-muted" />
      </div>
      <p className="text-xs text-text-muted">{message}</p>
    </div>
  );
}
