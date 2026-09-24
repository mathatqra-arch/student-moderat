"use client";

import { useEffect, useState } from "react";
import { Key, Plus, Copy, Check, Trash2, Shield, Sparkles, Code } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

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
    if (!confirm("هل أنت تأكد من إغلاق وتجميد مفتاح API هذا؟ لن يتمكن شات جي بي تي من استخدامه بعد الآن.")) return;

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
    <div className="space-y-6">
      {/* Newly Generated Key Alert Box */}
      {newlyGeneratedKey && (
        <div className="bg-emerald-950/80 border border-emerald-500/50 p-5 rounded-2xl space-y-3 animate-fade-in shadow-xl shadow-emerald-950/40">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
            <Sparkles className="w-5 h-5" />
            <span>تم توليد مفتاح API الجديد لشات جي بي تي بنجاح! 🔑</span>
          </div>
          <p className="text-xs text-emerald-200/80">
            احفظ هذا المفتاح في مكان آمن الآن، فلن يتم إظهاره كاملاً مرة أخرى:
          </p>

          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={newlyGeneratedKey}
              className="w-full bg-emerald-900/60 border border-emerald-500/40 text-emerald-100 font-mono text-xs p-3 rounded-xl focus:outline-none"
            />
            <Button
              onClick={() => copyToClipboard(newlyGeneratedKey)}
              variant="success"
              size="sm"
              className="whitespace-nowrap"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? "تم النسخ!" : "نسخ المفتاح"}</span>
            </Button>
          </div>
        </div>
      )}

      {/* Key Generator Form */}
      <Card className="space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-gray-800">
          <div className="p-2 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
            <Key className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-gray-100 text-base">توليد مفاتيح API آمنة لشات جي بي تي (ChatGPT Auth)</h3>
            <p className="text-xs text-gray-400">أنشئ مفتاحاً خاصاً لربطه بـ ChatGPT Custom Action أو ChatGPT Desktop</p>
          </div>
        </div>

        <form onSubmit={handleGenerateKey} className="flex flex-col sm:flex-row gap-3 items-end">
          <div className="flex-1 w-full">
            <Input
              label="اسم المفتاح *"
              placeholder="مثال: مفتاح حساب شات جي بي تي الخاص بليدر الدفعة"
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
              required
            />
          </div>
          <Button
            type="submit"
            isLoading={loading}
            className="w-full sm:w-auto"
          >
            <Plus className="w-4 h-4" />
            <span>توليد مفتاح جديد</span>
          </Button>
        </form>
      </Card>

      {/* Existing Keys Table */}
      <Card className="space-y-4">
        <h4 className="font-bold text-gray-200 text-sm flex items-center gap-2">
          <Shield className="w-4 h-4 text-emerald-400" />
          المفاتيح النشطة حالياً
        </h4>

        {keys.length === 0 ? (
          <p className="text-xs text-gray-500 py-4 text-center">لا توجد مفاتيح API مخصصة حتى الآن.</p>
        ) : (
          <div className="space-y-2">
            {keys.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3.5 rounded-xl bg-gray-900/80 border border-gray-800 gap-3"
              >
                <div className="space-y-0.5">
                  <span className="font-bold text-gray-200 text-xs">{item.name}</span>
                  <div className="flex items-center gap-3 text-[11px] text-gray-500">
                    <span className="font-mono text-blue-400 bg-blue-950/40 px-2 py-0.5 rounded border border-blue-900/50">
                      {item.key_preview}
                    </span>
                    <span>تاريخ الإنشاء: {new Date(item.created_at).toLocaleDateString("ar-EG")}</span>
                  </div>
                </div>

                <button
                  onClick={() => handleRevokeKey(item.id)}
                  title="إلغاء وتجميد المفتاح"
                  className="p-2 rounded-lg bg-rose-950/40 hover:bg-rose-900 text-rose-300 transition border border-rose-900/50"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Live Supabase Edge Function & OpenAPI Info Box */}
      <Card className="space-y-3 bg-purple-950/10 border-purple-900/30">
        <div className="flex items-center gap-2 text-purple-300 font-bold text-sm">
          <Code className="w-4 h-4 text-purple-400" />
          <span>رابط خدمة MCP المباشر لشات جي بي تي (Supabase Edge Function):</span>
        </div>
        <p className="text-xs text-gray-300 leading-relaxed">
          يمكنك نسخ الرابط المباشر التالي ووضعه في إعدادات ChatGPT Custom GPT أو ChatGPT Desktop:
        </p>
        <div className="bg-gray-900 p-2.5 rounded-xl border border-gray-800 flex items-center justify-between text-xs font-mono text-purple-300">
          <span className="truncate">https://apcxwxnkntegbkimsmty.supabase.co/functions/v1/mcp</span>
          <button
            onClick={() => copyToClipboard("https://apcxwxnkntegbkimsmty.supabase.co/functions/v1/mcp")}
            className="text-xs text-blue-400 hover:text-blue-300 underline font-sans whitespace-nowrap mr-2"
          >
            نسخ الرابط المباشر
          </button>
        </div>
      </Card>
    </div>
  );
}
