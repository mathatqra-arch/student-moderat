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
import { PWAPrompts } from "@/components/ui/pwa/Prompts";
import {
  formatTime12,
  formatTimeOfDay12,
  hasTimeComponent,
  sessionTypeLabel,
  sessionTypeBg,
  isSessionOnline,
  sessionOnlineUrl,
} from "@/lib/format";

type Tab = "home" | "schedule" | "tasks" | "inquiry" | "links";

const DAYS = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
// Groups removed - all sessions shown together

// ==========================================
// حساب أقرب موعد قادم لجلسة أسبوعية (day_of_week + start_time)
// ==========================================
function nextSessionDate(dayOfWeek: number, startTime: string): Date {
  const now = new Date();
  const parts = (startTime || "00:00").split(":");
  const h = parseInt(parts[0] || "0", 10) || 0;
  const m = parseInt(parts[1] || "0", 10) || 0;
  const add = (((dayOfWeek - now.getDay()) % 7) + 7) % 7;
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + add, h, m, 0);
  if (d.getTime() <= now.getTime()) d.setDate(d.getDate() + 7);
  return d;
}

// ==========================================
// Bootstrap — ريكوست واحد لكل محتوى الصفحة
// كاش جلسة فوري (عرض لحظي عند الرجوع) + تحديث خلفي stale-while-revalidate
// ==========================================
interface BootstrapData {
  announcements: any[];
  schedules: any[];
  tasks: any[];
  links: any[];
  important_dates: any[];
  at: number; // وقت التخزين
}

const BOOTSTRAP_KEY = "student_bootstrap_v1";
const BOOTSTRAP_TTL = 60_000; // دقيقة — بعدها نحدّث من الشبكة في الخلفية

// منع تكرار الريكوست المتوازي (StrictMode / ريمونت سريع)
let bootstrapInFlight = false;

function readBootstrapCache(): BootstrapData | null {
  try {
    const raw = sessionStorage.getItem(BOOTSTRAP_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.announcements)) return null;
    return parsed as BootstrapData;
  } catch {
    return null;
  }
}

function useBootstrap() {
  const [data, setData] = useState<BootstrapData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setError(null);
    const cached = readBootstrapCache();
    if (cached) setData(cached); // عرض فوري من الكاش (إن وجد)

    // revalidate: لو مفيش كاش أو الكاش عدى عمره → نجيب من الشبكة
    // ولو الكاش لسه جديد بنعدّي الريكوست خالص = زيرو استهلاك
    if (cached && Date.now() - cached.at < BOOTSTRAP_TTL) return;
    if (bootstrapInFlight) return; // في ريكوست شغال — مش محتاجين تكرار
    bootstrapInFlight = true;

    fetch("/api/student/bootstrap", { cache: "no-cache" })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || `فشل التحميل (${res.status})`);
        const fresh: BootstrapData = { ...json, at: Date.now() };
        try { sessionStorage.setItem(BOOTSTRAP_KEY, JSON.stringify(fresh)); } catch {}
        setData(fresh); // تحديث خلفي صامت — المحتوى بيظهر حالاً ويتحدث لو فيه جديد
      })
      .catch((err: unknown) => {
        // فشل الشبكة ومعانا كاش قديم → نسيبه معروض (offline-friendly)
        if (!cached) setError(err instanceof Error ? err.message : "فشل تحميل المحتوى");
      })
      .finally(() => {
        bootstrapInFlight = false;
      });
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { data, error, retry: load };
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="brutal-card p-8 rounded-xl text-center space-y-3 max-w-md mx-auto">
      <AlertCircle className="w-10 h-10 text-coral mx-auto" />
      <h3 className="font-extrabold">حصلت مشكلة في التحميل</h3>
      <p className="text-xs text-gray">{message} — تأكد من اتصالك بالإنترنت وحاول تاني.</p>
      <button onClick={onRetry} className="brutal-btn-accent px-4 py-2 text-xs">إعادة المحاولة</button>
    </div>
  );
}

export default function StudentPage() {
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const { data, error, retry } = useBootstrap();

  return (
    <div className="min-h-screen bg-cream text-ink relative overflow-x-clip">
      {/* Decorative blobs */}
      <div className="blob-yellow" style={{ top: "-50px", right: "-50px" }} />
      <div className="blob-coral" style={{ bottom: "10%", left: "5%" }} />

      <div className="flex relative z-10">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex flex-col w-64 min-h-screen sticky top-0 h-screen border-l-2 border-ink bg-cream-light">
          <div className="p-5 space-y-5 flex flex-col h-full">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl border-2 border-ink bg-yellow shadow-brutal-sm flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-ink" />
              </div>
              <div>
                <h1 className="font-extrabold text-base tracking-tight">منصة الدفعة</h1>
                <p className="text-xs text-gray">إدارة أكاديمية</p>
              </div>
            </div>

            <nav className="space-y-1 flex-1">
              <BrutalNavButton active={activeTab === "home"} onClick={() => setActiveTab("home")} icon={Megaphone} label="الرئيسية" />
              <BrutalNavButton active={activeTab === "schedule"} onClick={() => setActiveTab("schedule")} icon={Calendar} label="الجدول الأسبوعي" />
              <BrutalNavButton active={activeTab === "tasks"} onClick={() => setActiveTab("tasks")} icon={CheckCircle2} label="التكليفات" />
              <BrutalNavButton active={activeTab === "inquiry"} onClick={() => setActiveTab("inquiry")} icon={MessageSquarePlus} label="استفسار" />
              <BrutalNavButton active={activeTab === "links"} onClick={() => setActiveTab("links")} icon={Link2} label="روابط سريعة" />
            </nav>

            <div className="p-3 brutal-card-flat bg-yellow rounded-lg">
              <p className="text-xs font-bold">💡 نصيحة اليوم</p>
              <p className="text-2xs text-gray mt-1">راجع الجدول الأسبوعي قبل كل محاضرة</p>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-h-screen min-w-0">
          {/* Mobile Header */}
          <header className="lg:hidden sticky top-0 z-30 bg-cream-light border-b-2 border-ink px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-lg border-2 border-ink bg-yellow shadow-brutal-sm flex items-center justify-center">
                  <BookOpen className="w-4 h-4 text-ink" />
                </div>
                <h1 className="font-extrabold text-sm">منصة الدفعة</h1>
              </div>
            </div>
          </header>

          {/* Content Area */}
          <main className="flex-1 p-4 lg:p-8 pb-28 lg:pb-8">
            <div className="max-w-5xl mx-auto">
              <div key={activeTab} className="tab-content">
                {!data ? (
                  error ? <ErrorState message={error} onRetry={retry} /> : <LoadingState />
                ) : (
                  <>
                    {activeTab === "home" && <HomeTab data={data} />}
                    {activeTab === "schedule" && <ScheduleTab schedules={data.schedules} />}
                    {activeTab === "tasks" && <TasksTab tasks={data.tasks} />}
                    {activeTab === "inquiry" && <InquiryTab />}
                    {activeTab === "links" && <LinksTab links={data.links} />}
                  </>
                )}
              </div>
            </div>
          </main>
        </div>
      </div>

      {/* Mobile Bottom Nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-cream-light border-t-2 border-ink">
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
// Brutal Nav Button (Sidebar)
// ==========================================
function BrutalNavButton({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: any; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`brutal-nav-item ${active ? "active" : ""}`}
    >
      <Icon className="w-4 h-4" />
      <span className="text-sm">{label}</span>
    </button>
  );
}

function MobileTabButton({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: any; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg border-2 transition ${
        active
          ? "border-ink bg-yellow shadow-brutal-sm"
          : "border-transparent text-gray"
      }`}
    >
      <Icon className={`w-5 h-5 ${active ? "scale-110" : ""} transition-transform`} />
      <span className="text-2xs mt-1 font-bold">{label}</span>
    </button>
  );
}

// ==========================================
// Home Tab
// ==========================================
function HomeTab({ data }: { data: BootstrapData }) {
  const [search, setSearch] = useState("");

  // مواعيد قادمة = المواعيد المهمة + أقرب الحصص القادمة من الجدول الأسبوعي
  const nowISO = new Date().toISOString();
  const dateItems = data.important_dates.map((d: any) => ({
    key: `date-${d.id}`,
    kind: "date" as const,
    when: new Date(d.date),
    data: d,
  }));
  const sessionItems = data.schedules.map((s: any) => ({
    key: `sess-${s.id}`,
    kind: "session" as const,
    when: nextSessionDate(s.day_of_week, s.start_time),
    data: s,
  }));
  const upcoming = [...dateItems, ...sessionItems]
    .sort((a, b) => a.when.getTime() - b.when.getTime())
    .slice(0, 8);

  // التكليفات القادمة — من الأقرب انتهاءً (فلترة محلية من نفس الداتا)
  const upcomingTasks = data.tasks.filter((t: any) => t.deadline && t.deadline >= nowISO).slice(0, 5);

  const announcements = data.announcements;
  const filtered = announcements.filter((a) => !search || a.title.includes(search) || a.content.includes(search));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Announcements — 2/3 */}
      <div className="lg:col-span-2 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-extrabold tracking-tight flex items-center gap-2">
            <Megaphone className="w-5 h-5" />
            الإعلانات
          </h2>
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث..."
              className="brutal-search"
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

      {/* Upcoming Dates + Schedule — 1/3 */}
      <div className="space-y-4">
        <h2 className="text-xl font-extrabold tracking-tight flex items-center gap-2">
          <Clock className="w-5 h-5" />
          مواعيد قادمة
        </h2>
        {upcoming.length === 0 ? (
          <EmptyState icon={Clock} message="لا توجد مواعيد" />
        ) : (
          <div className="space-y-3">
            {upcoming.map((item: any) =>
              item.kind === "date" ? (
                <DateCard key={item.key} date={item.data} />
              ) : (
                <NextSessionCard key={item.key} session={item.data} when={item.when} />
              )
            )}
          </div>
        )}
      </div>

      {/* تكليفات جديدة — مرتبة من الأقرب انتهاءً */}
      <div className="space-y-4">
        <h2 className="text-xl font-extrabold tracking-tight flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5" />
          تكليفات جديدة
        </h2>
        {upcomingTasks.length === 0 ? (
          <EmptyState icon={CheckCircle2} message="لا توجد تكليفات قادمة" />
        ) : (
          <div className="space-y-3">
            {upcomingTasks.map((task) => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ==========================================
// Schedule Tab
// ==========================================
function ScheduleTab({ schedules }: { schedules: any[] }) {
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

  const filtered = schedules;

  const grouped: Record<number, any[]> = {};
  filtered.forEach((s) => {
    if (!grouped[s.day_of_week]) grouped[s.day_of_week] = [];
    grouped[s.day_of_week].push(s);
  });
  // ترتيب صريح حسب الوقت داخل كل يوم (ضمان إضافي فوق ترتيب الاستعلام)
  Object.values(grouped).forEach((arr) =>
    arr.sort((a, b) => String(a.start_time || "").localeCompare(String(b.start_time || "")))
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-xl font-extrabold tracking-tight flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          الجدول الأسبوعي
        </h2>
        <div className="flex gap-1 p-1 brutal-card-flat rounded-lg">
          <button onClick={() => setViewMode("list")} className={`px-3 py-1.5 rounded text-xs font-bold transition ${viewMode === "list" ? "bg-ink text-cream-light" : "text-gray"}`}>قائمة</button>
          <button onClick={() => setViewMode("grid")} className={`px-3 py-1.5 rounded text-xs font-bold transition ${viewMode === "grid" ? "bg-ink text-cream-light" : "text-gray"}`}>شبكة</button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Calendar} message="لا توجد جلسات" />
      ) : viewMode === "list" ? (
        <div className="space-y-5">
          {Object.entries(grouped).map(([day, sessions]) => (
            <div key={day}>
              <h3 className="text-sm font-extrabold text-gray mb-2 flex items-center gap-2">
                <span className="w-1.5 h-4 rounded-full bg-ink" />
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
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2">
          {DAYS.map((day, dayIdx) => (
            <div key={day} className="space-y-2 min-w-0">
              <h3 className="text-xs font-extrabold text-center py-1.5 brutal-card-flat rounded-md bg-cream-dark">{day}</h3>
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
  const color = subject?.color || "#FFD54F";

  // تسميات موحدة (تدعم محاضرة/سكشن/معمل/امتحان/أي حصة)
  const typeInfo = { label: sessionTypeLabel(session.type), bg: sessionTypeBg(session.type) };
  const TypeIcon = BookOpen;

  const isOnline = isSessionOnline(session);
  const LocIcon = isOnline ? Video : MapPin;

  // رابط الحصة الأونلاين (من عمود link أو الحقول القديمة)
  const onlineUrl = sessionOnlineUrl(session);
  const hasOnlineLink = isOnline && onlineUrl.startsWith("http");
  
  // لو فيه رابط، نخلي البطاقة clickable
  const CardWrapper = hasOnlineLink ? "a" : "div";
  const cardProps = hasOnlineLink ? {
    href: onlineUrl,
    target: "_blank",
    rel: "noopener noreferrer",
  } : {};

  return (
    <CardWrapper {...(cardProps as any)} className={`brutal-card p-3 flex items-center gap-3 ${hasOnlineLink ? "cursor-pointer hover:translate-x-[-2px] hover:translate-y-[-2px]" : ""}`}>
      <div className="w-1.5 h-14 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
      {/* الوقت بنظام 12 ساعة (ص/م) */}
      <div className="text-center flex-shrink-0 min-w-[64px]">
        <p className="text-xs font-bold text-ink whitespace-nowrap">{formatTime12(session.start_time)}</p>
        <p className="text-2xs text-gray font-bold whitespace-nowrap">{formatTime12(session.end_time)}</p>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm truncate text-ink">{subject?.name || "—"}</p>
        <div className="flex items-center gap-2 text-2xs mt-0.5 flex-wrap">
          <span className={`brutal-badge ${typeInfo.bg}`}>
            <TypeIcon className="w-2.5 h-2.5" />
            {typeInfo.label}
          </span>
          <span className={`brutal-badge ${isOnline ? "bg-green" : "bg-yellow"}`}>
            <LocIcon className="w-2.5 h-2.5" />
            {isOnline ? "أونلاين" : (session.room || "في الكلية")}
          </span>
          {hasOnlineLink && (
            <span className="brutal-badge bg-teal">
              <ExternalLink className="w-2.5 h-2.5" />
              انضم
            </span>
          )}
        </div>
      </div>
    </CardWrapper>
  );
}

// ==========================================
// Grid Session Card
// ==========================================
function GridSessionCard({ session }: { session: any }) {
  const subject = session.subjects;
  const color = subject?.color || "#FFD54F";
  const isOnline = isSessionOnline(session);
  const onlineUrl = sessionOnlineUrl(session);
  const hasOnlineLink = isOnline && onlineUrl.startsWith("http");
  const CardWrapper = hasOnlineLink ? "a" : "div";
  const cardProps = hasOnlineLink ? { href: onlineUrl, target: "_blank", rel: "noopener noreferrer" } : {};

  return (
    <CardWrapper {...(cardProps as any)} className={`block p-2 brutal-card-flat rounded-md text-2xs space-y-1 min-w-0 overflow-hidden ${hasOnlineLink ? "cursor-pointer hover:shadow-brutal-sm" : ""}`} style={{ borderLeft: `4px solid ${color}` }}>
      <p className="font-bold truncate text-ink">{subject?.name || "—"}</p>
      <p className="text-gray font-bold whitespace-nowrap">{formatTime12(session.start_time)}</p>
      {/* بادج واحد بس للحضور: فيه لينك ← انضم (الأونلاين مفهومة منه) · أونلاين بدون لينك ← أونلاين */}
      <div className="flex items-center gap-1 flex-wrap min-w-0">
        <span className="brutal-badge brutal-badge-sm bg-cream-dark text-ink flex-shrink-0">
          {sessionTypeLabel(session.type)}
        </span>
        {hasOnlineLink && (
          <span className="brutal-badge brutal-badge-sm bg-teal text-ink flex-shrink-0">
            <ExternalLink className="w-2 h-2 flex-shrink-0" />
            انضم
          </span>
        )}
        {isOnline && !hasOnlineLink && (
          <span className="brutal-badge brutal-badge-sm bg-green text-ink flex-shrink-0">
            <Video className="w-2 h-2 flex-shrink-0" />
            أونلاين
          </span>
        )}
      </div>
      {!isOnline && session.room && <p className="text-gray font-bold truncate">{session.room}</p>}
    </CardWrapper>
  );
}

// ==========================================
// Tasks Tab
// ==========================================
function TasksTab({ tasks }: { tasks: any[] }) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-extrabold tracking-tight flex items-center gap-2">
        <CheckCircle2 className="w-5 h-5" />
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
      <div className="brutal-card p-8 rounded-xl text-center space-y-4 animate-bounce-in max-w-md mx-auto bg-green">
        <div className="w-16 h-16 rounded-full border-2 border-ink bg-cream-light flex items-center justify-center mx-auto shadow-brutal-sm">
          <CheckCircle2 className="w-8 h-8 text-ink" />
        </div>
        <h3 className="font-extrabold text-lg">تم إرسال استفسارك!</h3>
        <p className="text-sm">سيتم التواصل معك عبر الواتساب</p>
        <button onClick={() => setSuccess(false)} className="brutal-btn-ghost px-4 py-2 text-xs">إرسال استفسار آخر</button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto space-y-4">
      <h2 className="text-xl font-extrabold tracking-tight flex items-center gap-2">
        <MessageSquarePlus className="w-5 h-5" />
        تقديم استفسار
      </h2>
      <form onSubmit={handleSubmit} className="brutal-card p-5 space-y-4">
        <div>
          <label className="text-xs font-bold mb-1.5 block flex items-center gap-1.5" htmlFor="inq-name">
            <User className="w-3 h-3" aria-hidden="true" /> الاسم الكامل
          </label>
          <input id="inq-name" type="text" aria-label="الاسم" value={name} onChange={(e) => setName(e.target.value)} required className="brutal-input w-full px-3.5 py-2.5 text-sm" />
        </div>
        <div>
          <label className="text-xs font-bold mb-1.5 block flex items-center gap-1.5" htmlFor="inq-phone">
            <Phone className="w-3 h-3" aria-hidden="true" /> رقم الواتساب
          </label>
          <input id="inq-phone" type="tel" autoComplete="tel" aria-label="رقم الواتساب" value={phone} onChange={(e) => setPhone(e.target.value)} required dir="ltr" className="brutal-input w-full px-3.5 py-2.5 text-sm text-left font-mono" />
        </div>
        <div>
          <label className="text-xs font-bold mb-1.5 block">تصنيف الاستفسار</label>
          <div className="grid grid-cols-4 gap-2">
            {["أكاديمي", "جدول", "تكليف", "عام"].map((cat) => (
              <button key={cat} type="button" onClick={() => setCategory(cat)} className={`brutal-chip ${category === cat ? "active" : ""}`}>{cat}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs font-bold mb-1.5 block" htmlFor="inq-message">الرسالة</label>
          <textarea id="inq-message" aria-label="نص الاستفسار" value={message} onChange={(e) => setMessage(e.target.value)} required rows={4} className="brutal-input w-full px-3.5 py-2.5 text-sm resize-none" />
        </div>
        <button type="submit" disabled={submitting} className="brutal-btn-accent w-full py-3 flex items-center justify-center gap-2 text-sm">
          <Send className="w-4 h-4" /> {submitting ? "جاري الإرسال..." : "إرسال الاستفسار"}
        </button>
      </form>
    </div>
  );
}

// ==========================================
// Links Tab
// ==========================================
function LinksTab({ links }: { links: any[] }) {

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-extrabold tracking-tight flex items-center gap-2">
        <Link2 className="w-5 h-5" /> روابط سريعة
      </h2>
      {links.length === 0 ? (
        <EmptyState icon={Link2} message="لا توجد روابط" />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {links.map((link) => (
            <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer" className="brutal-card p-4 group">
              <div className="w-10 h-10 rounded-lg border-2 border-ink bg-yellow flex items-center justify-center mb-2 group-hover:rotate-6 transition-transform">
                <ExternalLink className="w-5 h-5 text-ink" />
              </div>
              <h3 className="font-bold text-sm mb-1">{link.title}</h3>
              <p className="text-2xs text-gray">{link.type}</p>
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
  const getBadgeStyle = (category: string) => {
    switch (category) {
      case "عاجل": return "bg-coral text-cream-light";
      case "أكاديمي": return "bg-blue text-cream-light";
      case "هام": return "bg-yellow text-ink";
      default: return "bg-purple-soft text-cream-light";
    }
  };
  return (
    <div className={`brutal-card p-5 space-y-3 ${announcement.is_pinned ? "border-blue" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`brutal-badge ${getBadgeStyle(announcement.category)}`}>{announcement.category}</span>
          {announcement.is_pinned && <Pin className="w-3.5 h-3.5 fill-current text-ink" />}
        </div>
        <span className="text-2xs text-gray font-bold">{new Date(announcement.created_at).toLocaleDateString("ar-EG", { day: "numeric", month: "short" })}</span>
      </div>
      <h3 className="font-extrabold text-sm leading-snug text-ink">{announcement.title}</h3>
      <p className="text-xs text-ink-light leading-relaxed whitespace-pre-line">{announcement.content}</p>
    </div>
  );
}

// ==========================================
// Next Session Card — أقرب حصة قادمة من الجدول الأسبوعي
// ==========================================
function NextSessionCard({ session, when }: { session: any; when: Date }) {
  const subject = session.subjects;
  const color = subject?.color || "#FFD54F";
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const daysUntil = Math.round((startOfDay(when) - startOfDay(new Date())) / 86400000);
  const isOnline = isSessionOnline(session);

  // تسمية موحدة تشمل section/other
  const typeLabel = sessionTypeLabel(session.type);
  const typeBg = sessionTypeBg(session.type);

  // رابط الحصة الأونلاين — لو موجود الكارت كله قابل للضغط يفتح المحاضرة
  const onlineUrl = sessionOnlineUrl(session);
  const hasOnlineLink = isOnline && onlineUrl.startsWith("http");
  const CardWrapper = hasOnlineLink ? "a" : "div";
  const cardProps = hasOnlineLink ? { href: onlineUrl, target: "_blank", rel: "noopener noreferrer" } : {};

  return (
    <CardWrapper {...(cardProps as any)} className={`brutal-card p-3 flex items-center gap-3 ${hasOnlineLink ? "cursor-pointer hover:translate-x-[-2px] hover:translate-y-[-2px]" : ""}`}>
      <div className="w-1.5 h-12 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`brutal-badge ${typeBg}`}>
            <BookOpen className="w-2.5 h-2.5" />
            {typeLabel}
          </span>
          <span className="brutal-badge bg-cream-dark text-ink">أسبوعي</span>
          {hasOnlineLink && (
            <span className="brutal-badge bg-teal">
              <ExternalLink className="w-2.5 h-2.5" />
              انضم
            </span>
          )}
        </div>
        <h3 className="font-bold text-sm truncate text-ink mt-1">{subject?.name || "—"}</h3>
        <p className="text-2xs text-gray font-bold">
          {DAYS[session.day_of_week]} · {when.toLocaleDateString("ar-EG", { day: "numeric", month: "long" })} · {formatTime12(session.start_time)}
          {isOnline ? " · أونلاين" : session.room ? ` · ${session.room}` : ""}
        </p>
      </div>
      {daysUntil <= 7 && daysUntil >= 0 && (
        <span className="brutal-badge bg-yellow text-ink">
          {daysUntil === 0 ? "اليوم" : daysUntil === 1 ? "غداً" : `${daysUntil}ي`}
        </span>
      )}
    </CardWrapper>
  );
}

function DateCard({ date }: { date: any }) {
  const getIcon = (type: string) => {
    switch (type) { case "exam": return AlertCircle; case "deadline": return Clock; case "holiday": return Calendar; default: return Calendar; }
  };
  const Icon = getIcon(date.type);
  const getBg = (type: string) => {
    switch (type) { case "exam": return "bg-coral"; case "deadline": return "bg-yellow"; case "holiday": return "bg-green"; default: return "bg-blue"; }
  };
  const dateObj = new Date(date.date);
  const daysUntil = Math.ceil((dateObj.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  // الوقت بنظام 12 ساعة — يظهر فقط للمواعيد ذات ساعة محددة (غير منتصف الليل)
  const timePart = hasTimeComponent(dateObj) ? ` · ${formatTimeOfDay12(dateObj)}` : "";
  return (
    <div className="brutal-card p-3 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg border-2 border-ink ${getBg(date.type)} flex items-center justify-center flex-shrink-0`}>
        <Icon className="w-5 h-5 text-ink" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-bold text-sm truncate text-ink">{date.title}</h3>
        <p className="text-2xs text-gray font-bold">{dateObj.toLocaleDateString("ar-EG", { day: "numeric", month: "long" })}{timePart}</p>
      </div>
      {daysUntil <= 7 && daysUntil >= 0 && (
        <span className="brutal-badge bg-yellow text-ink">
          {daysUntil === 0 ? "اليوم" : `${daysUntil}ي`}
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
    <div className={`brutal-card p-4 space-y-2 ${isUrgent ? "border-coral" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="brutal-badge bg-blue text-cream-light">{task.subject}</span>
        <span className={`brutal-badge ${isOverdue ? "bg-coral text-cream-light" : isUrgent ? "bg-yellow text-ink" : "bg-cream-dark text-ink"}`}>
          {isOverdue ? "انتهى" : daysLeft === 0 ? "اليوم" : `${daysLeft} يوم`}
        </span>
      </div>
      <h3 className="font-extrabold text-sm">{task.title}</h3>
      {task.description && <p className="text-xs text-ink-light leading-relaxed">{task.description}</p>}
      <div className="flex items-center gap-1 text-2xs text-gray font-bold pt-1">
        <Clock className="w-3 h-3" />
        <span>التسليم: {deadline.toLocaleDateString("ar-EG", { day: "numeric", month: "long" })} · {formatTimeOfDay12(deadline)}</span>
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
    <div className="brutal-card p-8 rounded-xl text-center space-y-3">
      <div className="w-12 h-12 rounded-full border-2 border-ink bg-cream-dark flex items-center justify-center mx-auto">
        <Icon className="w-6 h-6 text-gray" />
      </div>
      <p className="text-xs text-ink-soft font-bold">{message}</p>
    </div>
  );
}
