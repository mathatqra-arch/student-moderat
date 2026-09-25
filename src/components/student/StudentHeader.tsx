"use client";

import { Bell, Sparkles } from "lucide-react";
import { useState } from "react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export default function StudentHeader() {
  const [notificationStatus, setNotificationStatus] = useState<string | null>(null);

  const requestNotificationPermission = async () => {
    if (!("Notification" in window)) {
      alert("متصفحك لا يدعم الإشعارات الفورية.");
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      setNotificationStatus("تم تفعيل الإشعارات بنجاح! 🔔");
      setTimeout(() => setNotificationStatus(null), 3000);
    } else {
      alert("تم رفض تفعيل الإشعارات.");
    }
  };

  return (
    <header className="sticky top-0 z-30 glass-panel border-b border-[rgb(var(--border))] px-4 py-3">
      <div className="max-w-md mx-auto flex items-center justify-between gap-2">
        {/* Logo & Title */}
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-brand-500/20 text-white font-bold text-lg">
            د
          </div>
          <div>
            <h1 className="font-bold text-base leading-tight">منصة الدفعة</h1>
            <p className="text-[11px] text-brand-500 flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              المستجدات والتكليفات
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={requestNotificationPermission}
            title="تفعيل الإشعارات"
            className="relative p-2.5 rounded-xl bg-[rgb(var(--surface-subtle))] hover:bg-[rgb(var(--surface-muted))] transition border border-[rgb(var(--border))]"
          >
            <Bell className="w-4 h-4 text-brand-500" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-brand-500 rounded-full animate-ping" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-brand-500 rounded-full" />
          </button>
          <ThemeToggle />
        </div>
      </div>

      {notificationStatus && (
        <div className="max-w-md mx-auto mt-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 text-xs px-3 py-1.5 rounded-lg text-center animate-fade-in">
          {notificationStatus}
        </div>
      )}
    </header>
  );
}
