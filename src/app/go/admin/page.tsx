"use client";

import { useEffect, useState } from "react";
import {
  Shield,
  MessageSquare,
  FileText,
  Users,
  Key,
  LogOut,
  ExternalLink,
  Calendar,
  Link2,
  Loader2,
  ShieldAlert,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { hasPermission, PermissionMap } from "@/lib/permissions";

// ==========================================
// التابات بتتحمّل lazy — كل مدير في chunk منفصل يتنزّل لما تابه يفتح
// بدل تحميل 7 مكوّنات (2700+ سطر) مرة واحدة مع أول فتح
// ==========================================
function ManagerSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true">
      <div className="skeleton h-20" />
      <div className="skeleton h-32" />
    </div>
  );
}

const InquiriesManager = dynamic(() => import("@/components/admin/InquiriesManager"), {
  ssr: false,
  loading: () => <ManagerSkeleton />,
});
const ContentManager = dynamic(() => import("@/components/admin/ContentManager"), {
  ssr: false,
  loading: () => <ManagerSkeleton />,
});
const TeamManager = dynamic(() => import("@/components/admin/TeamManager"), {
  ssr: false,
  loading: () => <ManagerSkeleton />,
});
const ApiKeyManager = dynamic(() => import("@/components/admin/ApiKeyManager"), {
  ssr: false,
  loading: () => <ManagerSkeleton />,
});
const ScheduleManager = dynamic(() => import("@/components/admin/ScheduleManager"), {
  ssr: false,
  loading: () => <ManagerSkeleton />,
});
const QuickLinksManager = dynamic(() => import("@/components/admin/QuickLinksManager"), {
  ssr: false,
  loading: () => <ManagerSkeleton />,
});
const SelfPasswordModal = dynamic(() => import("@/components/admin/SelfPasswordModal"), {
  ssr: false,
});

type TabId = "inquiries" | "content" | "schedules" | "links" | "team" | "keys";

interface TabConfig {
  id: TabId;
  label: string;
  shortLabel: string;
  icon: typeof MessageSquare;
  color: string;
  /** الموارد اللي بتحدد ظهور التاب — التاب يظهر لو أي مورد منهم عليه view */
  resources: string[];
}

const TABS: TabConfig[] = [
  { id: "inquiries", label: "الاستفسارات", shortLabel: "استفسارات", icon: MessageSquare, color: "bg-coral", resources: ["inquiries"] },
  { id: "content", label: "الإعلانات والتكليفات", shortLabel: "محتوى", icon: FileText, color: "bg-blue", resources: ["announcements", "tasks"] },
  { id: "schedules", label: "الجداول والمواد", shortLabel: "جداول", icon: Calendar, color: "bg-green", resources: ["schedules", "subjects", "important_dates"] },
  { id: "links", label: "الروابط السريعة", shortLabel: "روابط", icon: Link2, color: "bg-teal", resources: ["links"] },
  { id: "keys", label: "مفاتيح API", shortLabel: "مفاتيح", icon: Key, color: "bg-purple-soft", resources: ["api_keys"] },
  { id: "team", label: "الفريق والصلاحيات", shortLabel: "فريق", icon: Users, color: "bg-yellow", resources: ["team"] },
];

interface MeInfo {
  id: string;
  name?: string | null;
  role: string;
  permissions: PermissionMap;
}

export default function AdminDashboardPage() {
  const [activeTab, setActiveTab] = useState<TabId>("inquiries");
  const [me, setMe] = useState<MeInfo | null>(null);
  const [meLoading, setMeLoading] = useState(true);
  const [meError, setMeError] = useState<string | null>(null);
  // تغيير كلمة المرور الذاتي — متاح لأي عضو مسجل دخول بدون صلاحيات
  const [showSelfPasswordModal, setShowSelfPasswordModal] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/admin/me");
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "فشل تحميل الصلاحيات");
        if (mounted) setMe(data);
      } catch (err: any) {
        if (mounted) setMeError(err?.message || "فشل تحميل الصلاحيات");
      } finally {
        if (mounted) setMeLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // هل التاب ظاهر للمستخدم الحالي؟ (الأدمن الرئيسي والليدر يشوفوا كل شيء)
  const tabVisible = (id: TabId): boolean => {
    if (!me) return false;
    if (me.role === "leader" || me.role === "super_admin") return true;
    const config = TABS.find((t) => t.id === id);
    if (!config) return false;
    return config.resources.some((res) => hasPermission(me.permissions, res, "view", me.role));
  };

  const visibleTabs = TABS.filter((t) => tabVisible(t.id));

  // لو التاب النشط اتشال (بعد تحميل الصلاحيات) → رجّع لأول تاب متاح
  useEffect(() => {
    if (!meLoading && me && visibleTabs.length > 0) {
      setActiveTab((current) =>
        visibleTabs.some((t) => t.id === current) ? current : visibleTabs[0].id
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meLoading, me]);

  const activeTabConfig = TABS.find((t) => t.id === activeTab);

  // شاشة تحميل الصلاحيات — ممنوع نعرض أي تاب قبل معرفة صلاحيات المستخدم
  if (meLoading) {
    return (
      <div className="min-h-screen bg-cream text-ink flex items-center justify-center">
        <div className="flex items-center gap-2 text-sm font-bold text-gray">
          <Loader2 className="w-5 h-5 animate-spin" />
          جاري تحميل لوحة التحكم...
        </div>
      </div>
    );
  }

  // خطأ في جلب الصلاحيات أو مستخدم بدون أي صلاحيات
  if (meError || !me || visibleTabs.length === 0) {
    return (
      <div className="min-h-screen bg-cream text-ink flex items-center justify-center p-4">
        <div className="brutal-card bg-cream-light p-8 max-w-sm w-full text-center space-y-4">
          <div className="w-14 h-14 rounded-xl border-2 border-ink bg-coral flex items-center justify-center mx-auto">
            <ShieldAlert className="w-7 h-7 text-cream-light" />
          </div>
          <h1 className="font-extrabold text-lg">مش مسموح لك بالدخول</h1>
          <p className="text-xs text-gray leading-relaxed">
            {meError
              ? "حصلت مشكلة في التحقق من صلاحياتك. تأكد من اتصالك وحاول تاني."
              : "حسابك معندوش أي صلاحيات على لوحة التحكم. كلم الليدر المسؤول يمنحك الصلاحيات المناسبة."}
          </p>
          <Link
            href="/go/admin/login"
            className="block w-full py-2.5 px-3 text-xs font-bold border-2 border-ink rounded-md bg-yellow hover:bg-coral hover:text-cream-light transition"
          >
            رجوع لتسجيل الدخول
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream text-ink relative overflow-x-clip">
      {/* Decorative blob */}
      <div className="blob-yellow" style={{ top: "-80px", left: "10%", width: "400px", height: "400px" }} />

      <div className="flex relative z-10">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex flex-col w-64 min-h-screen sticky top-0 h-screen border-l-2 border-ink bg-cream-light">
          <div className="p-5 space-y-5 flex flex-col h-full">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl border-2 border-ink bg-yellow shadow-brutal-sm flex items-center justify-center">
                <Shield className="w-5 h-5 text-ink" />
              </div>
              <div>
                <h1 className="font-extrabold text-base tracking-tight text-ink">لوحة الأدمن</h1>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="w-2 h-2 rounded-full bg-green border border-ink" />
                  <span className="text-2xs font-bold text-gray truncate max-w-[130px]">
                    {me.name || (me.role === "super_admin" ? "الأدمن الرئيسي" : me.role === "leader" ? "ليدر" : "مشرف مساعد")}
                  </span>
                </div>
              </div>
            </div>

            {/* Nav — التابات حسب صلاحيات المستخدم فقط */}
            <nav className="space-y-1.5 flex-1">
              {visibleTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`brutal-nav-item ${isActive ? "active" : ""}`}
                  >
                    <div className={`w-7 h-7 rounded-lg border-2 border-ink ${tab.color} flex items-center justify-center flex-shrink-0`}>
                      <Icon className="w-3.5 h-3.5 text-ink" />
                    </div>
                    <span className="text-sm font-bold">{tab.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* Actions */}
            <div className="space-y-2 pt-4 border-t-2 border-ink">
              <button
                onClick={() => setShowSelfPasswordModal(true)}
                className="brutal-btn-ghost w-full py-2.5 px-3 flex items-center justify-center gap-2 text-xs"
              >
                <Key className="w-3.5 h-3.5" />
                <span>تغيير كلمة المرور</span>
              </button>
              <Link
                href="/student"
                target="_blank"
                className="brutal-btn-ghost w-full py-2.5 px-3 flex items-center justify-center gap-2 text-xs"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>معاينة الطلاب</span>
              </Link>
              <Link
                href="/go/admin/login"
                className="w-full py-2.5 px-3 flex items-center justify-center gap-2 text-xs font-bold border-2 border-ink rounded-md text-coral hover:bg-coral hover:text-cream-light transition"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>تسجيل الخروج</span>
              </Link>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-h-screen min-w-0">
          {/* Mobile Header */}
          <header className="lg:hidden sticky top-0 z-30 bg-cream-light border-b-2 border-ink px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg border-2 border-ink bg-yellow shadow-brutal-sm flex items-center justify-center">
                <Shield className="w-4 h-4 text-ink" />
              </div>
              <h1 className="font-extrabold text-sm text-ink">لوحة الأدمن</h1>
              {me.name && (
                <span className="text-2xs font-bold text-gray mr-auto truncate max-w-[120px]">{me.name}</span>
              )}
              <button
                onClick={() => setShowSelfPasswordModal(true)}
                title="تغيير كلمة المرور"
                className={`p-1.5 rounded-lg border-2 border-ink bg-yellow shadow-brutal-sm flex-shrink-0 ${me.name ? "" : "mr-auto"}`}
              >
                <Key className="w-4 h-4 text-ink" />
              </button>
            </div>
          </header>

          {/* Content */}
          <main className="flex-1 p-4 lg:p-8 pb-28 lg:pb-8">
            <div className="max-w-5xl mx-auto">
              {/* Desktop section header */}
              <div className="hidden lg:flex items-center gap-3 mb-6">
                <div className={`w-10 h-10 rounded-xl border-2 border-ink ${activeTabConfig?.color || "bg-yellow"} flex items-center justify-center shadow-brutal-sm`}>
                  {(() => {
                    const Icon = activeTabConfig?.icon || Shield;
                    return <Icon className="w-5 h-5 text-ink" />;
                  })()}
                </div>
                <h2 className="text-xl font-extrabold tracking-tight text-ink">
                  {activeTabConfig?.label}
                </h2>
              </div>

              {/* Mobile section header */}
              <div className="lg:hidden mb-4">
                <h2 className="text-lg font-extrabold tracking-tight text-ink">
                  {activeTabConfig?.shortLabel}
                </h2>
              </div>

              {/* Tab content — بيتعرض فقط لو التاب مسموح لصلاحيات المستخدم */}
              <div key={activeTab} className="tab-content">
                {activeTab === "inquiries" && tabVisible("inquiries") && <InquiriesManager />}
                {activeTab === "content" && tabVisible("content") && <ContentManager />}
                {activeTab === "schedules" && tabVisible("schedules") && <ScheduleManager />}
                {activeTab === "links" && tabVisible("links") && <QuickLinksManager />}
                {activeTab === "keys" && tabVisible("keys") && <ApiKeyManager />}
                {activeTab === "team" && tabVisible("team") && <TeamManager />}
              </div>
            </div>
          </main>
        </div>
      </div>

      {/* Mobile bottom nav — عدد أعمدة ديناميكي حسب التابات المتاحة */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-cream-light border-t-2 border-ink">
        <div
          className="grid gap-1 p-2"
          style={{ gridTemplateColumns: `repeat(${Math.max(visibleTabs.length, 1)}, minmax(0, 1fr))` }}
        >
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center justify-center py-2.5 px-1 rounded-lg border-2 transition ${
                  isActive
                    ? "border-ink bg-yellow shadow-brutal-sm"
                    : "border-transparent text-gray"
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? "text-ink" : ""}`} />
                <span className={`text-2xs mt-1 font-bold ${isActive ? "text-ink" : "text-gray"}`}>{tab.shortLabel}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* مودال تغيير كلمة المرور الذاتي — لكل الأعضاء */}
      {showSelfPasswordModal && (
        <SelfPasswordModal onClose={() => setShowSelfPasswordModal(false)} />
      )}
    </div>
  );
}
