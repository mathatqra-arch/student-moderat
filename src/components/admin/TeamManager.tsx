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
  Check,
  Lock,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface AdminUser {
  id: string;
  phone?: string;
  email?: string;
  name?: string;
  role?: string;
  permissions?: Permissions;
  team_member_id?: string;
  created_at: string;
  last_sign_in_at?: string;
}

interface Permissions {
  inquiries: { view: boolean; reply: boolean; delete: boolean };
  announcements: { view: boolean; create: boolean; edit: boolean; delete: boolean };
  tasks: { view: boolean; create: boolean; edit: boolean; delete: boolean };
  team: { view: boolean; create: boolean; edit: boolean; delete: boolean };
  api_keys: { view: boolean; create: boolean; delete: boolean };
  mcp: { view: boolean; test: boolean };
  settings: { view: boolean; edit: boolean };
}

const DEFAULT_PERMISSIONS: Permissions = {
  inquiries: { view: true, reply: true, delete: false },
  announcements: { view: true, create: true, edit: true, delete: false },
  tasks: { view: true, create: true, edit: true, delete: false },
  team: { view: true, create: false, edit: false, delete: false },
  api_keys: { view: false, create: false, delete: false },
  mcp: { view: false, test: false },
  settings: { view: false, edit: false },
};

const PERMISSION_LABELS: Record<string, { label: string; actions: { key: string; label: string }[] }> = {
  inquiries: {
    label: "الاستفسارات",
    actions: [
      { key: "view", label: "عرض" },
      { key: "reply", label: "رد" },
      { key: "delete", label: "حذف" },
    ],
  },
  announcements: {
    label: "الإعلانات",
    actions: [
      { key: "view", label: "عرض" },
      { key: "create", label: "إنشاء" },
      { key: "edit", label: "تعديل" },
      { key: "delete", label: "حذف" },
    ],
  },
  tasks: {
    label: "التكليفات",
    actions: [
      { key: "view", label: "عرض" },
      { key: "create", label: "إنشاء" },
      { key: "edit", label: "تعديل" },
      { key: "delete", label: "حذف" },
    ],
  },
  team: {
    label: "الفريق",
    actions: [
      { key: "view", label: "عرض" },
      { key: "create", label: "إضافة" },
      { key: "edit", label: "تعديل" },
      { key: "delete", label: "حذف" },
    ],
  },
  api_keys: {
    label: "مفاتيح API",
    actions: [
      { key: "view", label: "عرض" },
      { key: "create", label: "إنشاء" },
      { key: "delete", label: "حذف" },
    ],
  },
  mcp: {
    label: "خادم MCP",
    actions: [
      { key: "view", label: "عرض" },
      { key: "test", label: "اختبار" },
    ],
  },
  settings: {
    label: "الإعدادات",
    actions: [
      { key: "view", label: "عرض" },
      { key: "edit", label: "تعديل" },
    ],
  },
};

export default function TeamManager() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState<AdminUser | null>(null);
  const [showPermissionsModal, setShowPermissionsModal] = useState<AdminUser | null>(null);

  // Add form
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newRole, setNewRole] = useState<"leader" | "assistant">("assistant");
  const [newPassword, setNewPassword] = useState("");
  const [creating, setCreating] = useState(false);

  // Password form
  const [editPassword, setEditPassword] = useState("");
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  // Permissions form
  const [editPermissions, setEditPermissions] = useState<Permissions>(DEFAULT_PERMISSIONS);
  const [savingPermissions, setSavingPermissions] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setUsers(data.users || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newPhone.trim() || !newPassword.trim()) return;

    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          phone: newPhone.trim(),
          role: newRole,
          password: newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setActionMsg("تم إنشاء الحساب بنجاح! ✅");
      setTimeout(() => setActionMsg(null), 3000);
      setNewName("");
      setNewPhone("");
      setNewPassword("");
      setShowAddModal(false);
      fetchUsers();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showPasswordModal || !editPassword) return;
    if (editPassword.length < 6) {
      setError("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
      return;
    }

    setChangingPassword(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: showPasswordModal.id, password: editPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setActionMsg(`تم تغيير كلمة مرور ${showPasswordModal.name} بنجاح ✅`);
      setTimeout(() => setActionMsg(null), 3000);
      setShowPasswordModal(null);
      setEditPassword("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setChangingPassword(false);
    }
  };

  const handleSavePermissions = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showPermissionsModal) return;

    setSavingPermissions(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: showPermissionsModal.id,
          permissions: editPermissions,
          role: showPermissionsModal.role,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setActionMsg(`تم تحديث أذونات ${showPermissionsModal.name} بنجاح ✅`);
      setTimeout(() => setActionMsg(null), 3000);
      setShowPermissionsModal(null);
      fetchUsers();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingPermissions(false);
    }
  };

  const handleDelete = async (user: AdminUser) => {
    if (!confirm(`هل أنت متأكد من حذف ${user.name || user.phone}؟ لا يمكن التراجع.`)) return;

    try {
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setActionMsg("تم حذف الحساب ✅");
      setTimeout(() => setActionMsg(null), 3000);
      fetchUsers();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const openPermissionsModal = (user: AdminUser) => {
    setShowPermissionsModal(user);
    setEditPermissions(user.permissions || DEFAULT_PERMISSIONS);
  };

  const togglePermission = (resource: string, action: string) => {
    setEditPermissions((prev) => {
      const resourceKey = resource as keyof Permissions;
      const currentResource = prev[resourceKey] as any;
      return {
        ...prev,
        [resource]: {
          ...currentResource,
          [action]: !currentResource[action],
        },
      };
    });
  };

  return (
    <div className="space-y-6">
      {actionMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 text-xs p-3 rounded-xl text-center animate-fade-in">
          {actionMsg}
        </div>
      )}
      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs p-3 rounded-xl text-center">
          {error}
        </div>
      )}

      {/* Users List */}
      <Card className="space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[rgb(var(--border))]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-brand-600/20 text-brand-500 border border-brand-500/30">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base">إدارة الفريق والأذونات</h3>
              <p className="text-xs text-[rgb(var(--text-muted))]">المشرفون وصلاحياتهم</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddModal(true)}
              className="px-3 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-lg shadow-brand-600/20"
            >
              <UserPlus className="w-4 h-4" />
              <span className="hidden sm:inline">إضافة أدمن</span>
            </button>
            <button
              onClick={fetchUsers}
              disabled={loading}
              className="p-2 rounded-lg bg-[rgb(var(--surface-subtle))] hover:bg-[rgb(var(--surface-muted))] transition border border-[rgb(var(--border))] disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8 text-[rgb(var(--text-muted))] gap-2 text-sm">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>جاري التحميل...</span>
          </div>
        ) : users.filter((u) => u.team_member_id).length === 0 ? (
          <p className="text-xs text-[rgb(var(--text-muted))] py-6 text-center">
            لا يوجد مشرفون بعد. اضغط "إضافة أدمن" لإنشاء أول حساب.
          </p>
        ) : (
          <div className="space-y-2">
            {users
              .filter((u) => u.team_member_id)
              .map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-[rgb(var(--surface-subtle))] border border-[rgb(var(--border))] hover:border-[rgb(var(--border-subtle))] transition gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                      user.role === "leader"
                        ? "bg-purple-600/20 text-purple-500 border border-purple-500/30"
                        : "bg-brand-600/15 text-brand-500 border border-brand-500/30"
                    }`}>
                      {user.name?.charAt(0) || user.phone?.charAt(0) || "?"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm truncate">{user.name || "بدون اسم"}</p>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${
                          user.role === "leader"
                            ? "bg-purple-500/10 text-purple-500 border-purple-500/30"
                            : "bg-brand-500/10 text-brand-500 border-brand-500/30"
                        }`}>
                          {user.role === "leader" ? "رئيسي" : "مساعد"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-[rgb(var(--text-muted))]">
                        {user.phone && (
                          <span className="flex items-center gap-1 font-mono">
                            <Phone className="w-3 h-3" />
                            <span dir="ltr">{user.phone}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => setShowPasswordModal(user)}
                      title="تغيير كلمة المرور"
                      className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 transition border border-amber-500/30"
                    >
                      <Key className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => openPermissionsModal(user)}
                      title="تعديل الأذونات"
                      className="p-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-500 transition border border-purple-500/30"
                    >
                      <Shield className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(user)}
                      title="حذف"
                      className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 transition border border-rose-500/30"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}
      </Card>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-brand-600/20 text-brand-500 border border-brand-500/30 flex items-center justify-center">
                  <Shield className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-base">إضافة أدمن جديد</h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg hover:bg-[rgb(var(--surface-subtle))] text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text))]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddUser} className="space-y-3">
              <div>
                <label className="text-xs font-medium mb-1 block">الاسم الكامل *</label>
                <input
                  type="text"
                  placeholder="مثال: أحمد محمد"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                  autoFocus
                  className="w-full bg-[rgb(var(--surface-subtle))] border border-[rgb(var(--border))] rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="text-xs font-medium mb-1 block">رقم الهاتف *</label>
                <input
                  type="tel"
                  placeholder="01012345678"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  required
                  dir="ltr"
                  className="w-full bg-[rgb(var(--surface-subtle))] border border-[rgb(var(--border))] rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-brand-500 text-left font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-medium mb-1 block">كلمة المرور *</label>
                <input
                  type="text"
                  placeholder="6 أحرف على الأقل"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full bg-[rgb(var(--surface-subtle))] border border-[rgb(var(--border))] rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-brand-500 font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-medium mb-1 block">الدور</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as "leader" | "assistant")}
                  className="w-full bg-[rgb(var(--surface-subtle))] border border-[rgb(var(--border))] rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-brand-500"
                >
                  <option value="assistant">مشرف مساعد</option>
                  <option value="leader">ليدر رئيسي (كل الصلاحيات)</option>
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={() => setShowAddModal(false)} className="flex-1">
                  إلغاء
                </Button>
                <Button type="submit" isLoading={creating} className="flex-1">
                  <UserPlus className="w-4 h-4" />
                  إنشاء
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-amber-600/20 text-amber-500 border border-amber-500/30 flex items-center justify-center">
                  <Key className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-base">تغيير كلمة المرور</h3>
              </div>
              <button
                onClick={() => {
                  setShowPasswordModal(null);
                  setEditPassword("");
                }}
                className="p-1 rounded-lg hover:bg-[rgb(var(--surface-subtle))] text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text))]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[rgb(var(--text-muted))]">
              تغيير كلمة مرور: <span className="font-semibold text-[rgb(var(--text))]">{showPasswordModal.name}</span>
              {showPasswordModal.phone && (
                <span className="block mt-1 font-mono" dir="ltr">{showPasswordModal.phone}</span>
              )}
            </p>

            <form onSubmit={handleChangePassword} className="space-y-3">
              <div>
                <label className="text-xs font-medium mb-1 block">كلمة المرور الجديدة</label>
                <div className="relative">
                  <input
                    type={showEditPassword ? "text" : "password"}
                    placeholder="6 أحرف على الأقل"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    required
                    autoFocus
                    minLength={6}
                    className="w-full bg-[rgb(var(--surface-subtle))] border border-[rgb(var(--border))] rounded-xl px-3.5 py-2.5 pr-10 text-sm focus:outline-none focus:border-amber-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditPassword(!showEditPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text))]"
                    tabIndex={-1}
                  >
                    {showEditPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setShowPasswordModal(null);
                    setEditPassword("");
                  }}
                  className="flex-1"
                >
                  إلغاء
                </Button>
                <Button type="submit" isLoading={changingPassword} className="flex-1">
                  <Key className="w-4 h-4" />
                  حفظ
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Permissions Modal */}
      {showPermissionsModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[rgb(var(--surface))] border border-[rgb(var(--border))] rounded-2xl p-6 max-w-2xl w-full space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between sticky top-0 bg-[rgb(var(--surface))] pb-3 border-b border-[rgb(var(--border))] z-10">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-purple-600/20 text-purple-500 border border-purple-500/30 flex items-center justify-center">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base">إدارة الأذونات</h3>
                  <p className="text-xs text-[rgb(var(--text-muted))]">{showPermissionsModal.name}</p>
                </div>
              </div>
              <button
                onClick={() => setShowPermissionsModal(null)}
                className="p-1 rounded-lg hover:bg-[rgb(var(--surface-subtle))] text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text))]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {showPermissionsModal.role === "leader" && (
              <div className="bg-purple-500/10 border border-purple-500/30 p-3 rounded-xl text-xs text-purple-500">
                <Shield className="w-4 h-4 inline ml-1" />
                هذا المستخدم leader — لديه كل الصلاحيات تلقائياً
              </div>
            )}

            <form onSubmit={handleSavePermissions} className="space-y-3">
              {Object.entries(PERMISSION_LABELS).map(([resource, config]) => (
                <div key={resource} className="bg-[rgb(var(--surface-subtle))] border border-[rgb(var(--border))] rounded-xl p-3">
                  <p className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                    <Lock className="w-3 h-3 text-brand-500" />
                    {config.label}
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {config.actions.map((action) => {
                      const isChecked = showPermissionsModal.role === "leader"
                        ? true
                        : (editPermissions[resource as keyof Permissions] as any)?.[action.key] || false;
                      return (
                        <label
                          key={action.key}
                          className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition border ${
                            isChecked
                              ? "bg-emerald-500/10 border-emerald-500/30"
                              : "bg-[rgb(var(--surface))] border-[rgb(var(--border))]"
                          } ${showPermissionsModal.role === "leader" ? "opacity-50 cursor-not-allowed" : ""}`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => togglePermission(resource, action.key)}
                            disabled={showPermissionsModal.role === "leader"}
                            className="rounded"
                          />
                          <span className="text-[11px]">{action.label}</span>
                          {isChecked && (
                            <Check className="w-3 h-3 text-emerald-500 mr-auto" />
                          )}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}

              <div className="flex gap-2 pt-2 sticky bottom-0 bg-[rgb(var(--surface))]">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowPermissionsModal(null)}
                  className="flex-1"
                >
                  إلغاء
                </Button>
                <Button
                  type="submit"
                  isLoading={savingPermissions}
                  disabled={showPermissionsModal.role === "leader"}
                  className="flex-1"
                >
                  <Shield className="w-4 h-4" />
                  حفظ الأذونات
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MCP Server Status (compact) */}
      <Card className="space-y-3 bg-purple-950/10 border-purple-900/30">
        <div className="flex items-center gap-2.5 pb-2 border-b border-purple-900/30">
          <div className="p-2 rounded-xl bg-purple-600/20 text-purple-500 border border-purple-500/30">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-purple-300 text-base">خادم MCP</h3>
            <p className="text-xs text-[rgb(var(--text-muted))]">حالة الخدمة والروابط</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
          <div className="p-2.5 rounded-xl bg-[rgb(var(--surface-subtle))] border border-[rgb(var(--border))]">
            <p className="text-[10px] text-[rgb(var(--text-muted))] mb-1">Cloudflare</p>
            <code className="text-purple-400 font-mono text-[10px]">/api/mcp</code>
          </div>
          <div className="p-2.5 rounded-xl bg-[rgb(var(--surface-subtle))] border border-[rgb(var(--border))]">
            <p className="text-[10px] text-[rgb(var(--text-muted))] mb-1">Supabase</p>
            <code className="text-purple-400 font-mono text-[10px]">/functions/v1/mcp</code>
          </div>
          <div className="p-2.5 rounded-xl bg-[rgb(var(--surface-subtle))] border border-[rgb(var(--border))]">
            <p className="text-[10px] text-[rgb(var(--text-muted))] mb-1">Local stdio</p>
            <code className="text-purple-400 font-mono text-[10px]">npm run mcp:start</code>
          </div>
        </div>

        <div className="flex items-start gap-2 text-[11px] text-purple-200/70 bg-purple-950/30 p-2.5 rounded-xl border border-purple-500/20">
          <Sparkles className="w-3.5 h-3.5 text-purple-400 mt-0.5 flex-shrink-0" />
          <span>
            خادم MCP لربط ChatGPT/Claude. أنشئ مفتاح API من تبويب "مفاتيح API".
          </span>
        </div>
      </Card>
    </div>
  );
}
