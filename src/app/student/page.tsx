"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Bell,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  Clock3,
  ExternalLink,
  FileText,
  GraduationCap,
  LayoutDashboard,
  Link2,
  ListChecks,
  MapPin,
  Menu,
  MessageSquarePlus,
  Moon,
  MoreHorizontal,
  Pin,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Sun,
  Users,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { PWAPrompts } from "@/components/ui/pwa/Prompts";

type Tab = "home" | "schedule" | "tasks" | "subjects" | "inquiry" | "links";

const DAYS = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

type DashboardData = {
  announcements: any[];
  dates: any[];
  schedules: any[];
  tasks: any[];
  subjects: any[];
  links: any[];
};

const EMPTY: DashboardData = {
  announcements: [],
  dates: [],
  schedules: [],
  tasks: [],
  subjects: [],
  links: [],
};

export default function StudentPage() {
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [data, setData] = useState<DashboardData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const [ann, dates, schedule, tasks, subjects, links] = await Promise.all([
        supabase.from("announcements").select("*").order("is_pinned", { ascending: false }).order("created_at", { ascending: false }).limit(8),
        supabase.from("important_dates").select("*, subjects(*)").gte("date", new Date().toISOString()).order("date", { ascending: true }).limit(8),
        supabase.from("schedules").select("*, subjects(*)").eq("is_active", true).order("day_of_week").order("start_time"),
        supabase.from("tasks").select("*").order("deadline", { ascending: true }).limit(30),
        supabase.from("subjects").select("*").order("name"),
        supabase.from("quick_links").select("*").order("order_index"),
      ]);

      setData({
        announcements: ann.data || [],
        dates: dates.data || [],
        schedules: schedule.data || [],
        tasks: tasks.data || [],
        subjects: subjects.data || [],
        links: links.data || [],
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const activeTasks = useMemo(() => data.tasks.filter((x) => x.status === "active"), [data.tasks]);
  const overdueTasks = useMemo(
    () => activeTasks.filter((x) => new Date(x.deadline).getTime() < Date.now()),
    [activeTasks]
  );
  const completion = data.tasks.length
    ? Math.round((data.tasks.filter((x) => x.status === "closed").length / data.tasks.length) * 100)
    : 0;

  const searchResults = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.trim().toLowerCase();
    return [
      ...data.announcements.map((x) => ({ type: "إعلان", title: x.title, body: x.content })),
      ...data.tasks.map((x) => ({ type: "تكليف", title: x.title, body: `${x.subject} — ${x.description || ""}` })),
      ...data.subjects.map((x) => ({ type: "مادة", title: x.name, body: x.instructor || "" })),
      ...data.links.map((x) => ({ type: "رابط", title: x.title, body: x.url })),
    ].filter((x) => `${x.title} ${x.body}`.toLowerCase().includes(q)).slice(0, 7);
  }, [data, query]);

  const nav = [
    { id: "home" as Tab, label: "الرئيسية", icon: LayoutDashboard },
    { id: "schedule" as Tab, label: "الجدول", icon: CalendarDays },
    { id: "tasks" as Tab, label: "التكليفات", icon: ListChecks },
    { id: "subjects" as Tab, label: "المواد", icon: BookOpen },
    { id: "inquiry" as Tab, label: "استفسار", icon: MessageSquarePlus },
    { id: "links" as Tab, label: "روابط", icon: Link2 },
  ];

  const go = (tab: Tab) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

  return (
    <div className="student-app">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <header className="student-topbar">
        <div className="topbar-inner">
          <div className="brand-lockup">
            <div className="brand-icon">
              <img src="/icons/icon-192.png" alt="شعار المنصة" />
            </div>
            <div className="brand-copy">
              <strong>منصة الدفعة</strong>
              <span>كل اللي يخص دراستك في مكان واحد</span>
            </div>
          </div>

          <div className="topbar-actions">
            <div className="search-wrap">
              <Search className="search-icon" size={17} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ابحث في المنصة..."
                aria-label="البحث"
              />
              {query && (
                <button onClick={() => setQuery("")} aria-label="مسح البحث">
                  <X size={15} />
                </button>
              )}
            </div>
            <button className="icon-action" aria-label="الإشعارات">
              <Bell size={18} />
              <span className="notification-dot" />
            </button>
            <ThemeToggle className="!w-10 !h-10 !rounded-2xl" />
            <button
              className="icon-action mobile-only"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="فتح القائمة"
            >
              {mobileMenuOpen ? <X size={19} /> : <Menu size={19} />}
            </button>
          </div>
        </div>

        {searchResults.length > 0 && (
          <div className="search-panel">
            {searchResults.map((item, i) => (
              <button key={i} className="search-result" onClick={() => setQuery("")}>
                <div>
                  <span>{item.type}</span>
                  <strong>{item.title}</strong>
                  <p>{item.body}</p>
                </div>
                <ChevronLeft size={17} />
              </button>
            ))}
          </div>
        )}
      </header>

      <div className="app-layout">
        <aside className={`student-sidebar ${mobileMenuOpen ? "open" : ""}`}>
          <div className="profile-card">
            <div className="profile-avatar">
              <GraduationCap size={24} />
            </div>
            <div className="profile-copy">
              <span>مرحباً 👋</span>
              <strong>طالب في الدفعة</strong>
              <small>تصفح بدون تسجيل دخول</small>
            </div>
          </div>

          <nav className="side-nav">
            {nav.map((item) => {
              const Icon = item.icon;
              const active = item.id === activeTab;
              return (
                <button key={item.id} onClick={() => go(item.id)} className={active ? "active" : ""}>
                  <span className="nav-icon"><Icon size={18} /></span>
                  <span>{item.label}</span>
                  {item.id === "tasks" && activeTasks.length > 0 && <b>{activeTasks.length}</b>}
                </button>
              );
            })}
          </nav>

          <div className="sidebar-tip">
            <div className="tip-icon"><Sparkles size={16} /></div>
            <div>
              <strong>نصيحة اليوم</strong>
              <p>راجع أقرب تكليف قبل بداية يومك، وسيب وقت بسيط للطوارئ.</p>
            </div>
          </div>

          <button className="sidebar-refresh" onClick={() => void load()} disabled={loading}>
            <RefreshCw size={16} className={loading ? "spin" : ""} />
            <span>تحديث البيانات</span>
          </button>
        </aside>

        <main className="student-main">
          <div className="page-heading">
            <div>
              <span className="eyebrow">لوحة الطالب</span>
              <h1>
                {activeTab === "home" && "نظرة سريعة على يومك"}
                {activeTab === "schedule" && "الجدول الأسبوعي"}
                {activeTab === "tasks" && "التكليفات والمهام"}
                {activeTab === "subjects" && "المواد الدراسية"}
                {activeTab === "inquiry" && "تواصل مع إدارة الدفعة"}
                {activeTab === "links" && "كل الروابط المهمة"}
              </h1>
            </div>
            <div className="heading-meta">
              <span className="status-pill"><span /> المنصة تعمل</span>
              <span className="date-pill">{new Date().toLocaleDateString("ar-EG", { weekday: "long", day: "numeric", month: "long" })}</span>
            </div>
          </div>

          {loading ? (
            <DashboardSkeleton />
          ) : (
            <div className="tab-content tab-fade">
              {activeTab === "home" && (
                <HomeDashboard
                  data={data}
                  completion={completion}
                  activeTasks={activeTasks}
                  overdueTasks={overdueTasks}
                  go={go}
                />
              )}
              {activeTab === "schedule" && <SchedulePanel schedules={data.schedules} />}
              {activeTab === "tasks" && <TasksPanel tasks={data.tasks} />}
              {activeTab === "subjects" && <SubjectsPanel subjects={data.subjects} />}
              {activeTab === "inquiry" && <InquiryPanel />}
              {activeTab === "links" && <LinksPanel links={data.links} />}
            </div>
          )}
        </main>
      </div>

      <div className="mobile-bottom-nav">
        {nav.slice(0, 5).map((item) => {
          const Icon = item.icon;
          return (
            <button key={item.id} onClick={() => go(item.id)} className={item.id === activeTab ? "active" : ""}>
              <Icon size={18} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      <PWAPrompts />
    </div>
  );
}

function HomeDashboard({
  data,
  completion,
  activeTasks,
  overdueTasks,
  go,
}: {
  data: DashboardData;
  completion: number;
  activeTasks: any[];
  overdueTasks: any[];
  go: (tab: Tab) => void;
}) {
  return (
    <div className="dashboard-stack">
      <section className="welcome-card">
        <div className="welcome-copy">
          <span className="welcome-kicker"><Sparkles size={14} /> مركزك الدراسي</span>
          <h2>خليك شايف الصورة كاملة.</h2>
          <p>تابع الإعلانات، جدولك، التكليفات، والروابط المهمة من شاشة واحدة.</p>
          <div className="welcome-actions">
            <button className="primary-cta" onClick={() => go("tasks")}>ابدأ بالتكليفات <ArrowLeft size={16} /></button>
            <button className="secondary-cta" onClick={() => go("schedule")}>شوف الجدول</button>
          </div>
        </div>
        <div className="progress-hero">
          <div className="progress-ring" style={{ "--progress": `${completion}%` } as CSSProperties}>
            <div>
              <strong>{completion}%</strong>
              <span>إنجاز المهام</span>
            </div>
          </div>
          <div className="hero-mini">
            <span><b>{activeTasks.length}</b> نشطة</span>
            <span className={overdueTasks.length ? "danger" : ""}><b>{overdueTasks.length}</b> متأخرة</span>
          </div>
        </div>
      </section>

      <section className="stat-grid">
        <MetricCard icon={BookOpen} label="المواد" value={data.subjects.length} note="مواد مسجلة" tone="blue" />
        <MetricCard icon={ListChecks} label="التكليفات" value={activeTasks.length} note="مفتوحة حالياً" tone="purple" />
        <MetricCard icon={CalendarDays} label="المواعيد" value={data.dates.length} note="مواعيد قادمة" tone="orange" />
        <MetricCard icon={Bell} label="الإعلانات" value={data.announcements.length} note="آخر المستجدات" tone="teal" />
      </section>

      <div className="content-grid">
        <section className="panel large-panel">
          <PanelHeader title="آخر الإعلانات" subtitle="محدثة من إدارة الدفعة" icon={Bell} action={() => go("home")} />
          <div className="announcement-list">
            {data.announcements.length === 0 ? (
              <Empty text="مفيش إعلانات منشورة لسه." />
            ) : data.announcements.slice(0, 4).map((item) => (
              <article key={item.id} className={`announcement-item ${item.is_pinned ? "pinned" : ""}`}>
                <div className="announcement-mark">
                  {item.is_pinned ? <Pin size={15} /> : <MegaphoneIcon />}
                </div>
                <div className="announcement-body">
                  <div className="row-between">
                    <span className={`soft-badge ${item.category === "عاجل" ? "rose" : item.category === "هام" ? "orange" : "blue"}`}>
                      {item.category || "عام"}
                    </span>
                    <time>{formatDate(item.created_at)}</time>
                  </div>
                  <h3>{item.title}</h3>
                  <p>{item.content}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="panel">
          <PanelHeader title="أقرب المواعيد" subtitle="خلي عينك عليها" icon={Clock3} />
          <div className="date-list">
            {data.dates.length === 0 ? <Empty text="مفيش مواعيد قريبة." /> : data.dates.slice(0, 5).map((date) => (
              <div key={date.id} className="date-item">
                <div className="date-box">
                  <strong>{new Date(date.date).getDate()}</strong>
                  <span>{new Date(date.date).toLocaleDateString("ar-EG", { month: "short" })}</span>
                </div>
                <div>
                  <strong>{date.title}</strong>
                  <p>{date.subjects?.name || labelForDate(date.type)}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="content-grid">
        <section className="panel">
          <PanelHeader title="تكليفات قريبة" subtitle="الأقرب للتسليم أولاً" icon={ListChecks} action={() => go("tasks")} />
          <div className="task-preview-list">
            {activeTasks.length === 0 ? <Empty text="أنت تمام، مفيش تكليفات نشطة." /> : activeTasks.slice(0, 4).map((task) => (
              <div key={task.id} className="task-preview">
                <div className="task-check">
                  <CheckCircle2 size={17} />
                </div>
                <div className="task-copy">
                  <strong>{task.title}</strong>
                  <span>{task.subject} · {formatDeadline(task.deadline)}</span>
                </div>
                <ChevronLeft size={16} />
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <PanelHeader title="وصول سريع" subtitle="أهم الأدوات والروابط" icon={Link2} action={() => go("links")} />
          <div className="quick-grid">
            {data.links.slice(0, 4).map((link) => (
              <a key={link.id} href={link.url} target="_blank" rel="noreferrer" className="quick-card">
                <div className="quick-icon"><ExternalLink size={16} /></div>
                <strong>{link.title}</strong>
                <span>{link.type || "رابط"}</span>
              </a>
            ))}
            {data.links.length === 0 && <Empty text="لسه مفيش روابط مضافة." />}
          </div>
        </section>
      </div>
    </div>
  );
}

function SchedulePanel({ schedules }: { schedules: any[] }) {
  const grouped = schedules.reduce<Record<number, any[]>>((acc, item) => {
    if (!acc[item.day_of_week]) acc[item.day_of_week] = [];
    acc[item.day_of_week].push(item);
    return acc;
  }, {});

  return (
    <div className="panel-stack">
      <div className="schedule-toolbar">
        <div>
          <strong>جدول الأسبوع</strong>
          <span>{schedules.length} جلسة دراسية</span>
        </div>
        <div className="legend">
          <span><i className="dot lecture" /> محاضرة</span>
          <span><i className="dot lab" /> معمل</span>
          <span><i className="dot tutorial" /> سكشن</span>
        </div>
      </div>
      <div className="week-grid">
        {DAYS.map((day, dayIndex) => (
          <div className={`day-column ${grouped[dayIndex]?.length ? "has-items" : ""}`} key={day}>
            <div className="day-header">
              <span>{day}</span>
              <b>{grouped[dayIndex]?.length || 0}</b>
            </div>
            <div className="day-items">
              {grouped[dayIndex]?.map((session) => (
                <div className="schedule-card" key={session.id}>
                  <div className="subject-accent" style={{ background: session.subjects?.color || "#269cb1" }} />
                  <div className="schedule-main">
                    <strong>{session.subjects?.name || "مادة غير محددة"}</strong>
                    <span>{formatTime(session.start_time)} — {formatTime(session.end_time)}</span>
                    <div>
                      {session.room && <span><MapPin size={12} /> {session.room}</span>}
                      <span><Clock3 size={12} /> {labelForType(session.type)}</span>
                    </div>
                  </div>
                </div>
              ))}
              {!grouped[dayIndex]?.length && <div className="empty-day">راحة 🎉</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TasksPanel({ tasks }: { tasks: any[] }) {
  const [filter, setFilter] = useState<"all" | "active" | "closed">("all");
  const filtered = tasks.filter((task) => filter === "all" || task.status === filter);

  return (
    <div className="panel">
      <div className="panel-title-row">
        <div>
          <strong>كل التكليفات</strong>
          <span>راجع حالتك ومواعيد التسليم</span>
        </div>
        <div className="segmented">
          {[
            ["all", "الكل"],
            ["active", "نشطة"],
            ["closed", "مغلقة"],
          ].map(([key, label]) => (
            <button key={key} onClick={() => setFilter(key as any)} className={filter === key ? "active" : ""}>{label}</button>
          ))}
        </div>
      </div>

      <div className="full-task-list">
        {filtered.map((task) => {
          const urgent = task.status === "active" && new Date(task.deadline).getTime() - Date.now() < 48 * 60 * 60 * 1000;
          return (
            <article key={task.id} className={`full-task-card ${urgent ? "urgent" : ""}`}>
              <div className="task-status-icon">
                {task.status === "closed" ? <CheckCircle2 size={21} /> : <ListChecks size={21} />}
              </div>
              <div className="full-task-body">
                <div className="row-between">
                  <span className="soft-badge blue">{task.subject}</span>
                  <span className={`deadline ${urgent ? "danger" : ""}`}><Clock3 size={13} /> {formatDeadline(task.deadline)}</span>
                </div>
                <h3>{task.title}</h3>
                <p>{task.description || "لا يوجد وصف إضافي للتكليف."}</p>
                <span className={`status-text ${task.status === "closed" ? "closed" : ""}`}>
                  {task.status === "closed" ? "تم إغلاق التكليف" : "التكليف مفتوح"}
                </span>
              </div>
            </article>
          );
        })}
        {filtered.length === 0 && <Empty text="مفيش بيانات في الفلتر ده." />}
      </div>
    </div>
  );
}

function SubjectsPanel({ subjects }: { subjects: any[] }) {
  return (
    <div className="subject-grid">
      {subjects.map((subject) => (
        <article key={subject.id} className="subject-card">
          <div className="subject-top">
            <div className="subject-logo" style={{ background: `${subject.color || "#269cb1"}20`, color: subject.color || "#269cb1" }}>
              <BookOpen size={21} />
            </div>
            <MoreHorizontal size={18} />
          </div>
          <span className="subject-code">{subject.code || "SUBJECT"}</span>
          <h3>{subject.name}</h3>
          <p>{subject.instructor || "المدرس غير محدد"}</p>
          <div className="subject-footer">
            <span>{subject.credits || 0} ساعات</span>
            <div className="subject-progress"><span style={{ width: `${Math.min(100, ((subject.credits || 2) / 4) * 100)}%`, background: subject.color || "#269cb1" }} /></div>
          </div>
        </article>
      ))}
      {subjects.length === 0 && <Empty text="مفيش مواد مضافة حالياً." />}
    </div>
  );
}

function InquiryPanel() {
  const [form, setForm] = useState({ name: "", phone: "", category: "أكاديمي", message: "" });
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim() || !form.message.trim()) {
      setError("املأ البيانات المطلوبة الأول.");
      return;
    }
    setSending(true);
    setError("");
    try {
      const supabase = createClient();
      const { error: insertError } = await supabase.from("inquiries").insert([{
        full_name: form.name.trim(),
        whatsapp_number: form.phone.trim(),
        category: form.category,
        message: form.message.trim(),
        status: "new",
      }]);
      if (insertError) throw insertError;
      setDone(true);
      setForm({ name: "", phone: "", category: "أكاديمي", message: "" });
    } catch {
      setError("حصلت مشكلة أثناء الإرسال. جرّب تاني بعد لحظة.");
    } finally {
      setSending(false);
    }
  };

  if (done) {
    return (
      <div className="success-card">
        <div className="success-icon"><CheckCircle2 size={28} /></div>
        <h2>وصل الاستفسار ✅</h2>
        <p>الإدارة هتشوفه وتقدر تتواصل معاك على الواتساب.</p>
        <button onClick={() => setDone(false)} className="primary-cta">إرسال استفسار جديد</button>
      </div>
    );
  }

  return (
    <div className="form-shell">
      <div className="form-intro">
        <div className="form-icon"><MessageSquarePlus size={22} /></div>
        <div>
          <strong>قول لنا محتاج إيه</strong>
          <span>من غير تسجيل دخول — ابعت المشكلة أو الاستفسار مباشرة.</span>
        </div>
      </div>

      {error && <div className="form-error">{error}</div>}
      <form onSubmit={submit} className="inquiry-grid">
        <label>
          <span>الاسم الكامل</span>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="مثال: أحمد محمد" />
        </label>
        <label>
          <span>واتساب</span>
          <input dir="ltr" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="01012345678" />
        </label>
        <label className="wide">
          <span>نوع الاستفسار</span>
          <div className="category-row">
            {["أكاديمي", "جدول", "تكليف", "عام"].map((cat) => (
              <button type="button" key={cat} onClick={() => setForm({ ...form, category: cat })} className={form.category === cat ? "selected" : ""}>{cat}</button>
            ))}
          </div>
        </label>
        <label className="wide">
          <span>الرسالة</span>
          <textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} rows={6} placeholder="اكتب تفاصيل الاستفسار..." />
        </label>
        <button disabled={sending} className="primary-cta wide submit-btn">
          <Send size={16} /> {sending ? "جاري الإرسال..." : "إرسال الاستفسار"}
        </button>
      </form>
    </div>
  );
}

function LinksPanel({ links }: { links: any[] }) {
  return (
    <div className="link-grid">
      {links.map((link) => (
        <a key={link.id} href={link.url} target="_blank" rel="noreferrer" className="resource-card">
          <div className="resource-icon"><ExternalLink size={18} /></div>
          <div>
            <strong>{link.title}</strong>
            <span>{link.category || link.type || "رابط سريع"}</span>
          </div>
          <ChevronLeft size={17} />
        </a>
      ))}
      {links.length === 0 && <Empty text="مفيش روابط مضافة حالياً." />}
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, note, tone }: any) {
  return (
    <div className={`metric-card ${tone}`}>
      <div className="metric-icon"><Icon size={18} /></div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{note}</small>
      </div>
    </div>
  );
}

function PanelHeader({ title, subtitle, icon: Icon, action }: any) {
  return (
    <div className="panel-header">
      <div className="panel-heading">
        <div className="panel-icon"><Icon size={16} /></div>
        <div>
          <strong>{title}</strong>
          <span>{subtitle}</span>
        </div>
      </div>
      {action && <button onClick={action} className="text-action">عرض الكل <ChevronLeft size={15} /></button>}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="empty-box"><FileText size={22} /><span>{text}</span></div>;
}

function DashboardSkeleton() {
  return (
    <div className="skeleton-page">
      <div className="skeleton skeleton-hero" />
      <div className="skeleton-grid">{[1, 2, 3, 4].map((x) => <div className="skeleton" key={x} />)}</div>
      <div className="skeleton-row"><div className="skeleton large" /><div className="skeleton" /></div>
    </div>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("ar-EG", { day: "numeric", month: "short" });
}

function formatTime(value: string) {
  return value?.slice(0, 5) || "—";
}

function formatDeadline(value: string) {
  return new Date(value).toLocaleDateString("ar-EG", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function labelForType(type: string) {
  return ({ lecture: "محاضرة", lab: "معمل", tutorial: "سكشن", exam: "امتحان" } as any)[type] || type || "جلسة";
}

function labelForDate(type: string) {
  return ({ exam: "امتحان", deadline: "موعد تسليم", holiday: "إجازة", registration: "تسجيل", event: "فعالية" } as any)[type] || "موعد مهم";
}

function MegaphoneIcon() {
  return <span style={{ fontSize: 15 }}>📣</span>;
}
