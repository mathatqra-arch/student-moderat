"use client";

import { Bell, Sparkles } from "lucide-react";
import { useState } from "react";

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
    <header className="sticky top-0 z-30 glass-panel border-b border-gray-800 px-4 py-3">
      <div className="max-w-md mx-auto flex items-center justify-between">
        {/* Logo & Title */}
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20 text-white font-bold text-lg">
            د
          </div>
          <div>
            <h1 className="font-bold text-white text-base leading-tight">منصة الدفعة الأكاديمية</h1>
            <p className="text-xs text-blue-400 flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              المستجدات والتكليفات المباشرة
            </p>
          </div>
        </div>

        {/* Notifications Button */}
        <button
          onClick={requestNotificationPermission}
          title="تفعيل الإشعارات"
          className="relative p-2.5 rounded-xl bg-gray-800/80 hover:bg-gray-700 text-gray-300 hover:text-white transition border border-gray-700/50"
        >
          <Bell className="w-5 h-5 text-blue-400" />
          <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-blue-500 rounded-full animate-ping" />
          <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-blue-500 rounded-full" />
        </button>
      </div>

      {notificationStatus && (
        <div className="max-w-md mx-auto mt-2 bg-emerald-950/80 border border-emerald-500/30 text-emerald-300 text-xs px-3 py-1.5 rounded-lg text-center animate-fade-in">
          {notificationStatus}
        </div>
      )}
    </header>
  );
}
