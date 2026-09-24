"use client";

import { useEffect, useState } from "react";
import {
  Users,
  UserPlus,
  Trash2,
  Database,
  ShieldAlert,
  Sparkles,
  Server,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { TeamMember } from "@/types/database";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default function TeamManager() {
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newMemberName, setNewMemberName] = useState("");
  const [memberRole, setMemberRole] = useState<"leader" | "assistant">("assistant");

  useEffect(() => {
    fetchTeam();
  }, []);

  const fetchTeam = async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data, error: queryError } = await supabase
        .from("team_members")
        .select("*")
        .order("created_at", { ascending: false });

      if (queryError) throw queryError;
      setTeam(data || []);
    } catch (err: any) {
      console.error("Fetch team error:", err);
      setError(err.message || "تعذّر تحميل قائمة الفريق");
      // fallback لبيانات افتراضية عند فشل الاتصال
      setTeam([
        {
          id: "demo-1",
          user_id: "demo",
          name: "ليدر الدفعة",
          role: "leader",
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim()) return;

    setError(null);
    try {
      const supabase = createClient();
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id || crypto.randomUUID();

      const { data, error: insertError } = await supabase
        .from("team_members")
        .insert([
          {
            name: newMemberName.trim(),
            role: memberRole,
            user_id: userId,
          },
        ])
        .select()
        .single();

      if (insertError) throw insertError;

      setTeam([data, ...team]);
      setNewMemberName("");
      setActionMsg("تم إضافة المشرف للفريق بنجاح! 👥");
      setTimeout(() => setActionMsg(null), 3000);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "فشل إضافة المشرف");
    }
  };

  const handleDeleteMember = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذا المشرف؟ لا يمكن التراجع.")) return;

    try {
      const supabase = createClient();
      const { error: deleteError } = await supabase
        .from("team_members")
        .delete()
        .eq("id", id);

      if (deleteError) throw deleteError;

      setTeam(team.filter((m) => m.id !== id));
      setActionMsg("تم حذف المشرف من الفريق.");
      setTimeout(() => setActionMsg(null), 3000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCleanOldData = async () => {
    if (!confirm("هل تريد أرشفة وحذف الاستفسارات المنتهية (أكثر من 30 يوماً)؟")) return;

    setError(null);
    try {
      const supabase = createClient();
      const { data, error: rpcError } = await supabase.rpc("clean_old_inquiries", {
        p_days: 30,
      });

      if (rpcError) throw rpcError;

      setActionMsg(`تم تنظيف وأرشفة ${data || 0} سجل قديم. 🧹`);
      setTimeout(() => setActionMsg(null), 4000);
    } catch (err: any) {
      console.error(err);
      setError(`فشل التنظيف: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {actionMsg && (
        <div className="bg-emerald-950/80 border border-emerald-500/30 text-emerald-300 text-xs p-3 rounded-xl text-center">
          {actionMsg}
        </div>
      )}
      {error && (
        <div className="bg-rose-950/60 border border-rose-500/30 text-rose-300 text-xs p-3 rounded-xl text-center">
          {error}
        </div>
      )}

      {/* Team Members List */}
      <Card className="space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-gray-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-gray-100 text-base">إدارة الفريق والمشرفين</h3>
              <p className="text-xs text-gray-400">المشرفون المسؤولون عن متابعة الطلاب</p>
            </div>
          </div>
          <button
            onClick={fetchTeam}
            disabled={loading}
            className="p-2 rounded-lg bg-gray-800/80 hover:bg-gray-700 text-gray-300 transition border border-gray-700 disabled:opacity-50"
            title="تحديث"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8 text-gray-400 gap-2 text-sm">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>جاري التحميل...</span>
          </div>
        ) : team.length === 0 ? (
          <p className="text-xs text-gray-500 py-6 text-center">
            لا يوجد مشرفون بعد. أضف أول مشرف للفريق أدناه.
          </p>
        ) : (
          <div className="space-y-2">
            {team.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-3 rounded-xl bg-gray-900/60 border border-gray-800 hover:border-gray-700 transition"
              >
                <div>
                  <p className="font-semibold text-gray-200 text-sm">{member.name}</p>
                  <span className="text-xs text-gray-500">
                    الدور:{" "}
                    {member.role === "leader" ? "ليدر الدفعة (Leader)" : "مشرف مساعد (Assistant)"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs px-2.5 py-0.5 rounded-full font-medium border ${
                      member.role === "leader"
                        ? "bg-purple-500/10 text-purple-400 border-purple-500/30"
                        : "bg-blue-500/10 text-blue-400 border-blue-500/30"
                    }`}
                  >
                    {member.role === "leader" ? "مسؤول رئيسي" : "مساعد"}
                  </span>
                  <button
                    onClick={() => handleDeleteMember(member.id)}
                    title="حذف المشرف"
                    className="p-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/70 text-rose-300 transition border border-rose-900/50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add Member Form */}
        <form onSubmit={handleAddMember} className="pt-3 border-t border-gray-800 space-y-3">
          <h4 className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
            <UserPlus className="w-4 h-4 text-emerald-400" />
            إضافة مشرف جديد للفريق
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input
              type="text"
              placeholder="اسم المشرف..."
              value={newMemberName}
              onChange={(e) => setNewMemberName(e.target.value)}
              required
              className="sm:col-span-2 bg-gray-900 border border-gray-800 rounded-xl px-3.5 py-2 text-xs text-gray-100 focus:outline-none focus:border-blue-500"
            />
            <select
              value={memberRole}
              onChange={(e) => setMemberRole(e.target.value as "leader" | "assistant")}
              className="bg-gray-900 border border-gray-800 rounded-xl px-3 py-2 text-xs text-gray-100 focus:outline-none focus:border-blue-500"
            >
              <option value="assistant">مشرف مساعد</option>
              <option value="leader">ليدر رئيسي</option>
            </select>
          </div>

          <Button type="submit" size="sm" className="w-full">
            <UserPlus className="w-4 h-4" />
            <span>إضافة المشرف</span>
          </Button>
        </form>
      </Card>

      {/* Housekeeping & Maintenance Tools */}
      <Card className="space-y-3 bg-rose-950/10 border-rose-900/30">
        <div className="flex items-center gap-2.5 pb-2 border-b border-rose-900/30">
          <div className="p-2 rounded-xl bg-rose-600/20 text-rose-400 border border-rose-500/30">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-rose-300 text-base">صيانة البيانات والأرشفة</h3>
            <p className="text-xs text-gray-400">حماية حدود التخزين المجاني في Supabase (500MB)</p>
          </div>
        </div>

        <p className="text-xs text-gray-400 leading-relaxed">
          أرشفة الاستفسارات المنتهية (المحلولة أو المؤرشفة) الأقدم من 30 يوماً. تنفّذ دالة{" "}
          <code className="text-rose-300 bg-rose-950/40 px-1.5 py-0.5 rounded">clean_old_inquiries</code>{" "}
          الموجودة في قاعدة البيانات.
        </p>

        <button
          onClick={handleCleanOldData}
          className="px-4 py-2.5 rounded-xl bg-rose-900/40 hover:bg-rose-900/80 text-rose-200 border border-rose-500/30 text-xs font-semibold flex items-center gap-2 transition w-full justify-center"
        >
          <Trash2 className="w-4 h-4 text-rose-400" />
          <span>تنظيف وأرشفة الاستفسارات القديمة</span>
        </button>
      </Card>

      {/* MCP Server Status */}
      <Card className="space-y-3 bg-purple-950/10 border-purple-900/30">
        <div className="flex items-center gap-2.5 pb-2 border-b border-purple-900/30">
          <div className="p-2 rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-purple-300 text-base">حالة خادم MCP</h3>
            <p className="text-xs text-gray-400">خدمة الذكاء الاصطناعي المرتبطة بـ ChatGPT</p>
          </div>
        </div>

        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-gray-900/60 border border-gray-800">
            <span className="text-gray-400">Edge Function (Supabase):</span>
            <code className="text-purple-300 font-mono text-[10px] truncate max-w-[200px]">
              /functions/v1/mcp
            </code>
          </div>
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-gray-900/60 border border-gray-800">
            <span className="text-gray-400">HTTP Route (Next.js):</span>
            <code className="text-purple-300 font-mono text-[10px]">/api/mcp</code>
          </div>
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-gray-900/60 border border-gray-800">
            <span className="text-gray-400">Stdio (Local):</span>
            <code className="text-purple-300 font-mono text-[10px]">npm run mcp:start</code>
          </div>
        </div>

        <div className="flex items-start gap-2 text-[11px] text-purple-200/70 bg-purple-950/30 p-2.5 rounded-xl border border-purple-500/20">
          <Sparkles className="w-3.5 h-3.5 text-purple-400 mt-0.5 flex-shrink-0" />
          <span>
            خادم MCP يتيح لـ ChatGPT إدارة الاستفسارات والإعلانات مباشرة. أنشئ مفتاح API من قسم "مفاتيح API &
            ChatGPT" واربطه في ChatGPT Custom Actions.
          </span>
        </div>
      </Card>
    </div>
  );
}
