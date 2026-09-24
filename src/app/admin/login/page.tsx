"use client";

import { useState, Suspense } from "react";
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
} from "lucide-react";

function AdminLoginForm() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/admin";

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim(), password }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        setErrorMsg(data.error || "فشل تسجيل الدخول");
        return;
      }

      // نجاح — إعادة توجيه
      router.push(redirectTo);
      router.refresh();
    } catch (err: any) {
      console.error(err);
      setErrorMsg("تعذّر الاتصال بالخادم. حاول مرة أخرى.");
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

        {errorMsg && (
          <div className="bg-rose-950/60 border border-rose-500/30 text-rose-300 text-xs p-3 rounded-xl text-center flex items-center justify-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
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
              className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3.5 py-2.5 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition text-left"
            />
            <p className="text-[10px] text-gray-500">
              أدخل الرقم بصيغة محلية (مثال: 01012345678) أو E.164 (+201012345678)
            </p>
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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3.5 py-2.5 pr-10 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-gray-300 transition"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2 text-sm"
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
        </form>

        <div className="bg-blue-950/30 border border-blue-500/20 p-3 rounded-xl space-y-1">
          <div className="flex items-center gap-1.5 text-blue-300 text-xs font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
            <span>الحساب الأساسي للتجربة:</span>
          </div>
          <div className="text-[11px] text-gray-400 space-y-0.5">
            <p>
              <span className="text-gray-500">الهاتف:</span>{" "}
              <code className="text-blue-300 font-mono">01040945655</code>
            </p>
            <p>
              <span className="text-gray-500">كلمة المرور الافتراضية:</span>{" "}
              <code className="text-blue-300 font-mono">Admin@2026#Secure</code>
            </p>
            <p className="text-[10px] text-amber-400/80 pt-1">
              ⚠️ غيّر كلمة المرور بعد أول تسجيل دخول من قسم "الفريق".
            </p>
          </div>
        </div>

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
