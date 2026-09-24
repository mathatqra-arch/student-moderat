"use client";

import { useState } from "react";
import Link from "next/link";
import { Shield, MessageSquare, FileText, Users, Key, LogOut, ExternalLink, Server } from "lucide-react";
import InquiriesManager from "@/components/admin/InquiriesManager";
import ContentManager from "@/components/admin/ContentManager";
import TeamManager from "@/components/admin/TeamManager";
import ApiKeyManager from "@/components/admin/ApiKeyManager";
import McpPage from "@/app/admin/mcp/page";

export default function AdminDashboardPage() {
  const [activeTab, setActiveTab] = useState<"inquiries" | "content" | "team" | "keys" | "mcp">("inquiries");

  return (
    <div className="min-h-screen bg-dark-bg text-gray-100 pb-12">
      {/* Admin Top Bar */}
      <header className="sticky top-0 z-30 glass-panel border-b border-gray-800 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-extrabold text-white text-base">لوحة تحكم إدارة الدفعة</h1>
              <span className="text-xs text-emerald-400 flex items-center gap-1 font-medium">
                ● وضع الإشراف النشط (Authenticated Admin)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/student"
              target="_blank"
              className="px-3 py-1.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-xs text-gray-300 flex items-center gap-1.5 transition border border-gray-700"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">معاينة واجهة الطلاب</span>
            </Link>

            <Link
              href="/admin/login"
              className="p-2 rounded-xl bg-gray-800/80 hover:bg-rose-900/40 text-gray-400 hover:text-rose-300 transition border border-gray-700"
              title="تسجيل الخروج"
            >
              <LogOut className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* Main Admin Content Container */}
      <main className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 bg-gray-900/80 p-1.5 rounded-2xl border border-gray-800 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab("inquiries")}
            className={`flex-1 min-w-[130px] py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition ${
              activeTab === "inquiries"
                ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                : "text-gray-400 hover:text-gray-200 hover:bg-gray-800/50"
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>الاستفسارات والطلبات</span>
          </button>

          <button
            onClick={() => setActiveTab("content")}
            className={`flex-1 min-w-[130px] py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition ${
              activeTab === "content"
                ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                : "text-gray-400 hover:text-gray-200 hover:bg-gray-800/50"
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>الإعلانات والتكليفات</span>
          </button>

          <button
            onClick={() => setActiveTab("keys")}
            className={`flex-1 min-w-[130px] py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition ${
              activeTab === "keys"
                ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                : "text-gray-400 hover:text-gray-200 hover:bg-gray-800/50"
            }`}
          >
            <Key className="w-4 h-4" />
            <span>مفاتيح API</span>
          </button>

          <button
            onClick={() => setActiveTab("mcp")}
            className={`flex-1 min-w-[130px] py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition ${
              activeTab === "mcp"
                ? "bg-purple-600 text-white shadow-lg shadow-purple-600/20"
                : "text-gray-400 hover:text-gray-200 hover:bg-gray-800/50"
            }`}
          >
            <Server className="w-4 h-4" />
            <span>خادم MCP</span>
          </button>

          <button
            onClick={() => setActiveTab("team")}
            className={`flex-1 min-w-[130px] py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition ${
              activeTab === "team"
                ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                : "text-gray-400 hover:text-gray-200 hover:bg-gray-800/50"
            }`}
          >
            <Users className="w-4 h-4" />
            <span>الفريق والصيانة</span>
          </button>
        </div>

        {/* Tab Views */}
        {activeTab === "inquiries" && <InquiriesManager />}
        {activeTab === "content" && <ContentManager />}
        {activeTab === "keys" && <ApiKeyManager />}
        {activeTab === "mcp" && <McpPage />}
        {activeTab === "team" && <TeamManager />}
      </main>
    </div>
  );
}
