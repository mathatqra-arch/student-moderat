"use client";

import { useEffect, useState } from "react";
import { Download, X, Bell, Smartphone } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
      return;
    }

    const dismissedBefore = localStorage.getItem("pwa-install-dismissed");
    if (dismissedBefore === "true") {
      setDismissed(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setTimeout(() => setShowPrompt(true), 3000);
    };

    window.addEventListener("beforeinstallprompt", handler);

    const installedHandler = () => {
      setIsInstalled(true);
      setShowPrompt(false);
    };
    window.addEventListener("appinstalled", installedHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setIsInstalled(true);
      setShowPrompt(false);
    } else {
      localStorage.setItem("pwa-install-dismissed", "true");
      setTimeout(() => localStorage.removeItem("pwa-install-dismissed"), 24 * 60 * 60 * 1000);
    }
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setDismissed(true);
    localStorage.setItem("pwa-install-dismissed", "true");
  };

  if (isInstalled || dismissed || !showPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 z-50 animate-slide-up">
      <div className="bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-2xl p-4 shadow-2xl backdrop-blur-lg">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-brand-600/30">
            <Smartphone className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-sm mb-1">ثبّت التطبيق على جهازك</h3>
            <p className="text-xs text-[rgb(var(--text-muted))] leading-relaxed mb-3">
              للحصول على تجربة أسرع وإشعارات فورية، ثبّت التطبيق على شاشتك الرئيسية.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleInstall}
                className="flex-1 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold py-2 rounded-lg transition flex items-center justify-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                تثبيت
              </button>
              <button
                onClick={handleDismiss}
                className="px-3 py-2 bg-[rgb(var(--surface-subtle))] hover:bg-[rgb(var(--surface-muted))] text-[rgb(var(--text-muted))] text-xs rounded-lg transition border border-[rgb(var(--border))]"
              >
                لاحقاً
              </button>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="p-1 rounded-lg text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text))] hover:bg-[rgb(var(--surface-subtle))] transition flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function NotificationsPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!("Notification" in window)) return;
    setPermission(Notification.permission);

    const dismissedBefore = localStorage.getItem("notifications-prompt-dismissed");
    if (dismissedBefore === "true") {
      setDismissed(true);
      return;
    }

    if (Notification.permission === "default") {
      const timer = setTimeout(() => setShowPrompt(true), 7000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleEnable = async () => {
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      setShowPrompt(false);

      if (result === "granted") {
        new Notification("تم تفعيل الإشعارات ✅", {
          body: "ستصلك تنبيهات الإعلانات والتكليفات الجديدة فوراً.",
          icon: "/icons/icon-192.png",
        });
      }
    } catch (err) {
      console.error("Failed to request notification permission:", err);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setDismissed(true);
    localStorage.setItem("notifications-prompt-dismissed", "true");
    setTimeout(() => localStorage.removeItem("notifications-prompt-dismissed"), 7 * 24 * 60 * 60 * 1000);
  };

  if (!showPrompt || permission !== "default" || dismissed) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 z-40 animate-slide-up" style={{ animationDelay: "200ms" }}>
      <div className="bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-2xl p-4 shadow-2xl backdrop-blur-lg">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-amber-600/30">
            <Bell className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-sm mb-1">فعّل الإشعارات الفورية</h3>
            <p className="text-xs text-[rgb(var(--text-muted))] leading-relaxed mb-3">
              احصل على تنبيهات فورية للإعلانات العاجلة والتكليفات الجديدة ومواعيد التسليم.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleEnable}
                className="flex-1 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold py-2 rounded-lg transition flex items-center justify-center gap-1.5"
              >
                <Bell className="w-3.5 h-3.5" />
                تفعيل
              </button>
              <button
                onClick={handleDismiss}
                className="px-3 py-2 bg-[rgb(var(--surface-subtle))] hover:bg-[rgb(var(--surface-muted))] text-[rgb(var(--text-muted))] text-xs rounded-lg transition border border-[rgb(var(--border))]"
              >
                لاحقاً
              </button>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="p-1 rounded-lg text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text))] hover:bg-[rgb(var(--surface-subtle))] transition flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function PWAPrompts() {
  return (
    <>
      <PWAInstallPrompt />
      <NotificationsPrompt />
    </>
  );
}
