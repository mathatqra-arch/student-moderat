"use client";

import { useState, Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Shield,
  Lock,
  Phone,
  ArrowRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Key,
  MessageSquare,
  RefreshCw,
  Sparkles,
  Sun,
} from "lucide-react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

type Step = "phone" | "code" | "set-password" | "password-login";
type OtpMode = "firebase" | "screen" | null;

function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialStep = (searchParams.get("step") as Step) || "phone";

  const [step, setStep] = useState<Step>(initialStep);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLogin, setPasswordLogin] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState<string | null>(null);
  const [retryAfter, setRetryAfter] = useState<number>(0);
  const [userInfo, setUserInfo] = useState<{ name: string; role: string } | null>(null);
  const [otpMode, setOtpMode] = useState<OtpMode>(null);
  const [firebaseReady, setFirebaseReady] = useState<boolean | null>(null);
  const [firebaseVerifier, setFirebaseVerifier] = useState<any>(null);
  const [quotaWarning, setQuotaWarning] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/firebase/setup")
      .then((res) => res.json())
      .then((data) => {
        setFirebaseReady(data.ready);
        if (data.ready) loadFirebaseClient();
      })
      .catch(() => setFirebaseReady(false));
  }, []);

  async function loadFirebaseClient() {
    try {
      const { initializeApp } = await import("firebase/app");
      const { getAuth, RecaptchaVerifier, signInWithPhoneNumber } = await import("firebase/auth");

      const firebaseConfig = {
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
      };

      const app = initializeApp(firebaseConfig);
      const auth = getAuth(app);
      const verifier = new RecaptchaVerifier(auth, "recaptcha-container", {
        size: "invisible",
        callback: () => {},
        "expired-callback": () => {},
      });

      setFirebaseVerifier({ auth, verifier, signInWithPhoneNumber });
    } catch (err) {
      console.error("Failed to load Firebase client:", err);
      setFirebaseReady(false);
    }
  }

  useEffect(() => {
    if (retryAfter > 0) {
      const timer = setTimeout(() => setRetryAfter(retryAfter - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [retryAfter]);

  function normalizePhoneForFirebase(phone: string): string {
    const cleaned = phone.replace(/[\s\-()]/g, "").trim();
    if (cleaned.startsWith("+")) return cleaned;
    if (cleaned.startsWith("201") && cleaned.length === 12) return "+" + cleaned;
    if (cleaned.startsWith("01") && cleaned.length === 11) return "+2" + cleaned;
    return cleaned;
  }

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) return;

    setLoading(true);
    setErrorMsg(null);
    setInfoMsg(null);
    setOtpCode(null);
    setQuotaWarning(null);

    // معلومات تشخيصية
    console.log("[OTP] Starting send flow", {
      phone,
      firebaseReady,
      firebaseVerifierReady: Boolean(firebaseVerifier),
      location: typeof window !== "undefined" ? window.location.origin : "",
    });

    try {
      // 1. محاولة Firebase Phone Auth (SMS حقيقي)
      if (firebaseReady && firebaseVerifier) {
        try {
          const normalizedPhone = normalizePhoneForFirebase(phone);
          console.log("[OTP] Calling Firebase signInWithPhoneNumber:", normalizedPhone);

          const confirmationResult = await firebaseVerifier.signInWithPhoneNumber(
            firebaseVerifier.auth,
            normalizedPhone,
            firebaseVerifier.verifier
          );

          console.log("[OTP] ✅ Firebase SMS sent successfully");
          setOtpMode("firebase");
          setInfoMsg("تم إرسال رمز التحقق إلى رقمك عبر SMS");
          setStep("code");
          (window as any).__firebaseConfirmation = confirmationResult;
          return;
        } catch (err: any) {
          console.error("[OTP] ❌ Firebase failed:", err.code, err.message);

          // تشخيص السبب وإظهار رسالة مناسبة
          if (err.code === "auth/quota-exceeded") {
            setQuotaWarning(
              "تم تجاوز حصة Firebase اليومية (10 SMS). سنعرض الرمز هنا كحل بديل — تواصل مع المشرف لزيادة الحصة."
            );
          } else if (err.code === "auth/invalid-phone-number") {
            setErrorMsg("رقم الهاتف غير صالح. الصيغة الصحيحة: +201012345678");
            setLoading(false);
            return;
          } else if (err.code === "auth/too-many-requests") {
            setErrorMsg("محاولات كثيرة من هذا الـ IP. انتظر 5 دقائق.");
            setLoading(false);
            return;
          } else if (err.code === "auth/captcha-check-failed") {
            setQuotaWarning(
              "reCAPTCHA فشل التحقق. حاول مرة أخرى — سنعرض الرمز هنا كحل بديل."
            );
          } else if (err.code === "auth/operation-not-allowed") {
            setQuotaWarning(
              "⚠️ Phone Auth غير مُفعّل في Firebase Console. افتح: https://console.firebase.google.com/project/student-8f889/authentication/providers — فعّل Phone."
            );
          } else if (err.code === "auth/api-key-not-valid") {
            setErrorMsg("Firebase API Key غير صالح. تحقق من NEXT_PUBLIC_FIREBASE_API_KEY.");
            setLoading(false);
            return;
          } else if (err.code === "auth/invalid-verification-code") {
            setErrorMsg("رمز التحقق غير صحيح أو منتهي. حاول مرة أخرى.");
            setLoading(false);
            return;
          } else if (
            err.message?.includes("auth/invalid-api-key") ||
            err.message?.includes("XMLHttpRequest")
          ) {
            setErrorMsg(
              "Firebase API Key غير صالح أو Domain غير مصرّح به. تحقق من إعدادات Firebase."
            );
            setLoading(false);
            return;
          } else {
            setQuotaWarning(
              `Firebase فشل (${err.code || "unknown"}): ${err.message || ""} — سنعرض الرمز هنا كحل بديل.`
            );
          }
          // نواصل للـ fallback
        }
      } else if (firebaseReady && !firebaseVerifier) {
        console.warn("[OTP] Firebase configured but client SDK failed to load");
        setQuotaWarning(
          "تعذّر تحميل Firebase client SDK. سنعرض الرمز هنا كحل بديل."
        );
      }

      // 2. Fallback: OTP على الشاشة
      console.log("[OTP] Falling back to screen OTP");
      const res = await fetch("/api/admin/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 429 && data.retry_after) setRetryAfter(data.retry_after);
        setErrorMsg(data.error || "فشل إرسال الرمز");
        setLoading(false);
        return;
      }

      setOtpMode("screen");
      setInfoMsg(
        quotaWarning ||
          (data.delivery_method === "sms"
            ? "تم إرسال الرمز عبر SMS"
            : "وضع التطوير — الرمز معروض هنا")
      );
      if (data.code) setOtpCode(data.code);
      if (data.user_preview)
        setUserInfo({ name: data.user_preview.name, role: data.user_preview.role });
      setStep("code");
    } catch (err: any) {
      console.error("[OTP] ❌ General error:", err);
      setErrorMsg("تعذّر الاتصال بالخادم: " + (err.message || ""));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) {
      setErrorMsg("الرمز يجب أن يكون 6 أرقام");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      if (otpMode === "firebase" && (window as any).__firebaseConfirmation) {
        const confirmation = (window as any).__firebaseConfirmation;
        try {
          const userCredential = await confirmation.confirm(code);
          const idToken = await userCredential.user.getIdToken();

          const res = await fetch("/api/admin/firebase/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id_token: idToken }),
          });
          const data = await res.json();

          if (!res.ok || !data.ok) {
            setErrorMsg(data.error || "فشل التحقق من Firebase");
            return;
          }

          if (data.needs_password_change) {
            setSuccessMsg("تم التحقق بنجاح! عيّن كلمة مرور جديدة للمتابعة.");
            setStep("set-password");
          } else {
            router.push("/admin");
            router.refresh();
          }
          return;
        } catch (err: any) {
          if (err.code === "auth/invalid-verification-code")
            setErrorMsg("الرمز غير صحيح. حاول مرة أخرى.");
          else if (err.code === "auth/code-expired")
            setErrorMsg("انتهت صلاحية الرمز. اطلب رمزاً جديداً.");
          else setErrorMsg("فشل التحقق: " + (err.message || ""));
          return;
        }
      }

      const res = await fetch("/api/admin/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim(), code }),
      });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        setErrorMsg(data.error || "فشل التحقق");
        return;
      }

      if (data.needs_password_change) {
        setSuccessMsg("تم التحقق بنجاح! عيّن كلمة مرور جديدة للمتابعة.");
        setStep("set-password");
      } else {
        router.push("/admin");
        router.refresh();
      }
    } catch (err: any) {
      setErrorMsg("تعذّر الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setErrorMsg("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg("كلمتا المرور غير متطابقتين");
      return;
    }
    if (newPassword === "000000") {
      setErrorMsg("لا يمكنك استخدام 000000 ككلمة مرور دائمة");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/admin/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ new_password: newPassword }),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || "فشل تعيين كلمة المرور");
        return;
      }

      setSuccessMsg("تم تعيين كلمة المرور بنجاح! جاري التحويل للوحة التحكم...");
      setTimeout(() => {
        router.push("/admin");
        router.refresh();
      }, 1500);
    } catch (err: any) {
      setErrorMsg("تعذّر الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim() || !passwordLogin) return;

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim(), password: passwordLogin }),
      });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        setErrorMsg(data.error || "فشل تسجيل الدخول");
        return;
      }

      router.push("/admin");
      router.refresh();
    } catch (err: any) {
      setErrorMsg("تعذّر الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[rgb(var(--bg))] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-brand-600/15 rounded-full blur-3xl pointer-events-none" />

      <div id="recaptcha-container" />

      {/* زرار الـ Theme */}
      <div className="absolute top-4 left-4 z-20">
        <ThemeToggle />
      </div>

      <div className="max-w-md w-full glass-card p-6 md:p-8 rounded-3xl space-y-6 border border-[rgb(var(--border))] relative z-10 shadow-2xl animate-scale-in">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-indigo-600 text-white shadow-lg shadow-brand-600/30 mx-auto">
            <Shield className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold">لوحة تحكم الأدمن</h1>
            <p className="text-xs text-[rgb(var(--text-muted))] mt-1">
              دخول مشرفي الدفعة — مصادقة برقم الهاتف
            </p>
          </div>
        </div>

        {/* Auth Provider Badge */}
        {firebaseReady !== null && (
          <div
            className={`flex items-center gap-2 p-2.5 rounded-xl text-[11px] border ${
              firebaseReady
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500"
                : "bg-amber-500/10 border-amber-500/30 text-amber-500"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 flex-shrink-0" />
            <span>
              {firebaseReady
                ? "Firebase Phone Auth مُفعّل — سيصلك الرمز عبر SMS حقيقي"
                : "وضع التطوير — الرمز سيظهر على الشاشة"}
            </span>
          </div>
        )}

        {quotaWarning && (
          <div className="flex items-start gap-2 p-2.5 rounded-xl text-[11px] bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>{quotaWarning}</span>
          </div>
        )}

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 text-[10px] text-[rgb(var(--text-muted))]">
          {[
            { id: "phone", label: "الهاتف" },
            { id: "code", label: "الرمز" },
            { id: "set-password", label: "كلمة المرور" },
          ].map((s, i) => {
            const active =
              (step === "phone" && i === 0) ||
              (step === "code" && i === 1) ||
              ((step === "set-password" || step === "password-login") && i === 2);
            const done =
              (step === "code" && i === 0) ||
              (step === "set-password" && i < 2) ||
              (step === "password-login" && i < 2);
            return (
              <div key={s.id} className="flex items-center gap-1">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition-all ${
                    active
                      ? "bg-brand-600 text-white border-brand-500 scale-110"
                      : done
                      ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/30"
                      : "bg-[rgb(var(--surface-subtle))] text-[rgb(var(--text-muted))] border-[rgb(var(--border))]"
                  }`}
                >
                  {done ? "✓" : i + 1}
                </div>
                <span className={active ? "text-brand-500 font-semibold" : ""}>{s.label}</span>
                {i < 2 && <div className="w-6 h-px bg-[rgb(var(--border))] mx-1" />}
              </div>
            );
          })}
        </div>

        {errorMsg && (
          <div className="bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs p-3 rounded-xl text-center flex items-center justify-center gap-2 animate-fade-in">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {infoMsg && (
          <div className="bg-brand-500/10 border border-brand-500/30 text-brand-500 text-xs p-3 rounded-xl text-center flex items-center justify-center gap-2 animate-fade-in">
            <MessageSquare className="w-4 h-4 flex-shrink-0" />
            <span>{infoMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 text-xs p-3 rounded-xl text-center flex items-center justify-center gap-2 animate-fade-in">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Step 1: Phone */}
        {step === "phone" && (
          <form onSubmit={handleSendOtp} className="space-y-4 animate-fade-in">
            <div className="space-y-1.5">
              <label className="text-xs font-medium flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-brand-500" />
                رقم الهاتف
              </label>
              <input
                type="tel"
                inputMode="tel"
                placeholder="01040945655"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                autoFocus
                dir="ltr"
                className="w-full bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-xl px-3.5 py-2.5 text-sm placeholder-[rgb(var(--text-subtle))] focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition text-left font-mono"
              />
              <p className="text-[10px] text-[rgb(var(--text-subtle))]">
                بصيغة محلية (01012345678) أو E.164 (+201012345678)
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || retryAfter > 0 || firebaseReady === null}
              className="w-full bg-brand-600 hover:bg-brand-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition shadow-lg shadow-brand-600/25 flex items-center justify-center gap-2 text-sm hover:-translate-y-0.5"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جاري الإرسال...</span>
                </>
              ) : retryAfter > 0 ? (
                <>
                  <RefreshCw className="w-4 h-4" />
                  <span>انتظر {retryAfter} ثانية</span>
                </>
              ) : (
                <>
                  <MessageSquare className="w-4 h-4" />
                  <span>إرسال رمز التحقق {firebaseReady ? "via SMS" : ""}</span>
                </>
              )}
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => setStep("password-login")}
                className="text-[11px] text-[rgb(var(--text-muted))] hover:text-brand-500 transition"
              >
                لديك كلمة مرور؟ سجّل دخول بكلمة المرور
              </button>
            </div>
          </form>
        )}

        {/* Step 2: Code */}
        {step === "code" && (
          <form onSubmit={handleVerifyCode} className="space-y-4 animate-fade-in">
            {otpCode && otpMode === "screen" && (
              <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-xl text-center space-y-2">
                <p className="text-[10px] text-amber-500 font-semibold uppercase tracking-wide">
                  {quotaWarning ? "حل بديل — الرمز:" : "وضع التطوير — الرمز:"}
                </p>
                <p className="text-3xl font-mono font-bold text-amber-500 tracking-[0.5em]">
                  {otpCode}
                </p>
                <p className="text-[10px] text-[rgb(var(--text-subtle))]">
                  {firebaseReady
                    ? "Firebase لم يتمكن من إرسال SMS — استخدم هذا الرمز"
                    : "لتفعيل SMS الحقيقي، أضف Firebase config"}
                </p>
              </div>
            )}

            {otpMode === "firebase" && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-xl text-center space-y-2">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-emerald-500/15 mb-1">
                  <MessageSquare className="w-5 h-5 text-emerald-500" />
                </div>
                <p className="text-sm text-emerald-600 dark:text-emerald-400 font-semibold">
                  تم إرسال الرمز عبر SMS
                </p>
                <p className="text-[10px] text-[rgb(var(--text-subtle))]">
                  قد يستغرق وصول الرسالة 10-30 ثانية
                </p>
              </div>
            )}

            {userInfo && (
              <div className="bg-[rgb(var(--surface-subtle))] border border-[rgb(var(--border))] p-2.5 rounded-xl text-center text-xs">
                مرحباً <span className="font-semibold text-brand-500">{userInfo.name}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-medium flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-brand-500" />
                رمز التحقق (6 أرقام)
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                placeholder="••••••"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                required
                autoFocus
                dir="ltr"
                className="w-full bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-xl px-3.5 py-3.5 text-center text-2xl font-mono tracking-[0.5em] focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition"
              />
            </div>

            <button
              type="submit"
              disabled={loading || code.length !== 6}
              className="w-full bg-brand-600 hover:bg-brand-500 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition shadow-lg shadow-brand-600/25 flex items-center justify-center gap-2 text-sm hover:-translate-y-0.5"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جاري التحقق...</span>
                </>
              ) : (
                <span>تأكيد الرمز</span>
              )}
            </button>

            <div className="flex items-center justify-between text-[11px]">
              <button
                type="button"
                onClick={() => {
                  setStep("phone");
                  setCode("");
                  setErrorMsg(null);
                  setInfoMsg(null);
                  setOtpCode(null);
                  setOtpMode(null);
                  setQuotaWarning(null);
                }}
                className="text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text))] transition"
              >
                ← تغيير الرقم
              </button>
              <button
                type="button"
                onClick={handleSendOtp}
                disabled={loading || retryAfter > 0}
                className="text-brand-500 hover:text-brand-400 transition disabled:opacity-50"
              >
                {retryAfter > 0 ? `إعادة إرسال خلال ${retryAfter}s` : "إعادة إرسال الرمز"}
              </button>
            </div>
          </form>
        )}

        {/* Step 3: Set Password */}
        {step === "set-password" && (
          <form onSubmit={handleSetPassword} className="space-y-4 animate-fade-in">
            <div className="bg-brand-500/10 border border-brand-500/30 p-3 rounded-xl text-[11px] text-brand-600 dark:text-brand-400 space-y-1">
              <p className="font-semibold flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" />
                تعيين كلمة مرور جديدة
              </p>
              <p className="text-[rgb(var(--text-muted))]">
                اضبط كلمة مرور قوية لتسجيل الدخول السريع في المرات القادمة.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-amber-500" />
                كلمة المرور الجديدة
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="6 أحرف على الأقل"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  autoFocus
                  minLength={6}
                  className="w-full bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-xl px-3.5 py-2.5 pr-10 text-sm focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text))]"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                تأكيد كلمة المرور
              </label>
              <input
                type={showPassword ? "text" : "password"}
                placeholder="أعد إدخال كلمة المرور"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                className="w-full bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 text-sm hover:-translate-y-0.5"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جاري الحفظ...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>تعيين كلمة المرور ودخول لوحة التحكم</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* Password Login Alternative */}
        {step === "password-login" && (
          <form onSubmit={handlePasswordLogin} className="space-y-4 animate-fade-in">
            <div className="space-y-1.5">
              <label className="text-xs font-medium flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-brand-500" />
                رقم الهاتف
              </label>
              <input
                type="tel"
                inputMode="tel"
                placeholder="01040945655"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                autoFocus
                dir="ltr"
                className="w-full bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition text-left font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-amber-500" />
                كلمة المرور
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={passwordLogin}
                  onChange={(e) => setPasswordLogin(e.target.value)}
                  required
                  className="w-full bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-xl px-3.5 py-2.5 pr-10 text-sm focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text))]"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-600 hover:bg-brand-500 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition shadow-lg shadow-brand-600/25 flex items-center justify-center gap-2 text-sm hover:-translate-y-0.5"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جاري التحقق...</span>
                </>
              ) : (
                <span>تسجيل الدخول</span>
              )}
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => setStep("phone")}
                className="text-[11px] text-[rgb(var(--text-muted))] hover:text-brand-500 transition"
              >
                ← العودة لتسجيل الدخول بـ OTP
              </button>
            </div>
          </form>
        )}

        <div className="pt-4 border-t border-[rgb(var(--border))] text-center">
          <a
            href="/student"
            className="text-xs text-[rgb(var(--text-muted))] hover:text-brand-500 inline-flex items-center gap-1 transition"
          >
            <ArrowRight className="w-3.5 h-3.5" />
            العودة لواجهة الطلاب العامة
          </a>
        </div>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[rgb(var(--bg))] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
        </div>
      }
    >
      <AdminLoginForm />
    </Suspense>
  );
}
