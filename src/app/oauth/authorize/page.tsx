"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Shield,
  Lock,
  Key,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
} from "lucide-react";

function OAuthAuthorizeForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // استخراج params من URL
  const redirectUri = searchParams.get("redirect_uri") || "";
  const state = searchParams.get("state") || "";
  const clientId = searchParams.get("client_id") || "";
  const codeChallenge = searchParams.get("code_challenge") || "";
  const codeChallengeMethod = searchParams.get("code_challenge_method") || "";
  const resource = searchParams.get("resource") || "";
  const scope = searchParams.get("scope") || "";
  const errorParam = searchParams.get("error") || "";
  const mcpUrl = searchParams.get("mcp_url") || "https://apcxwxnkntegbkimsmty.supabase.co/functions/v1/mcp";

  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(errorParam || null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim() || !redirectUri) return;

    setLoading(true);
    setErrorMsg(null);

    try {
      const formData = new FormData();
      formData.append("api_key", apiKey.trim());
      formData.append("redirect_uri", redirectUri);
      if (state) formData.append("state", state);
      if (clientId) formData.append("client_id", clientId);
      if (codeChallenge) formData.append("code_challenge", codeChallenge);
      if (codeChallengeMethod) formData.append("code_challenge_method", codeChallengeMethod);
      if (resource) formData.append("resource", resource);
      if (scope) formData.append("scope", scope);

      const res = await fetch(`${mcpUrl}/oauth/authorize`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.ok) {
        setErrorMsg(data.error || `HTTP ${res.status}: فشل التحقق من المفتاح`);
        return;
      }

      // لو فيه redirect_url، ننتقل للـ ChatGPT callback
      if (data.redirect_url) {
        setSuccessMsg("تم التحقق بنجاح! جاري التحويل لـ ChatGPT...");
        setTimeout(() => {
          window.location.href = data.redirect_url;
        }, 1000);
      } else {
        setErrorMsg("استجابة غير متوقعة من الخادم");
      }
    } catch (err: any) {
      console.error("OAuth authorize error:", err);
      setErrorMsg("تعذّر الاتصال بالخادم: " + (err.message || ""));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[rgb(var(--bg))] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-brand-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full glass-card p-6 md:p-8 rounded-3xl space-y-6 border border-[rgb(var(--border))] relative z-10 shadow-2xl animate-scale-in">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-indigo-600 text-white shadow-lg shadow-brand-600/30 mx-auto">
            <Shield className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold">منح صلاحية ChatGPT للوصول للمنصة</h1>
            <p className="text-xs text-[rgb(var(--text-muted))] mt-1">
              أدخل مفتاح الـ API المولّد من لوحة الأدمن لتأكيد الربط.
            </p>
          </div>
        </div>

        {errorMsg && (
          <div className="bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs p-3 rounded-xl text-center flex items-center justify-center gap-2 animate-fade-in">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 text-xs p-3 rounded-xl text-center flex items-center justify-center gap-2 animate-fade-in">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <form id="oauth-form" onSubmit={handleSubmit} className="space-y-4 animate-fade-in">
          <input type="hidden" name="redirect_uri" value={redirectUri} />
          <input type="hidden" name="state" value={state} />
          <input type="hidden" name="client_id" value={clientId} />
          <input type="hidden" name="code_challenge" value={codeChallenge} />
          <input type="hidden" name="code_challenge_method" value={codeChallengeMethod} />
          <input type="hidden" name="resource" value={resource} />
          <input type="hidden" name="scope" value={scope} />

          <div className="space-y-1.5">
            <label className="text-xs font-medium flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-amber-500" />
              مفتاح API (BMP Key)
            </label>
            <input
              type="password"
              name="api_key"
              placeholder="bmp_key_..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              required
              autoFocus
              dir="ltr"
              className="w-full bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition font-mono text-left"
            />
            <p className="text-[10px] text-[rgb(var(--text-subtle))]">
              يبدأ بـ <code className="text-brand-500">bmp_key_</code> — يمكنك إنشاؤه من لوحة الأدمن → مفاتيح API
            </p>
          </div>

          <div className="bg-brand-500/10 border border-brand-500/20 p-3 rounded-xl text-[11px] text-[rgb(var(--text-muted))] space-y-1">
            <p className="font-semibold text-brand-500 flex items-center gap-1.5">
              <Lock className="w-3 h-3" />
              الصلاحيات الممنوحة:
            </p>
            <ul className="space-y-0.5 text-[rgb(var(--text-muted))]">
              <li>• قراءة استفسارات الطلاب المعلقة</li>
              <li>• اقتراح ردود ذكية على الاستفسارات</li>
              <li>• نشر إعلانات وتكليفات جديدة</li>
              <li>• الوصول لسياق الدفعة والجداول</li>
            </ul>
          </div>

          <button
            type="submit"
            disabled={loading || !apiKey.trim()}
            className="w-full bg-brand-600 hover:bg-brand-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition shadow-lg shadow-brand-600/25 flex items-center justify-center gap-2 text-sm hover:-translate-y-0.5"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>جاري التحقق...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>تأكيد ومنح الصلاحية</span>
              </>
            )}
          </button>
        </form>

        <div className="pt-4 border-t border-[rgb(var(--border))] text-center">
          <a
            href="/admin"
            className="text-xs text-[rgb(var(--text-muted))] hover:text-brand-500 inline-flex items-center gap-1 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            ليس لديك مفتاح؟ أنشئ واحداً من لوحة الأدمن
          </a>
        </div>
      </div>
    </div>
  );
}

export default function OAuthAuthorizePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[rgb(var(--bg))] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
        </div>
      }
    >
      <OAuthAuthorizeForm />
    </Suspense>
  );
}
