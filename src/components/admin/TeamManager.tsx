"use client";

import { useState } from "react";
import { Users, UserPlus, Trash2, Database, ShieldAlert, Sparkles, Server } from "lucide-react";
import { TeamMember } from "@/types/database";

const defaultTeam: TeamMember[] = [
  {
    id: "tm-1",
    user_id: "usr-101",
    name: "ليدر الدفعة الرئيسية",
    role: "leader",
    created_at: new Date().toISOString(),
  },
  {
    id: "tm-2",
    user_id: "usr-102",
    name: "مساعد ليدر (متابعة الاستفسارات)",
    role: "assistant",
    created_at: new Date().toISOString(),
  },
];

export default function TeamManager() {
  const [team, setTeam] = useState<TeamMember[]>(defaultTeam);
  const [newMemberName, setNewMemberName] = useState("");
  const [memberRole, setMemberRole] = useState<"leader" | "assistant">("assistant");
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim()) return;

    const newMember: TeamMember = {
      id: "tm-" + (team.length + 1),
      user_id: "usr-" + Math.floor(1000 + Math.random() * 9000),
      name: newMemberName.trim(),
      role: memberRole,
      created_at: new Date().toISOString(),
    };

    setTeam([...team, newMember]);
    setNewMemberName("");
    setActionMsg("تم إضافة المشرف المساعد بنجاح! 👥");
    setTimeout(() => setActionMsg(null), 3000);
  };

  const handleCleanOldData = () => {
    if (confirm("هل أنت تأكد من أرشغة وحذف البيانات والمحفوظات القديمة (أكثر من 30 يوماً)؟")) {
      setActionMsg("تم تنظيف وأرشفة البيانات القديمة وحفظ المساحة التخزينية بنجاح. 🧹");
      setTimeout(() => setActionMsg(null), 4000);
    }
  };

  return (
    <div className="space-y-6">
      {actionMsg && (
        <div className="bg-emerald-950/80 border border-emerald-500/30 text-emerald-300 text-xs p-3 rounded-xl text-center">
          {actionMsg}
        </div>
      )}

      {/* Team Members List */}
      <div className="glass-card p-5 rounded-2xl border border-gray-800 space-y-4">
        <h3 className="font-bold text-gray-100 text-base flex items-center gap-2">
          <Users className="w-5 h-5 text-blue-400" />
          إدارة الفريق والمشرفين المساعدين
        </h3>

        <div className="space-y-2">
          {team.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between p-3 rounded-xl bg-gray-900/60 border border-gray-800"
            >
              <div>
                <p className="font-semibold text-gray-200 text-sm">{member.name}</p>
                <span className="text-xs text-gray-500">
                  الدور: {member.role === "leader" ? "ليدر الدفعة (Leader)" : "مشرف مساعد (Assistant)"}
                </span>
              </div>
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                member.role === "leader"
                  ? "bg-purple-500/10 text-purple-400 border border-purple-500/30"
                  : "bg-blue-500/10 text-blue-400 border border-blue-500/30"
              }`}>
                {member.role === "leader" ? "مسؤول رئيسي" : "مساعد"}
              </span>
            </div>
          ))}
        </div>

        {/* Add Member Form */}
        <form onSubmit={handleAddMember} className="pt-3 border-t border-gray-800 space-y-3">
          <h4 className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
            <UserPlus className="w-4 h-4 text-emerald-400" />
            إضافة مساعد جديد للفريق
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input
              type="text"
              placeholder="اسم المشرف المساعد..."
              value={newMemberName}
              onChange={(e) => setNewMemberName(e.target.value)}
              required
              className="sm:col-span-2 bg-gray-900 border border-gray-800 rounded-xl px-3.5 py-2 text-xs text-gray-100 focus:outline-none focus:border-blue-500"
            />

            <button
              type="submit"
              className="py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition"
            >
              إضافة المشرف
            </button>
          </div>
        </form>
      </div>

      {/* Housekeeping & Maintenance Tools */}
      <div className="glass-card p-5 rounded-2xl border border-rose-900/30 bg-rose-950/10 space-y-3">
        <h3 className="font-bold text-rose-300 text-base flex items-center gap-2">
          <Database className="w-5 h-5 text-rose-400" />
          صيانة البيانات وتوسيع المساحة التخزينية
        </h3>

        <p className="text-xs text-gray-400 leading-relaxed">
          أدوات للحفاظ على الأداء وحماية حدود التخزين المجانية في Supabase (500MB DB). يمكنك أرشفة الطلبات المنتهية والاستفسارات القديمة.
        </p>

        <button
          onClick={handleCleanOldData}
          className="px-4 py-2.5 rounded-xl bg-rose-900/40 hover:bg-rose-900/80 text-rose-200 border border-rose-500/30 text-xs font-semibold flex items-center gap-2 transition"
        >
          <Trash2 className="w-4 h-4 text-rose-400" />
          <span>تنظيف وأرشفة الاستفسارات والبيانات القديمة</span>
        </button>
      </div>
    </div>
  );
}
