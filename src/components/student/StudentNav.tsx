"use client";

import { Megaphone, CheckSquare, MessageSquarePlus, Link2 } from "lucide-react";

type TabType = "announcements" | "tasks" | "inquiry" | "links";

interface StudentNavProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export default function StudentNav({ activeTab, onTabChange }: StudentNavProps) {
  const tabs = [
    { id: "announcements" as TabType, label: "الإعلانات", icon: Megaphone },
    { id: "tasks" as TabType, label: "التكليفات", icon: CheckSquare },
    { id: "inquiry" as TabType, label: "استفسار", icon: MessageSquarePlus },
    { id: "links" as TabType, label: "الروابط", icon: Link2 },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 glass-panel border-t border-[rgb(var(--border))] px-3 py-2">
      <div className="max-w-md mx-auto grid grid-cols-4 gap-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all ${
                isActive
                  ? "bg-brand-600/15 text-brand-500 font-semibold border border-brand-500/30"
                  : "text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text))] hover:bg-[rgb(var(--surface-subtle))]"
              }`}
            >
              <Icon className={`w-5 h-5 transition ${isActive ? "scale-110" : ""}`} />
              <span className="text-xs mt-1">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
