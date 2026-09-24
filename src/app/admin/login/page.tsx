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
} from "lucide-react";

type Step = "phone" | "code" | "set-password" | "password-login";

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

  // Timer for retry
  useEffect(() => {
    if (retryAfter > 0) {
      const timer = setTimeout(() => setRetryAfter(retryAfter - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [retryAfter]);

  // Send OTP
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) return;

    setLoading(true);
    setErrorMsg(null);
    setInfoMsg(null);
    setOtpCode(null);

    try {
      const res = await fetch("/api/admin/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 429 && data.retry_after) {
          setRetryAfter(data.retry_after);
        }
        setErrorMsg(data.error || "فشل إرسال الرمز");
        return;
      }

      setInfoMsg("تم إرسال رمز التحقق إلى رقمك");
      if (data.code) {
        // وضع التطوير — الرمز معروض هنا
        setOtpCode(data.code);
      }
      if (data.user_preview) {
        setUserInfo({ name: data.user_preview.name, role: data.user_preview.role });
      }
      setStep("code");
    } catch (err: any) {
      setErrorMsg("تعذّر الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  };

  // Verify OTP
  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) {
      setErrorMsg("الرمز يجب أن يكون 6 أرقام");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
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

  // Set new password
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

  // Password login (alternative)
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
    <div className="min-h-screen bg-dark-bg flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full glass-card p-6 md:p-8 rounded-3xl space-y-6 border border-gray-800 relative z-10">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center mx-auto shadow-lg shadow-blue-500/10">
            <Shield className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-extrabold text-white">لوحة تحكم الأدمن</h1>
          <p className="text-xs text-gray-400">دخول مشرفي الدفعة — مصادقة برقم الهاتف</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 text-[10px] text-gray-500">
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
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border ${
                    active
                      ? "bg-blue-600 text-white border-blue-500"
                      : done
                      ? "bg-emerald-600/20 text-emerald-400 border-emerald-500/30"
                      : "bg-gray-800 text-gray-500 border-gray-700"
                  }`}
                >
                  {done ? "✓" : i + 1}
                </div>
                <span className={active ? "text-blue-400" : ""}>{s.label}</span>
                {i < 2 && <div className="w-4 h-px bg-gray-700 mx-1" />}
              </div>
            );
          })}
        </div>

        {errorMsg && (
          <div className="bg-rose-950/60 border border-rose-500/30 text-rose-300 text-xs p-3 rounded-xl text-center flex items-center justify-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {infoMsg && (
          <div className="bg-blue-950/60 border border-blue-500/30 text-blue-300 text-xs p-3 rounded-xl text-center flex items-center justify-center gap-2">
            <MessageSquare className="w-4 h-4 flex-shrink-0" />
            <span>{infoMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 text-xs p-3 rounded-xl text-center flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Step 1: Phone */}
        {step === "phone" && (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-300 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-blue-400" />
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
                className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3.5 py-2.5 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition text-left font-mono"
              />
              <p className="text-[10px] text-gray-500">
                أدخل الرقم بصيغة محلية (01012345678) أو E.164 (+201012345678)
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || retryAfter > 0}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2 text-sm"
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
                  <span>إرسال رمز التحقق</span>
                </>
              )}
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => setStep("password-login")}
                className="text-[11px] text-gray-500 hover:text-gray-300 transition"
              >
                لديك كلمة مرور؟ سجّل دخول بكلمة المرور
              </button>
            </div>
          </form>
        )}

        {/* Step 2: Code */}
        {step === "code" && (
          <form onSubmit={handleVerifyCode} className="space-y-4">
            {otpCode && (
              <div className="bg-amber-950/60 border border-amber-500/30 p-3 rounded-xl text-center space-y-1">
                <p className="text-[10px] text-amber-400 font-semibold">
                  ⚠️ وضع التطوير — الرمز:
                </p>
                <p className="text-2xl font-mono font-bold text-amber-300 tracking-[0.4em]">
                  {otpCode}
                </p>
                <p className="text-[10px] text-gray-500">
                  في الإنتاج: سيُرسل الرمز عبر SMS لرقمك
                </p>
              </div>
            )}

            {userInfo && (
              <div className="bg-gray-900/60 border border-gray-700 p-2.5 rounded-xl text-center text-xs text-gray-400">
                مرحباً <span className="text-white font-semibold">{userInfo.name}</span>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-300 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-blue-400" />
                رمز التحقق (6 أرقام)
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                placeholder="______"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                required
                autoFocus
                dir="ltr"
                className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3.5 py-3 text-center text-2xl font-mono tracking-[0.5em] text-gray-100 placeholder-gray-700 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition"
              />
            </div>

            <button
              type="submit"
              disabled={loading || code.length !== 6}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2 text-sm"
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
                }}
                className="text-gray-400 hover:text-gray-200 transition"
              >
                ← تغيير الرقم
              </button>
              <button
                type="button"
                onClick={handleSendOtp}
                disabled={loading || retryAfter > 0}
                className="text-blue-400 hover:text-blue-300 transition disabled:opacity-50"
              >
                {retryAfter > 0 ? `إعادة إرسال خلال ${retryAfter}s` : "إعادة إرسال الرمز"}
              </button>
            </div>
          </form>
        )}

        {/* Step 3: Set Password */}
        {step === "set-password" && (
          <form onSubmit={handleSetPassword} className="space-y-4">
            <div className="bg-blue-950/40 border border-blue-500/30 p-3 rounded-xl text-[11px] text-blue-200/80 space-y-1">
              <p className="font-semibold text-blue-300">🔑 تعيين كلمة مرور جديدة</p>
              <p>
                اضبط كلمة مرور قوية تستخدمها في المرات القادمة لتسجيل الدخول السريع بكلمة المرور بدلاً
                من OTP.
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-300 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-amber-400" />
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
                  className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3.5 py-2.5 pr-10 text-sm text-gray-100 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-gray-300"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-300 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                تأكيد كلمة المرور
              </label>
              <input
                type={showPassword ? "text" : "password"}
                placeholder="أعد إدخال كلمة المرور"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3.5 py-2.5 text-sm text-gray-100 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 text-sm"
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

        {/* Alternative: Password login */}
        {step === "password-login" && (
          <form onSubmit={handlePasswordLogin} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-300 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-blue-400" />
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
                className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3.5 py-2.5 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition text-left font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-300 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                كلمة المرور
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={passwordLogin}
                  onChange={(e) => setPasswordLogin(e.target.value)}
                  required
                  className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3.5 py-2.5 pr-10 text-sm text-gray-100 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-gray-300"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2 text-sm"
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
                className="text-[11px] text-gray-500 hover:text-gray-300 transition"
              >
                ← العودة لتسجيل الدخول بـ OTP
              </button>
            </div>
          </form>
        )}

        <div className="pt-4 border-t border-gray-800/80 text-center">
          <a href="/student" className="text-xs text-gray-400 hover:text-gray-200 inline-flex items-center gap-1 transition">
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
        <div className="min-h-screen bg-dark-bg flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
        </div>
      }
    >
      <AdminLoginForm />
    </Suspense>
  );
}
