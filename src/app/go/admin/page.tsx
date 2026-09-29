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
  Link2,
} from "lucide-react";
import InquiriesManager from "@/components/admin/InquiriesManager";
import ContentManager from "@/components/admin/ContentManager";
import TeamManager from "@/components/admin/TeamManager";
import ApiKeyManager from "@/components/admin/ApiKeyManager";
import ScheduleManager from "@/components/admin/ScheduleManager";
import QuickLinksManager from "@/components/admin/QuickLinksManager";
import Link from "next/link";

type TabId = "inquiries" | "content" | "schedules" | "links" | "team" | "keys";

interface TabConfig {
  id: TabId;
  label: string;
  shortLabel: string;
  icon: typeof MessageSquare;
  color: string;
}

const TABS: TabConfig[] = [
  { id: "inquiries", label: "الاستفسارات", shortLabel: "استفسارات", icon: MessageSquare, color: "bg-coral" },
  { id: "content", label: "الإعلانات والتكليفات", shortLabel: "محتوى", icon: FileText, color: "bg-blue" },
  { id: "schedules", label: "الجداول والمواد", shortLabel: "جداول", icon: Calendar, color: "bg-green" },
  { id: "links", label: "الروابط السريعة", shortLabel: "روابط", icon: Link2, color: "bg-teal" },
  { id: "keys", label: "مفاتيح API", shortLabel: "مفاتيح", icon: Key, color: "bg-purple-soft" },
  { id: "team", label: "الفريق والصلاحيات", shortLabel: "فريق", icon: Users, color: "bg-yellow" },
];

export default function AdminDashboardPage() {
  const [activeTab, setActiveTab] = useState<TabId>("inquiries");

  const activeTabConfig = TABS.find((t) => t.id === activeTab);

  return (
    <div className="min-h-screen bg-cream text-ink relative overflow-hidden">
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
                  <span className="text-2xs font-bold text-gray">إشراف نشط</span>
                </div>
              </div>
            </div>

            {/* Nav */}
            <nav className="space-y-1.5 flex-1">
              {TABS.map((tab) => {
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
        <div className="flex-1 flex flex-col min-h-screen">
          {/* Mobile Header */}
          <header className="lg:hidden sticky top-0 z-30 bg-cream-light border-b-2 border-ink px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg border-2 border-ink bg-yellow shadow-brutal-sm flex items-center justify-center">
                <Shield className="w-4 h-4 text-ink" />
              </div>
              <h1 className="font-extrabold text-sm text-ink">لوحة الأدمن</h1>
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

              {/* Tab content */}
              <div key={activeTab} className="tab-content">
                {activeTab === "inquiries" && <InquiriesManager />}
                {activeTab === "content" && <ContentManager />}
                {activeTab === "schedules" && <ScheduleManager />}
                {activeTab === "links" && <QuickLinksManager />}
                {activeTab === "keys" && <ApiKeyManager />}
                {activeTab === "team" && <TeamManager />}
              </div>
            </div>
          </main>
        </div>
      </div>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-cream-light border-t-2 border-ink">
        <div className="grid grid-cols-5 gap-1 p-2">
          {TABS.map((tab) => {
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
    </div>
  );
}
