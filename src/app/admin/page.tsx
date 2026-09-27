"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  Bell,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  FileKey2,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  MoreHorizontal,
  RefreshCw,
  Server,
  Settings2,
  Shield,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import InquiriesManager from "@/components/admin/InquiriesManager";
import ContentManager from "@/components/admin/ContentManager";
import TeamManager from "@/components/admin/TeamManager";
import ApiKeyManager from "@/components/admin/ApiKeyManager";
import ScheduleManager from "@/components/admin/ScheduleManager";
import McpPage from "@/app/admin/mcp/page";

type TabId = "dashboard" | "inquiries" | "content" | "schedule" | "team" | "keys" | "mcp";
type Stats = { announcements: number; tasks: number; inquiries: number; subjects: number; schedules: number; pending: number };

const TABS: { id: TabId; label: string; icon: any }[] = [
  { id: "dashboard", label: "الرئيسية", icon: LayoutDashboard },
  { id: "inquiries", label: "الاستفسارات", icon: MessageSquare },
  { id: "content", label: "المحتوى", icon: FileText },
  { id: "schedule", label: "الجدول والمواد", icon: CalendarDays },
  { id: "team", label: "الفريق", icon: Users },
  { id: "keys", label: "مفاتيح API", icon: FileKey2 },
  { id: "mcp", label: "MCP", icon: Server },
];

const EMPTY_STATS: Stats = { announcements: 0, tasks: 0, inquiries: 0, subjects: 0, schedules: 0, pending: 0 };

export default function AdminDashboardPage() {
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const [loading, setLoading] = useState(false);
  const [recentAnnouncements, setRecentAnnouncements] = useState<any[]>([]);

  const loadStats = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const [ann, tasks, inquiries, subjects, schedules, pending, recent] = await Promise.all([
      supabase.from("announcements").select("id", { count: "exact", head: true }),
      supabase.from("tasks").select("id", { count: "exact", head: true }),
      supabase.from("inquiries").select("id", { count: "exact", head: true }),
      supabase.from("subjects").select("id", { count: "exact", head: true }),
      supabase.from("schedules").select("id", { count: "exact", head: true }).eq("is_active", true),
      supabase.from("inquiries").select("id", { count: "exact", head: true }).eq("status", "new"),
      supabase.from("announcements").select("title,category,created_at,is_pinned").order("created_at", { ascending: false }).limit(4),
    ]);
    setStats({
      announcements: ann.count || 0,
      tasks: tasks.count || 0,
      inquiries: inquiries.count || 0,
      subjects: subjects.count || 0,
      schedules: schedules.count || 0,
      pending: pending.count || 0,
    });
    setRecentAnnouncements(recent.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { void loadStats(); }, [loadStats]);

  const activeLabel = useMemo(() => TABS.find((x) => x.id === activeTab)?.label || "الرئيسية", [activeTab]);
  const go = (tab: TabId) => { setActiveTab(tab); setMobileOpen(false); };

  return (
    <div className="admin-app">
      <div className="ambient ambient-one" /><div className="ambient ambient-two" />
      <header className="admin-topbar">
        <div className="admin-topbar-inner">
          <div className="brand-lockup">
            <div className="brand-icon"><img src="/icons/icon-192.png" alt="شعار منصة الدفعة" /></div>
            <div className="brand-copy"><strong>إدارة منصة الدفعة</strong><span>مركز التحكم والمحتوى والمستخدمين</span></div>
          </div>
          <div className="admin-top-actions">
            <div className="admin-status"><span /> النظام متصل</div>
            <button className="icon-action admin-mobile-menu" onClick={() => setMobileOpen((v) => !v)} aria-label="القائمة">{mobileOpen ? <X size={19} /> : <Menu size={19} />}</button>
            <ThemeToggle className="!w-10 !h-10 !rounded-2xl" />
            <Link href="/student" target="_blank" className="admin-preview-btn"><ExternalLink size={15} /> معاينة الطلاب</Link>
            <Link href="/admin/login" className="icon-action" title="تسجيل الخروج"><LogOut size={17} /></Link>
          </div>
        </div>
      </header>

      <div className="admin-layout">
        <aside className={`admin-sidebar ${mobileOpen ? "open" : ""}`}>
          <div className="admin-profile">
            <div className="admin-avatar"><Shield size={21} /></div>
            <div><span>وضع الإشراف</span><strong>لوحة الإدارة</strong><small>تحكم مباشر بالمنصة</small></div>
          </div>
          <nav className="admin-nav">
            {TABS.map((tab) => { const Icon = tab.icon; return (
              <button key={tab.id} className={activeTab === tab.id ? "active" : ""} onClick={() => go(tab.id)}>
                <span className="admin-nav-icon"><Icon size={17} /></span><span>{tab.label}</span>
                {tab.id === "inquiries" && stats.pending > 0 && <b>{stats.pending}</b>}
              </button>
            ); })}
          </nav>
          <div className="admin-side-note"><Sparkles size={15} /><div><strong>نصيحة</strong><p>بعد أي تعديل مهم، راجع معاينة الطلاب للتأكد من الشكل والمحتوى.</p></div></div>
          <button className="admin-refresh" onClick={() => void loadStats()} disabled={loading}><RefreshCw size={15} className={loading ? "spin" : ""} /> تحديث سريع</button>
        </aside>

        <main className="admin-main">
          <div className="admin-page-heading">
            <div><span>مركز الإدارة</span><h1>{activeLabel}</h1></div>
            <div className="admin-breadcrumb"><Settings2 size={14} /> إدارة المنصة <ArrowLeft size={12} /> {activeLabel}</div>
          </div>
          <div className="tab-fade">
            {activeTab === "dashboard" && <AdminOverview stats={stats} recent={recentAnnouncements} onNavigate={go} />}
            {activeTab === "inquiries" && <InquiriesManager />}
            {activeTab === "content" && <ContentManager />}
            {activeTab === "schedule" && <ScheduleManager />}
            {activeTab === "team" && <TeamManager />}
            {activeTab === "keys" && <ApiKeyManager />}
            {activeTab === "mcp" && <McpPage />}
          </div>
        </main>
      </div>

      <div className="admin-mobile-nav">
        {TABS.slice(0, 5).map((tab) => { const Icon = tab.icon; return <button key={tab.id} onClick={() => go(tab.id)} className={activeTab === tab.id ? "active" : ""}><Icon size={17} /><span>{tab.id === "schedule" ? "الجدول" : tab.id === "dashboard" ? "الرئيسية" : tab.label}</span></button>; })}
      </div>
    </div>
  );
}

function AdminOverview({ stats, recent, onNavigate }: { stats: Stats; recent: any[]; onNavigate: (tab: TabId) => void }) {
  const cards = [
    { label: "الإعلانات", value: stats.announcements, note: "منشورة حالياً", icon: Bell, tone: "blue" },
    { label: "التكليفات", value: stats.tasks, note: "في النظام", icon: CheckCircle2, tone: "purple" },
    { label: "الاستفسارات", value: stats.inquiries, note: `${stats.pending} جديدة`, icon: MessageSquare, tone: "orange" },
    { label: "المواد", value: stats.subjects, note: `${stats.schedules} جلسة فعالة`, icon: BookOpen, tone: "teal" },
  ];
  return (
    <div className="admin-overview">
      <section className="admin-hero">
        <div><span className="admin-hero-kicker"><Activity size={14} /> مركز العمليات</span><h2>إدارة يومك من شاشة واحدة.</h2><p>تابع حركة المحتوى، الاستفسارات، والجدول الدراسي، وشغّل أدوات MCP عند الحاجة.</p><div className="admin-hero-actions"><button className="admin-primary" onClick={() => onNavigate("content")}>إدارة المحتوى <ArrowLeft size={15} /></button><button className="admin-secondary" onClick={() => onNavigate("mcp")}>فتح MCP</button></div></div>
        <div className="admin-hero-art"><div className="admin-hero-orb"><Server size={35} /></div><span>Live control</span></div>
      </section>
      <section className="admin-stat-grid">
        {cards.map((card) => { const Icon = card.icon; return <div key={card.label} className={`admin-stat-card ${card.tone}`}><div className="admin-stat-icon"><Icon size={18} /></div><div><span>{card.label}</span><strong>{card.value}</strong><small>{card.note}</small></div></div>; })}
      </section>
      <div className="admin-content-grid">
        <section className="admin-panel">
          <div className="admin-panel-head"><div><strong>آخر الإعلانات</strong><span>آخر ما يظهر للطلاب</span></div><button onClick={() => onNavigate("content")}>إدارة <MoreHorizontal size={15} /></button></div>
          <div className="admin-ann-list">
            {recent.length === 0 ? <div className="empty-box"><FileText size={22} />لا توجد إعلانات بعد.</div> : recent.map((item) => (
              <article key={`${item.title}-${item.created_at}`}><div className="admin-ann-dot"><Bell size={14} /></div><div><div className="row-between"><span className="soft-badge blue">{item.category || "عام"}</span><time>{new Date(item.created_at).toLocaleDateString("ar-EG", { day: "numeric", month: "short" })}</time></div><strong>{item.title}</strong></div></article>
            ))}
          </div>
        </section>
        <section className="admin-panel admin-quick-panel">
          <div className="admin-panel-head"><div><strong>إجراءات سريعة</strong><span>أكثر المهام استخداماً</span></div></div>
          <div className="admin-quick-grid">
            <button onClick={() => onNavigate("inquiries")}><MessageSquare size={17} /><span>الاستفسارات</span></button>
            <button onClick={() => onNavigate("schedule")}><CalendarDays size={17} /><span>الجدول والمواد</span></button>
            <button onClick={() => onNavigate("team")}><Users size={17} /><span>الفريق</span></button>
            <button onClick={() => onNavigate("keys")}><FileKey2 size={17} /><span>مفاتيح API</span></button>
          </div>
        </section>
      </div>
    </div>
  );
}
