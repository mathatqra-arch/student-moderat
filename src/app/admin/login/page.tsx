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
  Key,
} from "lucide-react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/admin";

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
    <div className="min-h-screen bg-[rgb(var(--bg))] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-brand-600/15 rounded-full blur-3xl pointer-events-none" />

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
              دخول مشرفي الدفعة — رقم الهاتف + كلمة المرور
            </p>
          </div>
        </div>

        {errorMsg && (
          <div className="bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs p-3 rounded-xl text-center flex items-center justify-center gap-2 animate-fade-in">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4 animate-fade-in">
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

          <div className="space-y-1.5">
            <label className="text-xs font-medium flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-amber-500" />
              كلمة المرور
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
            className="w-full bg-brand-600 hover:bg-brand-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition shadow-lg shadow-brand-600/25 flex items-center justify-center gap-2 text-sm hover:-translate-y-0.5"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>جاري التحقق...</span>
              </>
            ) : (
              <>
                <Key className="w-4 h-4" />
                <span>تسجيل الدخول</span>
              </>
            )}
          </button>
        </form>

        <div className="bg-brand-500/10 border border-brand-500/20 p-3 rounded-xl text-[11px] text-[rgb(var(--text-muted))] space-y-1">
          <p className="font-semibold text-brand-500">للأدمن الأساسي:</p>
          <p>الهاتف: <code className="font-mono text-brand-500">01040945655</code></p>
          <p>كلمة المرور الافتراضية: <code className="font-mono text-brand-500">000000</code></p>
          <p className="text-[10px] text-amber-500 mt-1">
            ⚠️ غيّر كلمة المرور من قسم "الفريق" بعد الدخول
          </p>
        </div>

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
