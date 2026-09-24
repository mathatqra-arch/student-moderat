"use client";

import { useEffect, useState } from "react";
import {
  Users,
  UserPlus,
  Trash2,
  Database,
  Sparkles,
  Server,
  Loader2,
  RefreshCw,
  Key,
  Phone,
  Eye,
  EyeOff,
  Shield,
  X,
} from "lucide-react";
import { TeamMember } from "@/types/database";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface AdminUser {
  id: string;
  phone?: string;
  email?: string;
  created_at: string;
}

interface TeamMemberWithPhone extends TeamMember {
  phone?: string;
}

export default function TeamManager() {
  const [team, setTeam] = useState<TeamMemberWithPhone[]>([]);
  const [adminUsers, setAdminUsers] = useState<Map<string, AdminUser>>(new Map());
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState<TeamMemberWithPhone | null>(null);

  // New admin form
  const [newAdminName, setNewAdminName] = useState("");
  const [newAdminPhone, setNewAdminPhone] = useState("");
  const [newAdminRole, setNewAdminRole] = useState<"leader" | "assistant">("assistant");
  const [newAdminPassword, setNewAdminPassword] = useState("");
  const [creating, setCreating] = useState(false);

  // Change password form
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

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

      // جلب بيانات المستخدمين (phone) من auth.users عبر Admin API (server-side)
      // نحتاج endpoint server-side لأن العميل لا يستطيع الوصول لـ auth.users
      const usersMap = new Map<string, AdminUser>();
      try {
        const res = await fetch("/api/admin/users");
        if (res.ok) {
          const usersData = await res.json();
          for (const u of usersData.users || []) {
            usersMap.set(u.id, u);
          }
        }
      } catch (e) {
        console.warn("Failed to fetch admin users:", e);
      }

      setAdminUsers(usersMap);

      // دمج بيانات team_members مع phone من auth.users
      const merged: TeamMemberWithPhone[] = (data || []).map((tm: TeamMember) => ({
        ...tm,
        phone: usersMap.get(tm.user_id)?.phone,
      }));

      setTeam(merged);
    } catch (err: any) {
      console.error("Fetch team error:", err);
      setError(err.message || "تعذّر تحميل قائمة الفريق");
    } finally {
      setLoading(false);
    }
  };

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminName.trim() || !newAdminPhone.trim()) return;

    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newAdminName.trim(),
          phone: newAdminPhone.trim(),
          role: newAdminRole,
          password: newAdminPassword || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل إنشاء الحساب");

      setActionMsg(
        `تم إنشاء حساب الأدمن بنجاح! ${
          data.password ? `كلمة المرور: ${data.password}` : ""
        }`
      );
      setTimeout(() => setActionMsg(null), 8000);

      // إعادة تعيين النموذج
      setNewAdminName("");
      setNewAdminPhone("");
      setNewAdminPassword("");
      setNewAdminRole("assistant");
      setShowAddModal(false);

      fetchTeam();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showPasswordModal || !newPassword) return;
    if (newPassword.length < 6) {
      setError("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
      return;
    }

    setChangingPassword(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: showPasswordModal.user_id,
          password: newPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل تغيير كلمة المرور");

      setActionMsg(`تم تغيير كلمة المرور لـ ${showPasswordModal.name} بنجاح ✅`);
      setTimeout(() => setActionMsg(null), 4000);

      setShowPasswordModal(null);
      setNewPassword("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setChangingPassword(false);
    }
  };

  const handleDeleteMember = async (id: string, userId: string) => {
    if (!confirm("هل أنت متأكد من حذف هذا المشرف نهائياً؟ سيتم حذف حسابه من المصادقة أيضاً.")) return;

    try {
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "فشل الحذف");
      }

      setTeam(team.filter((m) => m.id !== id));
      setActionMsg("تم حذف المشرف نهائياً.");
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
      const { data, error: rpcError } = await supabase.rpc("clean_old_inquiries", { p_days: 30 });
      if (rpcError) throw rpcError;

      setActionMsg(`تم تنظيف وأرشفة ${data || 0} سجل قديم. 🧹`);
      setTimeout(() => setActionMsg(null), 4000);
    } catch (err: any) {
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
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddModal(true)}
              className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-lg shadow-blue-600/20"
            >
              <UserPlus className="w-4 h-4" />
              <span className="hidden sm:inline">إضافة أدمن جديد</span>
            </button>
            <button
              onClick={fetchTeam}
              disabled={loading}
              className="p-2 rounded-lg bg-gray-800/80 hover:bg-gray-700 text-gray-300 transition border border-gray-700 disabled:opacity-50"
              title="تحديث"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8 text-gray-400 gap-2 text-sm">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>جاري التحميل...</span>
          </div>
        ) : team.length === 0 ? (
          <p className="text-xs text-gray-500 py-6 text-center">
            لا يوجد مشرفون بعد. اضغط "إضافة أدمن جديد" لإنشاء أول حساب.
          </p>
        ) : (
          <div className="space-y-2">
            {team.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-3 rounded-xl bg-gray-900/60 border border-gray-800 hover:border-gray-700 transition gap-3"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-9 h-9 rounded-xl bg-gray-800 text-gray-200 border border-gray-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {member.name.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-200 text-sm truncate">{member.name}</p>
                    <div className="flex items-center gap-2 text-[11px] text-gray-500">
                      {member.phone && (
                        <span className="flex items-center gap-1 font-mono">
                          <Phone className="w-3 h-3" />
                          <span dir="ltr">{member.phone}</span>
                        </span>
                      )}
                      <span>•</span>
                      <span>
                        {member.role === "leader" ? "ليدر رئيسي" : "مساعد"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${
                      member.role === "leader"
                        ? "bg-purple-500/10 text-purple-400 border-purple-500/30"
                        : "bg-blue-500/10 text-blue-400 border-blue-500/30"
                    }`}
                  >
                    {member.role === "leader" ? "رئيسي" : "مساعد"}
                  </span>
                  <button
                    onClick={() => setShowPasswordModal(member)}
                    title="تغيير كلمة المرور"
                    className="p-1.5 rounded-lg bg-amber-950/40 hover:bg-amber-900/70 text-amber-300 transition border border-amber-900/50"
                  >
                    <Key className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteMember(member.id, member.user_id)}
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
      </Card>

      {/* Add Admin Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center">
                  <Shield className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-white text-base">إضافة أدمن جديد</h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddAdmin} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-300 mb-1 block">الاسم الكامل *</label>
                <input
                  type="text"
                  placeholder="مثال: أحمد محمد"
                  value={newAdminName}
                  onChange={(e) => setNewAdminName(e.target.value)}
                  required
                  autoFocus
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3.5 py-2.5 text-sm text-gray-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-300 mb-1 block flex items-center gap-1.5">
                  <Phone className="w-3 h-3 text-blue-400" />
                  رقم الهاتف *
                </label>
                <input
                  type="tel"
                  placeholder="01012345678"
                  value={newAdminPhone}
                  onChange={(e) => setNewAdminPhone(e.target.value)}
                  required
                  dir="ltr"
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3.5 py-2.5 text-sm text-gray-100 focus:outline-none focus:border-blue-500 text-left font-mono"
                />
                <p className="text-[10px] text-gray-500 mt-1">11 رقماً مصرياً يبدأ بـ 01</p>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-300 mb-1 block">الدور</label>
                <select
                  value={newAdminRole}
                  onChange={(e) => setNewAdminRole(e.target.value as "leader" | "assistant")}
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3.5 py-2.5 text-sm text-gray-100 focus:outline-none focus:border-blue-500"
                >
                  <option value="assistant">مشرف مساعد (Assistant)</option>
                  <option value="leader">ليدر رئيسي (Leader)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-300 mb-1 block">
                  كلمة المرور (اختياري)
                </label>
                <input
                  type="text"
                  placeholder="(توليد تلقائي إن تُرك فارغاً)"
                  value={newAdminPassword}
                  onChange={(e) => setNewAdminPassword(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3.5 py-2.5 text-sm text-gray-100 focus:outline-none focus:border-blue-500 font-mono"
                />
                <p className="text-[10px] text-gray-500 mt-1">6 أحرف على الأقل</p>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1"
                >
                  إلغاء
                </Button>
                <Button type="submit" isLoading={creating} className="flex-1">
                  <UserPlus className="w-4 h-4" />
                  إنشاء الحساب
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-amber-600/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
                  <Key className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-white text-base">تغيير كلمة المرور</h3>
              </div>
              <button
                onClick={() => {
                  setShowPasswordModal(null);
                  setNewPassword("");
                }}
                className="p-1 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-gray-400">
              تغيير كلمة مرور: <span className="text-white font-semibold">{showPasswordModal.name}</span>
              {showPasswordModal.phone && (
                <span className="block mt-1 font-mono text-[11px]" dir="ltr">
                  {showPasswordModal.phone}
                </span>
              )}
            </p>

            <form onSubmit={handleChangePassword} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-300 mb-1 block">كلمة المرور الجديدة</label>
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    placeholder="6 أحرف على الأقل"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    autoFocus
                    minLength={6}
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3.5 py-2.5 pr-10 text-sm text-gray-100 focus:outline-none focus:border-amber-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-gray-300"
                    tabIndex={-1}
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setShowPasswordModal(null);
                    setNewPassword("");
                  }}
                  className="flex-1"
                >
                  إلغاء
                </Button>
                <Button type="submit" isLoading={changingPassword} className="flex-1">
                  <Key className="w-4 h-4" />
                  حفظ كلمة المرور
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Housekeeping & Maintenance */}
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
          أرشفة الاستفسارات المنتهية الأقدم من 30 يوماً عبر دالة{" "}
          <code className="text-rose-300 bg-rose-950/40 px-1.5 py-0.5 rounded">clean_old_inquiries</code>.
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
