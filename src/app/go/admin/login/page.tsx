"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Shield,
  Lock,
  Phone,
  Loader2,
  AlertCircle,
  Eye,
  EyeOff,
  Key,
} from "lucide-react";

function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/go/admin";

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim() || !password) return;

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

      router.push(redirectTo);
      router.refresh();
    } catch (err: any) {
      setErrorMsg("تعذّر الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative blobs */}
      <div className="blob-yellow" style={{ top: "-60px", right: "-60px" }} />
      <div className="blob-coral" style={{ bottom: "5%", left: "5%" }} />

      <div className="max-w-md w-full relative z-10 animate-slide-up">
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl border-2 border-ink bg-yellow shadow-brutal-md mb-3">
            <Shield className="w-8 h-8 text-ink" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">لوحة تحكم الأدمن</h1>
          <p className="text-sm text-gray mt-1">دخول المشرفين — رقم الهاتف + كلمة المرور</p>
        </div>

        {/* Error */}
        {errorMsg && (
          <div className="brutal-card-flat bg-coral text-cream-light px-4 py-3 rounded-lg text-sm flex items-center gap-2 mb-4 animate-fade-in">
            <AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleLogin} className="brutal-card p-6 space-y-4">
          {/* Phone */}
          <div className="space-y-1.5">
            <label htmlFor="login-phone" className="text-xs font-bold flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5" aria-hidden="true" />
              رقم الهاتف
            </label>
            <input
              id="login-phone"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="01000000000"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              autoFocus
              dir="ltr"
              className="brutal-input w-full px-3.5 py-2.5 text-sm text-left font-mono"
            />
            <p className="text-2xs text-gray">صيغة محلية (01012345678) أو دولية (+201012345678)</p>
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label htmlFor="login-password" className="text-xs font-bold flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" aria-hidden="true" />
              كلمة المرور
            </label>
            <div className="relative">
              <input
                id="login-password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="brutal-input w-full px-3.5 py-2.5 pr-10 text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                className="absolute left-3 top-1/2 -translate-y-1/2 p-1 text-gray hover:text-ink transition"
              >
                {showPassword ? <EyeOff className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
              </button>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="brutal-btn w-full py-3 flex items-center justify-center gap-2 text-sm"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                <span>جاري التحقق...</span>
              </>
            ) : (
              <>
                <Key className="w-4 h-4" aria-hidden="true" />
                <span>تسجيل الدخول</span>
              </>
            )}
          </button>
        </form>

        {/* Security notice */}
        <div className="brutal-card-flat bg-yellow p-3 rounded-lg mt-4 text-xs space-y-1">
          <p className="font-extrabold">🔐 صفحة محمية</p>
          <p>هذه المنطقة مخصصة لمشرفي المنصة فقط. جميع محاولات الدخول تُسجَّل وتُراقب.</p>
        </div>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-cream flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-ink" />
        </div>
      }
    >
      <AdminLoginForm />
    </Suspense>
  );
}
