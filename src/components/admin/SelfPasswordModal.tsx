"use client";

import { useState } from "react";
import { Key, X, Eye, EyeOff, Shield } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { friendlyError } from "@/lib/friendly-error";

// ==========================================
// مودال تغيير كلمة المرور الذاتي — متاح لأي عضو مسجل دخول (بدون أي صلاحيات)
// - يتطلب كلمة المرور الحالية (التحقق يتم في الـ API عبر signInWithPassword)
// - يغلق تلقائياً بعد النجاح
// ==========================================

export default function SelfPasswordModal({ onClose }: { onClose: () => void }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!currentPassword || !newPassword || !confirmPassword) return;

    if (newPassword.length < 8) {
      setError("كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("كلمتا المرور الجديدتان غير متطابقتين");
      return;
    }
    if (newPassword === currentPassword) {
      setError("كلمة المرور الجديدة يجب أن تختلف عن الحالية");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `فشلت العملية (${res.status})`);

      setSuccess(true);
      setTimeout(() => onClose(), 1800);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setSaving(false);
    }
  };

  const closeAndReset = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setError(null);
    setSuccess(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-cream-light border-2 border-ink rounded-2xl p-6 max-w-md w-full space-y-4 shadow-brutal-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-amber-600/20 text-amber-500 border border-amber-500/30 flex items-center justify-center">
              <Key className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base">تغيير كلمة المرور</h3>
          </div>
          <button
            onClick={closeAndReset}
            className="p-1 rounded-lg hover:bg-[rgb(var(--surface-subtle))] text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text))]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {success ? (
          <div className="space-y-3 py-4 text-center">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/15 border-2 border-emerald-500/30 flex items-center justify-center mx-auto">
              <Shield className="w-6 h-6 text-emerald-500" />
            </div>
            <p className="font-bold text-sm text-emerald-600">
              تم تغيير كلمة المرور بنجاح ✅
            </p>
            <p className="text-xs text-[rgb(var(--text-muted))]">
              استخدم كلمة المرور الجديدة في المرات القادمة مع رقم هاتفك
            </p>
          </div>
        ) : (
          <>
            {error && (
              <div className="bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs p-3 rounded-xl text-center">
                {error}
              </div>
            )}

            <p className="text-xs text-[rgb(var(--text-muted))]">
              لتأمين حسابك، اكتب كلمة مرورك الحالية أولاً ثم كلمة المرور الجديدة.
            </p>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-medium mb-1 block">كلمة المرور الحالية *</label>
                <div className="relative">
                  <input
                    type={showCurrent ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    autoFocus
                    autoComplete="current-password"
                    className="w-full bg-[rgb(var(--surface-subtle))] border border-[rgb(var(--border))] rounded-xl px-3.5 py-2.5 pr-10 text-sm focus:outline-none focus:border-amber-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent(!showCurrent)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text))]"
                    tabIndex={-1}
                  >
                    {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium mb-1 block">كلمة المرور الجديدة *</label>
                <div className="relative">
                  <input
                    type={showNew ? "text" : "password"}
                    placeholder="8 أحرف على الأقل"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    className="w-full bg-[rgb(var(--surface-subtle))] border border-[rgb(var(--border))] rounded-xl px-3.5 py-2.5 pr-10 text-sm focus:outline-none focus:border-amber-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text))]"
                    tabIndex={-1}
                  >
                    {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium mb-1 block">تأكيد كلمة المرور الجديدة *</label>
                <div className="relative">
                  <input
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    className="w-full bg-[rgb(var(--surface-subtle))] border border-[rgb(var(--border))] rounded-xl px-3.5 py-2.5 pr-10 text-sm focus:outline-none focus:border-amber-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text))]"
                    tabIndex={-1}
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={closeAndReset} className="flex-1">
                  إلغاء
                </Button>
                <Button type="submit" isLoading={saving} className="flex-1">
                  <Key className="w-4 h-4" />
                  تغيير
                </Button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
