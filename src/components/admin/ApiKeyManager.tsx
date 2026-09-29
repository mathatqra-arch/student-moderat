"use client";

import { useEffect, useState } from "react";
import { Key, Plus, Copy, Check, Trash2, Shield, Sparkles, Code } from "lucide-react";

interface ApiKeyItem {
  id: string;
  name: string;
  key_preview: string;
  created_at: string;
  last_used_at?: string;
}

export default function ApiKeyManager() {
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [keyName, setKeyName] = useState("");
  const [newlyGeneratedKey, setNewlyGeneratedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    fetchKeys();
  }, []);

  const fetchKeys = async () => {
    try {
      const res = await fetch("/api/admin/keys");
      const data = await res.json();
      if (data.keys) {
        setKeys(data.keys);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setFetching(false);
    }
  };

  const handleGenerateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyName.trim()) return;
    setLoading(true);
    setNewlyGeneratedKey(null);
    try {
      const res = await fetch("/api/admin/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: keyName }),
      });
      const data = await res.json();
      if (data.apiKey) {
        setNewlyGeneratedKey(data.apiKey);
        setKeyName("");
        fetchKeys();
      } else if (data.error) {
        alert(data.error);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeKey = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذا المفتاح؟ لن يعمل مع ChatGPT بعد الآن.")) return;
    try {
      await fetch("/api/admin/keys", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      fetchKeys();
    } catch (err) {
      console.error(err);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="space-y-5">
      {/* Newly Generated Key */}
      {newlyGeneratedKey && (
        <div className="brutal-card p-5 space-y-3 animate-pop" style={{ background: "var(--green)", borderColor: "var(--ink)" }}>
          <div className="flex items-center gap-2 text-ink font-extrabold text-sm">
            <Sparkles className="w-5 h-5" />
            <span>تم توليد مفتاح API بنجاح! 🔑</span>
          </div>
          <p className="text-xs text-ink-soft">
            احفظ هذا المفتاح في مكان آمن الآن — لن يُظهر مرة أخرى:
          </p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={newlyGeneratedKey}
              className="brutal-input flex-1 px-3 py-2.5 text-xs font-mono"
              style={{ background: "var(--cream-white)" }}
            />
            <button
              onClick={() => copyToClipboard(newlyGeneratedKey)}
              className="brutal-btn px-4 py-2.5 text-xs whitespace-nowrap flex items-center gap-1.5"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? "تم النسخ!" : "نسخ"}</span>
            </button>
          </div>
        </div>
      )}

      {/* Key Generator Form */}
      <div className="brutal-card p-5 space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b-2 border-ink">
          <div className="w-10 h-10 rounded-lg border-2 border-ink bg-yellow flex items-center justify-center shadow-brutal-sm">
            <Key className="w-5 h-5 text-ink" />
          </div>
          <div>
            <h3 className="font-extrabold text-base text-ink">توليد مفتاح API جديد</h3>
            <p className="text-xs text-gray mt-0.5">لربط ChatGPT أو Claude Desktop بالمنصة</p>
          </div>
        </div>

        <form onSubmit={handleGenerateKey} className="flex flex-col sm:flex-row gap-3 items-end">
          <div className="flex-1 w-full">
            <label className="text-xs font-bold text-ink mb-1.5 block">اسم المفتاح *</label>
            <input
              type="text"
              placeholder="مثال: مفتاح ChatGPT الرئيسي"
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
              required
              className="brutal-input w-full px-3.5 py-2.5 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="brutal-btn px-5 py-2.5 text-sm flex items-center gap-2 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            <span>توليد</span>
          </button>
        </form>
      </div>

      {/* Existing Keys */}
      <div className="brutal-card p-5 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b-2 border-ink">
          <h4 className="font-extrabold text-sm text-ink flex items-center gap-2">
            <Shield className="w-4 h-4" />
            المفاتيح النشطة ({keys.length})
          </h4>
        </div>

        {fetching ? (
          <div className="space-y-2">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="skeleton h-14" style={{ animationDelay: `${i * 0.1}s` }} />
            ))}
          </div>
        ) : keys.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-full border-2 border-ink bg-cream-dark mx-auto flex items-center justify-center mb-2">
              <Key className="w-6 h-6 text-gray" />
            </div>
            <p className="text-xs text-gray font-bold">لا توجد مفاتيح API بعد</p>
          </div>
        ) : (
          <div className="space-y-2">
            {keys.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3.5 brutal-card-flat gap-3"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-9 h-9 rounded-lg border-2 border-ink bg-purple-soft flex items-center justify-center flex-shrink-0">
                    <Key className="w-4 h-4 text-ink" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-ink truncate">{item.name}</p>
                    <div className="flex items-center gap-2 text-2xs text-gray mt-0.5">
                      <code className="font-mono bg-cream-dark px-1.5 py-0.5 rounded border border-ink text-ink-soft">
                        {item.key_preview}
                      </code>
                      <span>•</span>
                      <span>{new Date(item.created_at).toLocaleDateString("ar-EG")}</span>
                      {item.last_used_at && (
                        <>
                          <span>•</span>
                          <span>آخر استخدام: {new Date(item.last_used_at).toLocaleDateString("ar-EG")}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleRevokeKey(item.id)}
                  title="حذف المفتاح"
                  className="p-2 rounded-lg border-2 border-ink bg-coral hover:bg-coral-light transition flex-shrink-0"
                >
                  <Trash2 className="w-4 h-4 text-ink" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MCP URL Info */}
      <div className="brutal-card p-5 space-y-3" style={{ background: "var(--purple-soft)" }}>
        <div className="flex items-center gap-2 font-extrabold text-sm text-ink">
          <Code className="w-4 h-4" />
          <span>رابط MCP لـ ChatGPT</span>
        </div>
        <p className="text-xs text-ink-soft leading-relaxed">
          انسخ هذا الرابط وأضفه في ChatGPT → Settings → Connectors:
        </p>
        <div className="brutal-card-flat p-3 flex items-center justify-between gap-2 text-xs" style={{ background: "var(--cream-white)" }}>
          <code className="font-mono text-ink-soft truncate text-2xs">
            https://apcxwxnkntegbkimsmty.supabase.co/functions/v1/mcp
          </code>
          <button
            onClick={() => copyToClipboard("https://apcxwxnkntegbkimsmty.supabase.co/functions/v1/mcp")}
            className="brutal-btn-ghost px-3 py-1.5 text-2xs whitespace-nowrap flex items-center gap-1"
          >
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            <span>{copied ? "تم!" : "نسخ"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
