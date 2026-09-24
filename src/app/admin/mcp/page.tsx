"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Server,
  Terminal,
  Copy,
  Check,
  Play,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Key,
  ExternalLink,
  Zap,
  Code2,
  RefreshCw,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface ApiKey {
  id: string;
  name: string;
  key_preview: string;
  created_at: string;
  last_used_at?: string;
}

interface McpTool {
  name: string;
  description: string;
  inputSchema: any;
}

interface TestResult {
  ok: boolean;
  status: number;
  data: any;
  duration: number;
}

const CF_URL = "https://student-moderat.mathatqra.workers.dev";
const SUPABASE_URL = "https://apcxwxnkntegbkimsmty.supabase.co/functions/v1/mcp";

type Endpoint = "cloudflare" | "supabase";

export default function McpPage() {
  const [endpoint, setEndpoint] = useState<Endpoint>("cloudflare");
  const [token, setToken] = useState("");
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [tools, setTools] = useState<McpTool[]>([]);
  const [selectedTool, setSelectedTool] = useState<string>("");
  const [argsInput, setArgsInput] = useState<string>("{}");
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const [discovering, setDiscovering] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const currentUrl = endpoint === "cloudflare" ? `${CF_URL}/api/mcp` : SUPABASE_URL;

  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const fetchKeys = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/keys");
      const data = await res.json();
      if (data.keys) setKeys(data.keys);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const discoverTools = async () => {
    if (!token) {
      alert("أدخل مفتاح API أولاً");
      return;
    }
    setDiscovering(true);
    setTools([]);
    try {
      const res = await fetch(currentUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "tools/list",
          id: 1,
        }),
      });
      const data = await res.json();
      if (data.result?.tools) {
        setTools(data.result.tools);
        setSelectedTool(data.result.tools[0]?.name || "");
      } else {
        alert("فشل: " + JSON.stringify(data.error || data));
      }
    } catch (err: any) {
      alert("خطأ: " + err.message);
    } finally {
      setDiscovering(false);
    }
  };

  const callTool = async () => {
    if (!token || !selectedTool) {
      alert("أدخل المفتاح واختر أداة");
      return;
    }

    let args = {};
    try {
      args = JSON.parse(argsInput);
    } catch {
      alert("JSON غير صالح في حقل المعطيات");
      return;
    }

    setTesting(true);
    setResult(null);
    const start = Date.now();

    try {
      const res = await fetch(currentUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "tools/call",
          params: { name: selectedTool, arguments: args },
          id: Date.now(),
        }),
      });
      const data = await res.json();
      setResult({
        ok: res.ok && !data.error,
        status: res.status,
        data,
        duration: Date.now() - start,
      });
    } catch (err: any) {
      setResult({
        ok: false,
        status: 0,
        data: { error: err.message },
        duration: Date.now() - start,
      });
    } finally {
      setTesting(false);
    }
  };

  const generateConfig = () => {
    const config = {
      mcpServers: {
        "batch-management": {
          url: currentUrl,
          headers: {
            Authorization: `Bearer ${token || "bmp_key_..."}`,
          },
        },
      },
    };
    return JSON.stringify(config, null, 2);
  };

  return (
    <div className="space-y-6">
      {/* Endpoint Selection */}
      <Card className="space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-gray-800">
          <div className="p-2 rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-gray-100 text-base">خادم MCP — لوحة التحكم</h3>
            <p className="text-xs text-gray-400">اختر الـ endpoint وأدخل مفتاح API للاختبار</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button
            onClick={() => setEndpoint("cloudflare")}
            className={`p-4 rounded-xl border-2 text-right transition ${
              endpoint === "cloudflare"
                ? "bg-orange-950/40 border-orange-500/50 text-orange-200"
                : "bg-gray-900/60 border-gray-800 text-gray-400 hover:border-gray-700"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-sm">Cloudflare Workers</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </div>
            <code className="text-[10px] font-mono text-orange-300/80 block truncate">
              {CF_URL}/api/mcp
            </code>
            <span className="text-[10px] text-gray-500 block mt-1">الإنتاج — النسخة المنشورة على Cloudflare</span>
          </button>

          <button
            onClick={() => setEndpoint("supabase")}
            className={`p-4 rounded-xl border-2 text-right transition ${
              endpoint === "supabase"
                ? "bg-emerald-950/40 border-emerald-500/50 text-emerald-200"
                : "bg-gray-900/60 border-gray-800 text-gray-400 hover:border-gray-700"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-sm">Supabase Edge Function</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </div>
            <code className="text-[10px] font-mono text-emerald-300/80 block truncate">
              {SUPABASE_URL}
            </code>
            <span className="text-[10px] text-gray-500 block mt-1">Supabase — منشور مسبقاً</span>
          </button>
        </div>

        {/* Token Input */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-gray-300 flex items-center gap-1.5">
            <Key className="w-3.5 h-3.5 text-amber-400" />
            مفتاح API (bmp_key_...)
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="bmp_key_..."
              value={token}
              onChange={(e) => setToken(e.target.value)}
              dir="ltr"
              className="flex-1 bg-gray-900 border border-gray-800 rounded-xl px-3.5 py-2.5 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-blue-500 font-mono text-left"
            />
            <Button onClick={discoverTools} isLoading={discovering} variant="ghost" size="sm">
              <RefreshCw className={`w-4 h-4 ${discovering ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">استكشاف الأدوات</span>
            </Button>
          </div>
          {keys.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {keys.map((k) => (
                <button
                  key={k.id}
                  onClick={() => setToken(`bmp_key_${k.key_preview.replace("bmp_key_…", "")}`)}
                  className="px-2 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-[10px] text-gray-300 border border-gray-700 transition"
                  title="انقر للتعبئة (ملاحظة: المعاينة فقط، النسخة الكاملة من إنشائها)"
                >
                  {k.key_preview} — {k.name}
                </button>
              ))}
              <p className="text-[10px] text-gray-500 w-full pt-1">
                💡 المعاينة فقط — استخدم المفتاح الكامل الذي حصلت عليه عند إنشائه.
                <button
                  onClick={() => fetchKeys()}
                  className="text-blue-400 hover:text-blue-300 mr-1"
                >
                  تحديث القائمة
                </button>
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* Tools Discovery Results */}
      {tools.length > 0 && (
        <Card className="space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-gray-800">
            <h3 className="font-bold text-gray-100 text-sm flex items-center gap-2">
              <Zap className="w-4 h-4 text-emerald-400" />
              الأدوات المتاحة ({tools.length})
            </h3>
            <button
              onClick={discoverTools}
              disabled={discovering}
              className="text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50"
            >
              تحديث
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {tools.map((tool) => (
              <button
                key={tool.name}
                onClick={() => {
                  setSelectedTool(tool.name);
                  setArgsInput(JSON.stringify(tool.inputSchema?.properties || {}, null, 2));
                }}
                className={`p-3 rounded-xl text-right transition border ${
                  selectedTool === tool.name
                    ? "bg-blue-600/20 border-blue-500/50 text-blue-200"
                    : "bg-gray-900/60 border-gray-800 hover:border-gray-700 text-gray-300"
                }`}
              >
                <p className="font-mono text-xs font-bold">{tool.name}</p>
                <p className="text-[10px] text-gray-400 mt-1 line-clamp-2">
                  {tool.description}
                </p>
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* Tool Tester */}
      <Card className="space-y-3">
        <h3 className="font-bold text-gray-100 text-sm flex items-center gap-2 pb-2 border-b border-gray-800">
          <Terminal className="w-4 h-4 text-blue-400" />
          اختبار أداة MCP
        </h3>

        <div className="space-y-2">
          <label className="text-xs font-medium text-gray-300">الأداة</label>
          <select
            value={selectedTool}
            onChange={(e) => {
              setSelectedTool(e.target.value);
              const tool = tools.find((t) => t.name === e.target.value);
              if (tool) {
                setArgsInput(JSON.stringify(tool.inputSchema?.properties || {}, null, 2));
              }
            }}
            className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-blue-500"
          >
            <option value="">— اختر أداة —</option>
            {tools.map((tool) => (
              <option key={tool.name} value={tool.name}>
                {tool.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-gray-300 flex items-center justify-between">
            <span>المعطيات (JSON)</span>
            <button
              onClick={() => setArgsInput("{}")}
              className="text-[10px] text-gray-500 hover:text-gray-300"
            >
              إعادة تعيين
            </button>
          </label>
          <textarea
            value={argsInput}
            onChange={(e) => setArgsInput(e.target.value)}
            dir="ltr"
            rows={6}
            className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 text-xs text-gray-100 focus:outline-none focus:border-blue-500 font-mono"
            placeholder='{"status": "all"}'
          />
        </div>

        <Button onClick={callTool} isLoading={testing} className="w-full">
          <Play className="w-4 h-4" />
          تنفيذ الأداة
        </Button>

        {/* Result */}
        {result && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                {result.ok ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-400" />
                )}
                <span className={result.ok ? "text-emerald-300" : "text-rose-300"}>
                  HTTP {result.status} • {result.duration}ms
                </span>
              </div>
              <button
                onClick={() => copy(JSON.stringify(result.data, null, 2), "result")}
                className="text-blue-400 hover:text-blue-300 flex items-center gap-1"
              >
                {copied === "result" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                <span className="text-[10px]">نسخ</span>
              </button>
            </div>
            <pre
              dir="ltr"
              className="bg-gray-950 border border-gray-800 rounded-xl p-3 text-[11px] text-gray-200 font-mono overflow-x-auto max-h-80 overflow-y-auto"
            >
              {JSON.stringify(result.data, null, 2)}
            </pre>
          </div>
        )}
      </Card>

      {/* Configuration JSON */}
      <Card className="space-y-3 bg-purple-950/10 border-purple-900/30">
        <h3 className="font-bold text-purple-300 text-sm flex items-center gap-2 pb-2 border-b border-purple-900/30">
          <Code2 className="w-4 h-4 text-purple-400" />
          تكوين MCP لـ ChatGPT / Claude Desktop
        </h3>
        <p className="text-xs text-gray-400">
          انسخ هذا JSON في إعدادات MCP client لديك (ChatGPT Desktop / Claude Desktop / VS Code):
        </p>
        <div className="relative">
          <pre
            dir="ltr"
            className="bg-gray-950 border border-gray-800 rounded-xl p-3 text-[11px] text-purple-200 font-mono overflow-x-auto"
          >
            {generateConfig()}
          </pre>
          <button
            onClick={() => copy(generateConfig(), "config")}
            className="absolute top-2 left-2 p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-purple-300 transition"
          >
            {copied === "config" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>

        <div className="space-y-2 pt-2 border-t border-purple-900/30">
          <p className="text-xs font-semibold text-purple-300">روابط مفيدة:</p>
          <div className="grid grid-cols-1 gap-1.5">
            <a
              href={`${currentUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-2 rounded-xl bg-gray-900/60 border border-gray-800 hover:border-purple-500/30 transition text-xs"
            >
              <code className="font-mono text-purple-300 truncate">{currentUrl}</code>
              <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
            </a>
            <a
              href={`${CF_URL}/api/mcp/openapi.json`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-2 rounded-xl bg-gray-900/60 border border-gray-800 hover:border-purple-500/30 transition text-xs"
            >
              <code className="font-mono text-blue-300 truncate">{CF_URL}/api/mcp/openapi.json</code>
              <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
            </a>
          </div>
        </div>
      </Card>
    </div>
  );
}
