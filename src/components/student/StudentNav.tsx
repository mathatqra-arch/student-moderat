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
    <nav className="fixed bottom-0 left-0 right-0 z-30 glass-panel border-t border-gray-800 px-3 py-2">
      <div className="max-w-md mx-auto grid grid-cols-4 gap-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl transition ${
                isActive
                  ? "bg-blue-600/20 text-blue-400 font-semibold border border-blue-500/30"
                  : "text-gray-400 hover:text-gray-200 hover:bg-gray-800/40"
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? "text-blue-400 scale-110" : "text-gray-400"} transition`} />
              <span className="text-xs mt-1">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
