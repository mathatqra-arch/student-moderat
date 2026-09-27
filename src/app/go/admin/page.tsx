"use client";

import { useState } from "react";
import {
  Shield,
  MessageSquare,
  FileText,
  Users,
  Key,
  LogOut,
  ExternalLink,
  Calendar,
} from "lucide-react";
import InquiriesManager from "@/components/admin/InquiriesManager";
import ContentManager from "@/components/admin/ContentManager";
import TeamManager from "@/components/admin/TeamManager";
import ApiKeyManager from "@/components/admin/ApiKeyManager";
import ScheduleManager from "@/components/admin/ScheduleManager";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import Link from "next/link";

type TabId = "inquiries" | "content" | "schedules" | "team" | "keys";

interface TabConfig {
  id: TabId;
  label: string;
  shortLabel: string;
  icon: typeof MessageSquare;
}

const TABS: TabConfig[] = [
  { id: "inquiries", label: "الاستفسارات", shortLabel: "الاستفسارات", icon: MessageSquare },
  { id: "content", label: "الإعلانات والتكليفات", shortLabel: "المحتوى", icon: FileText },
  { id: "schedules", label: "الجداول والمواد", shortLabel: "الجداول", icon: Calendar },
  { id: "keys", label: "مفاتيح API", shortLabel: "المفاتيح", icon: Key },
  { id: "team", label: "الفريق والصلاحيات", shortLabel: "الفريق", icon: Users },
];

export default function AdminDashboardPage() {
  const [activeTab, setActiveTab] = useState<TabId>("inquiries");

  return (
    <div className="min-h-screen bg-[rgb(var(--bg))] text-[rgb(var(--text))] pb-12">
      <header className="sticky top-0 z-30 glass-panel border-b border-[rgb(var(--border))] px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-brand text-white flex items-center justify-center font-bold shadow-lg shadow-brand-500/10">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-extrabold text-base">لوحة تحكم إدارة الدفعة</h1>
              <div className="flex items-center gap-1.5 text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-emerald-500 font-medium">وضع الإشراف النشط</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link
              href="/student"
              target="_blank"
              className="px-3 py-1.5 rounded-xl bg-[rgb(var(--surface-subtle))] hover:bg-[rgb(var(--surface-muted))] text-xs flex items-center gap-1.5 transition border border-[rgb(var(--border))]"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">معاينة الطلاب</span>
            </Link>
            <Link
              href="/go/admin/login"
              className="p-2 rounded-xl bg-[rgb(var(--surface-subtle))] hover:bg-rose-500/15 text-[rgb(var(--text-muted))] hover:text-rose-500 transition border border-[rgb(var(--border))]"
              title="تسجيل الخروج"
            >
              <LogOut className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
        <div className="flex items-center gap-1.5 bg-[rgb(var(--surface))] p-1.5 rounded-2xl border border-[rgb(var(--border))] overflow-x-auto no-scrollbar shadow-sm">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 min-w-[110px] py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                  isActive
                    ? "gradient-brand text-white shadow-lg shadow-brand-600/25"
                    : "text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text))] hover:bg-[rgb(var(--surface-subtle))]"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.shortLabel}</span>
              </button>
            );
          })}
        </div>

        <div key={activeTab} className="tab-content">
          {activeTab === "inquiries" && <InquiriesManager />}
          {activeTab === "content" && <ContentManager />}
          {activeTab === "schedules" && <ScheduleManager />}
          {activeTab === "keys" && <ApiKeyManager />}
          {activeTab === "team" && <TeamManager />}
        </div>
      </main>
    </div>
  );
}
