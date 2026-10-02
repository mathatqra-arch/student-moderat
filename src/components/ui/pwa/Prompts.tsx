"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bell,
  Copy,
  Download,
  ExternalLink,
  Shield,
  Smartphone,
  X,
} from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

declare global {
  interface Window {
    __pwaBuf?: BeforeInstallPromptEvent | null;
  }
}

// ==========================================
// أدوات مشتركة — تتبع التثبيت منفصل لكل تطبيق
// تطبيق الطالب وتطبيق الإدارة لكل واحد مفاتيحه المستقلة
// عشان تثبيت واحد ميبقاش يخفي أو يمنع بوب أب التاني
// ==========================================

const STUDENT_INSTALLED_KEY = "pwa-student-installed";
const ADMIN_INSTALLED_KEY = "pwa-admin-installed";
const ADMIN_DISMISS_KEY = "pwa-admin-dismissed-at";
const STUDENT_DISMISS_KEY = "pwa-install-dismissed"; // المفتاح القديم — توافق مع النسخ السابقة
const ADMIN_DISMISS_MS = 3 * 24 * 60 * 60 * 1000; // «لاحقاً» بتخفي 3 أيام وبعدين بيرجع يعرض

function markInstalled(key: string) {
  try {
    localStorage.setItem(key, "1");
  } catch {}
}

function isMarkedInstalled(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function recentlyDismissed(key: string, windowMs: number): boolean {
  try {
    const at = Number(localStorage.getItem(key) || "0");
    return at > 0 && Date.now() - at < windowMs;
  } catch {
    return false;
  }
}

// الحدث ممكن يكون اتفصل قبل ما React يركب — البافر في الـ layout بيمسكه
function getBufferedPrompt(): BeforeInstallPromptEvent | null {
  if (typeof window === "undefined") return null;
  return window.__pwaBuf ?? null;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const mq = window.matchMedia?.("(display-mode: standalone)")?.matches ?? false;
  const iosStandalone =
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return mq || iosStandalone;
}

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function isAndroid(): boolean {
  if (typeof navigator === "undefined") return false;
  return /android/i.test(navigator.userAgent);
}

// ==========================================
// بوب أب تثبيت تطبيق الطالب (الصفحات العامة والطالب)
// - standalone من غير src=admin → إحنا جوه تطبيق الطالب المثبت نفسه
// - الحدث الأصلي بيتقري من البافر العالمي فمش بيتضيع قبل الهيدريشن
// ==========================================

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const onInstalled = () => {
      markInstalled(STUDENT_INSTALLED_KEY);
      setIsInstalled(true);
      setShowPrompt(false);
    };
    window.addEventListener("appinstalled", onInstalled);
    window.addEventListener("pwa-app-installed", onInstalled);

    // standalone بدون src=admin → جوه تطبيق الطالب المثبت (يشمل التثبيتات القديمة)
    if (isStandalone()) {
      markInstalled(STUDENT_INSTALLED_KEY);
      setIsInstalled(true);
      return () => {
        window.removeEventListener("appinstalled", onInstalled);
        window.removeEventListener("pwa-app-installed", onInstalled);
      };
    }

    if (isMarkedInstalled(STUDENT_INSTALLED_KEY)) {
      setIsInstalled(true);
      return () => {
        window.removeEventListener("appinstalled", onInstalled);
        window.removeEventListener("pwa-app-installed", onInstalled);
      };
    }

    try {
      if (localStorage.getItem(STUDENT_DISMISS_KEY) === "true") setDismissed(true);
    } catch {}

    const buffered = getBufferedPrompt();
    if (buffered) {
      setDeferredPrompt(buffered);
      const t = setTimeout(() => setShowPrompt(true), 3000);
      return () => {
        clearTimeout(t);
        window.removeEventListener("appinstalled", onInstalled);
        window.removeEventListener("pwa-app-installed", onInstalled);
      };
    }

    const onAvailable = () => {
      const p = getBufferedPrompt();
      if (p) {
        setDeferredPrompt(p);
        setShowPrompt(true);
      }
    };
    window.addEventListener("pwa-install-available", onAvailable);

    return () => {
      window.removeEventListener("pwa-install-available", onAvailable);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("pwa-app-installed", onInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        markInstalled(STUDENT_INSTALLED_KEY);
        setIsInstalled(true);
      } else {
        try {
          localStorage.setItem(STUDENT_DISMISS_KEY, "true");
          setTimeout(() => localStorage.removeItem(STUDENT_DISMISS_KEY), 24 * 60 * 60 * 1000);
        } catch {}
      }
    } catch {}
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setDismissed(true);
    try {
      localStorage.setItem(STUDENT_DISMISS_KEY, "true");
    } catch {}
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
            aria-label="إغلاق"
            className="p-1 rounded-lg text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text))] hover:bg-[rgb(var(--surface-subtle))] transition flex-shrink-0"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// بوب أب تثبيت تطبيق الإدارة — شكل وهوية مختلفين تمامًا عن الطالب
// 3 حالات:
// 1) native: متصفح عادي + الحدث الأصلي متاح → برومبت التثبيت الرسمي
// 2) manual: جوه تطبيق الطالب المثبت (standalone) — كروم مبيسمحش
//    ببرومبت تثبيت تاني من جوه WebAPK → تعليمات يدوية واضحة
//    + فتح في كروم + نسخ الرابط
// 3) مثبت بالفعل (مفتاح مستقل pwa-admin-installed) → مفيش أي بوب أب
// التثبيت نفسه منفصل 100%: manifest بـ id مختلف → أيقونة مستقلة
// جنب أيقونة الطلبة بدون أي تعارض
// ==========================================

type AdminMode = "native" | "manual-android" | "manual-ios";

export function AdminPwaPrompt() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [mode, setMode] = useState<AdminMode | null>(null);
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [copied, setCopied] = useState(false);
  const modeRef = useRef<AdminMode | null>(null);

  useEffect(() => {
    if (recentlyDismissed(ADMIN_DISMISS_KEY, ADMIN_DISMISS_MS)) setDismissed(true);

    const onInstalled = () => {
      markInstalled(ADMIN_INSTALLED_KEY);
      setShow(false);
    };
    window.addEventListener("appinstalled", onInstalled);
    window.addEventListener("pwa-app-installed", onInstalled);

    // إحنا جوه تطبيق الإدارة نفسه (اتفتح من أيقونته بـ start_url?src=admin)
    const src = new URLSearchParams(window.location.search).get("src");
    if (isStandalone() && src === "admin") {
      markInstalled(ADMIN_INSTALLED_KEY);
      return () => {
        window.removeEventListener("appinstalled", onInstalled);
        window.removeEventListener("pwa-app-installed", onInstalled);
      };
    }

    // متعلم مسبقاً إن التطبيق الإدارة مثبت (مثلاً اتثبت قبل كده وفتح الرابط في المتصفح)
    if (isMarkedInstalled(ADMIN_INSTALLED_KEY)) {
      return () => {
        window.removeEventListener("appinstalled", onInstalled);
        window.removeEventListener("pwa-app-installed", onInstalled);
      };
    }

    const applyMode = (m: AdminMode, p: BeforeInstallPromptEvent | null) => {
      if (modeRef.current) return; // أول وضع بيفوز — مفيش تبديل مزعج
      modeRef.current = m;
      if (p) setPromptEvent(p);
      setMode(m);
      setShow(true);
    };

    // جوه تطبيق مثبت من غير src=admin → تطبيق الطالب غالبًا.
    // كروم مبيطلعش beforeinstallprompt من جوه WebAPK → تعليمات يدوية فورًا
    if (isStandalone()) {
      const m: AdminMode = isIOS() ? "manual-ios" : "manual-android";
      const t = setTimeout(() => applyMode(m, null), 1500);
      return () => {
        clearTimeout(t);
        window.removeEventListener("appinstalled", onInstalled);
        window.removeEventListener("pwa-app-installed", onInstalled);
      };
    }

    // متصفح عادي — الحدث ممكن يكون وصل قبل الهيدريشن (موجود في البافر)
    const buffered = getBufferedPrompt();
    if (buffered) {
      const t = setTimeout(() => applyMode("native", buffered), 2000);
      return () => {
        clearTimeout(t);
        window.removeEventListener("appinstalled", onInstalled);
        window.removeEventListener("pwa-app-installed", onInstalled);
      };
    }

    // نستنى الحدث الأصلي؛ لو ماجاش خلال 5 ثواني → تعليمات يدوية
    const onAvailable = () => {
      const p = getBufferedPrompt();
      if (p) applyMode("native", p);
    };
    window.addEventListener("pwa-install-available", onAvailable);

    const fallback = setTimeout(() => {
      applyMode(isIOS() ? "manual-ios" : "manual-android", null);
    }, 5000);

    return () => {
      window.removeEventListener("pwa-install-available", onAvailable);
      clearTimeout(fallback);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("pwa-app-installed", onInstalled);
    };
  }, []);

  const adminUrl = () =>
    typeof window !== "undefined" ? `${window.location.origin}/go/admin` : "/go/admin";

  const handleInstall = async () => {
    if (!promptEvent) return;
    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice.outcome === "accepted") markInstalled(ADMIN_INSTALLED_KEY);
      else softDismiss();
    } catch {}
    setShow(false);
  };

  const softDismiss = () => {
    try {
      localStorage.setItem(ADMIN_DISMISS_KEY, String(Date.now()));
    } catch {}
    setDismissed(true);
    setShow(false);
  };

  const copyLink = async () => {
    const url = adminUrl();
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // fallback للمتصفحات القديمة
      const ta = document.createElement("textarea");
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {}
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openInBrowser = () => {
    const url = adminUrl();
    if (isAndroid()) {
      // من جوه WebAPK: مخطط كروم بيفتح المتصفح مباشرة
      // جهاز عليه WebAPK معناه كروم موجود — ومع ذلك فيه احتياط
      window.location.href = `googlechrome://navigate?url=${encodeURIComponent(url)}`;
      window.setTimeout(() => window.open(url, "_blank", "noopener"), 1500);
    } else {
      window.open(url, "_blank", "noopener");
    }
  };

  if (dismissed || !show || !mode) return null;

  return (
    <div
      role="region"
      aria-label="تثبيت تطبيق الإدارة"
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 z-[60] animate-slide-up"
    >
      <div className="rounded-2xl p-[2px] bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 shadow-2xl shadow-purple-900/30">
        <div className="bg-[rgb(var(--surface))] rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-purple-800 flex items-center justify-center flex-shrink-0 shadow-lg shadow-purple-700/30">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-sm mb-1">ثبّت تطبيق الإدارة — أيقونة منفصلة</h3>

              {mode === "native" && (
                <>
                  <p className="text-xs text-[rgb(var(--text-muted))] leading-relaxed mb-3">
                    لوحة الإدارة هتتنزّل <b>تطبيق مستقل</b> بأيقونة درع بنفسجية — منفصل تماماً
                    عن تطبيق الطلبة، وكل واحد ليه نافذته الخاصة.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleInstall}
                      className="flex-1 bg-violet-700 hover:bg-violet-600 text-white text-xs font-semibold py-2 rounded-lg transition flex items-center justify-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      تثبيت الآن
                    </button>
                    <button
                      onClick={softDismiss}
                      className="px-3 py-2 bg-[rgb(var(--surface-subtle))] hover:bg-[rgb(var(--surface-muted))] text-[rgb(var(--text-muted))] text-xs rounded-lg transition border border-[rgb(var(--border))]"
                    >
                      لاحقاً
                    </button>
                  </div>
                </>
              )}

              {mode === "manual-android" && (
                <>
                  <p className="text-xs text-[rgb(var(--text-muted))] leading-relaxed mb-2">
                    إنت داخل تطبيق الطلبة — كروم مبيسمحش بتثبيت تاني من جوّه. عشان تنزّل
                    لوحة الإدارة كتطبيق منفصل:
                  </p>
                  <ol className="text-xs text-[rgb(var(--text-muted))] leading-relaxed mb-3 space-y-1 list-decimal list-inside">
                    <li>دوس «فتح في كروم» — الرابط هيفتح في متصفح كروم مش جوه التطبيق</li>
                    <li>من قائمة كروم (⋮) اختار «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية»</li>
                    <li>هتلاقي أيقونة «الإدارة» منفصلة جنب أيقونة «الدفعة»</li>
                  </ol>
                  <div className="flex gap-2">
                    <button
                      onClick={openInBrowser}
                      className="flex-1 bg-violet-700 hover:bg-violet-600 text-white text-xs font-semibold py-2 rounded-lg transition flex items-center justify-center gap-1.5"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      فتح في كروم
                    </button>
                    <button
                      onClick={copyLink}
                      className="px-3 py-2 bg-[rgb(var(--surface-subtle))] hover:bg-[rgb(var(--surface-muted))] text-[rgb(var(--text-muted))] text-xs rounded-lg transition border border-[rgb(var(--border))] flex items-center gap-1.5"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      {copied ? "تم النسخ" : "نسخ الرابط"}
                    </button>
                  </div>
                </>
              )}

              {mode === "manual-ios" && (
                <>
                  <p className="text-xs text-[rgb(var(--text-muted))] leading-relaxed mb-2">
                    لوحة الإدارة تُضاف كتطبيق منفصل من سفاري:
                  </p>
                  <ol className="text-xs text-[rgb(var(--text-muted))] leading-relaxed mb-3 space-y-1 list-decimal list-inside">
                    <li>افتح <b dir="ltr">{adminUrl().replace(/^https?:\/\//, "")}</b> في سفاري</li>
                    <li>من زر المشاركة اختار «Add to Home Screen»</li>
                    <li>هتظهر أيقونة «الإدارة» منفصلة عن أيقونة الطلبة</li>
                  </ol>
                  <div className="flex gap-2">
                    <button
                      onClick={copyLink}
                      className="flex-1 bg-violet-700 hover:bg-violet-600 text-white text-xs font-semibold py-2 rounded-lg transition flex items-center justify-center gap-1.5"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      {copied ? "تم النسخ" : "نسخ الرابط"}
                    </button>
                  </div>
                </>
              )}

              <p className="text-[10px] text-[rgb(var(--text-muted))] mt-2 leading-relaxed">
                التثبيت مش هيأثر على تطبيق الطلبة — الاتنين هيشتغلوا جنب بعض بدون أي تعارض.
              </p>
            </div>
            <button
              onClick={softDismiss}
              aria-label="إغلاق"
              className="p-1 rounded-lg text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text))] hover:bg-[rgb(var(--surface-subtle))] transition flex-shrink-0"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
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
            aria-label="إغلاق"
            className="p-1 rounded-lg text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text))] hover:bg-[rgb(var(--surface-subtle))] transition flex-shrink-0"
          >
            <X className="w-4 h-4" aria-hidden="true" />
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
