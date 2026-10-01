"use client";

import { useEffect, useState } from "react";
import { Inquiry } from "@/types/database";
import { MessageSquare, Phone, CheckCircle, Clock, Archive, Sparkles, Filter, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { whatsappChatUrl, whatsappDirectChatUrl, buildInquiryReplyMessage, isDesktopDevice, isValidWhatsappNumber } from "@/lib/whatsapp";

const defaultInquiries: Inquiry[] = [
  {
    id: "inq-101",
    full_name: "محمد علي حسن",
    whatsapp_number: "201012345678",
    category: "جدول",
    message: "استفسار بخصوص قاعة امتحان مادة الذكاء الاصطناعي يوم الخميس، هل تغيرت القاعة؟",
    status: "new",
    ai_suggestion: "تم التثبيت: قاعة الامتحانات لم تتغير وهي قاعة (ب3) بالمبنى الرئيسي.",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "inq-102",
    full_name: "سارة أحمد محمود",
    whatsapp_number: "201198765432",
    category: "تكليف",
    message: "هل يمكن تمديد مهلة تسليم مشروعات قواعد البيانات لمدة 24 ساعة إضافية؟",
    status: "in_progress",
    ai_suggestion: "اقتراح: التواصل مع الدكتور أولاً وتحديد تمديد جماعي إذا وافق.",
    created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export default function InquiriesManager() {
  const [inquiries, setInquiries] = useState<Inquiry[]>(defaultInquiries);
  const [filter, setFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  // على الكمبيوتر نستخدم web.whatsapp.com لفتح الشات فوراً بدون صفحة وسيطة
  // (useState بعد التركيب لتجنب اختلاف الـ hydration)
  const [preferWeb, setPreferWeb] = useState(false);

  useEffect(() => {
    setPreferWeb(isDesktopDevice());
  }, []);

  useEffect(() => {
    async function loadInquiries() {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("inquiries")
          .select("*")
          .order("created_at", { ascending: false });

        if (!error && data && data.length > 0) {
          setInquiries(data);
        }
      } catch (err) {
        console.error("Error loading inquiries:", err);
      } finally {
        setLoading(false);
      }
    }

    loadInquiries();
  }, []);

  const updateStatus = async (id: string, newStatus: Inquiry["status"]) => {
    setInquiries((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: newStatus } : item))
    );

    try {
      const supabase = createClient();
      await supabase
        .from("inquiries")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", id);
    } catch (err) {
      console.error(err);
    }
  };

  const filteredInquiries = filter === "all"
    ? inquiries
    : inquiries.filter((item) => item.status === filter);

  const getStatusBadge = (status: Inquiry["status"]) => {
    switch (status) {
      case "new":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30">جديد</span>;
      case "in_progress":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">قيد المعالجة</span>;
      case "resolved":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">تم الحل</span>;
      case "archived":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-800 text-gray-400 border border-gray-700">مؤرشف</span>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Header & Filter Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-900/60 p-4 rounded-2xl border border-gray-800">
        <div>
          <h2 className="text-lg font-bold text-gray-100 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-blue-400" />
            إدارة طلبات واستفسارات الطلاب
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">عرض الطلبات والرد المباشر عبر الواتساب واقتراحات الذكاء الاصطناعي</p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {[
            { id: "all", label: "الكل" },
            { id: "new", label: "جديد" },
            { id: "in_progress", label: "قيد المعالجة" },
            { id: "resolved", label: "تم الحل" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition ${
                filter === tab.id
                  ? "bg-blue-600 text-white"
                  : "bg-gray-800/80 text-gray-400 hover:text-gray-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Inquiries Cards */}
      <div className="space-y-3">
        {filteredInquiries.map((inquiry) => {
          const waValid = isValidWhatsappNumber(inquiry.whatsapp_number);
          const directChatHref = waValid ? whatsappDirectChatUrl(inquiry.whatsapp_number, { preferWeb }) : "";
          const messageChatHref = waValid
            ? whatsappChatUrl(inquiry.whatsapp_number, buildInquiryReplyMessage(inquiry), { preferWeb })
            : "";
          return (
          <div
            key={inquiry.id}
            className="glass-card p-5 rounded-2xl border border-gray-800 space-y-3 relative hover:border-blue-500/30 transition"
          >
            <div className="flex items-start justify-between gap-3 border-b border-gray-800/80 pb-3">
              {/* الاسم + الرقم + التصنيف — عمود مرتب بدل صف مزدحم */}
              <div className="min-w-0 space-y-1.5">
                {waValid ? (
                  <a
                    href={directChatHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="فتح شات واتساب مع الطالب فوراً"
                    className="inline-flex items-center gap-1.5 font-bold text-gray-100 text-base hover:text-emerald-400 transition underline decoration-emerald-500/40 decoration-dotted underline-offset-4"
                  >
                    {inquiry.full_name}
                  </a>
                ) : (
                  <span
                    title={`الرقم غير صالح للواتساب: ${inquiry.whatsapp_number || "فارغ"}`}
                    className="inline-flex items-center gap-1.5 font-bold text-gray-100 text-base"
                  >
                    {inquiry.full_name}
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                  </span>
                )}

                <div className="flex items-center gap-1.5 flex-wrap">
                  {/* الرقم كما حُفظ — للتشخيص السريع */}
                  <span
                    dir="ltr"
                    className={`inline-flex items-center gap-1 text-2xs font-mono px-2 py-0.5 rounded-lg border max-w-full ${
                      waValid
                        ? "text-gray-400 bg-gray-900/70 border-gray-800"
                        : "text-amber-400 bg-amber-950/40 border-amber-500/30"
                    }`}
                  >
                    <Phone className="w-2.5 h-2.5 flex-shrink-0" />
                    <span className="truncate">{inquiry.whatsapp_number || "لا يوجد رقم"}</span>
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-lg bg-gray-800 text-blue-400 border border-gray-700">
                    {inquiry.category}
                  </span>
                </div>
              </div>

              <div className="flex-shrink-0 pt-0.5">{getStatusBadge(inquiry.status)}</div>
            </div>

            <p className="text-gray-300 text-sm leading-relaxed">{inquiry.message}</p>

            {/* AI Suggested Response Box */}
            {inquiry.ai_suggestion && (
              <div className="bg-purple-950/30 border border-purple-500/30 p-3 rounded-xl space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-purple-300 font-semibold">
                  <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                  <span>اقتراح رد الذكاء الاصطناعي (MCP Suggested Reply):</span>
                </div>
                <p className="text-xs text-purple-200/90">{inquiry.ai_suggestion}</p>
              </div>
            )}

            {/* Actions Bar */}
            <div className="pt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 text-xs border-t border-gray-800/60">
              <span className="text-gray-500 whitespace-nowrap">
                التاريخ: {new Date(inquiry.created_at).toLocaleString("ar-EG", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
              </span>

              <div className="flex items-center gap-2 flex-wrap">
                {/* WhatsApp Direct Chat Button — يفتح الشات مع الطالب علطول برسالة مثبتة تتضمن مشكلته والرد */}
                {waValid ? (
                  <a
                    href={messageChatHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center gap-1.5 transition shadow-sm shadow-emerald-600/20"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>مراسلة عبر الواتساب</span>
                  </a>
                ) : (
                  <span
                    title={`مش رقم واتساب صالح: ${inquiry.whatsapp_number || "فارغ"}`}
                    className="px-3 py-1.5 rounded-xl bg-gray-800 text-gray-500 font-semibold flex items-center gap-1.5 cursor-not-allowed"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>رقم غير صالح</span>
                  </span>
                )}

                {/* Status Dropdown */}
                <select
                  value={inquiry.status}
                  onChange={(e) => updateStatus(inquiry.id, e.target.value as Inquiry["status"])}
                  className="bg-gray-900 border border-gray-800 rounded-xl px-2.5 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
                >
                  <option value="new">جديد</option>
                  <option value="in_progress">قيد المعالجة</option>
                  <option value="resolved">تم الحل</option>
                  <option value="archived">أرشفة</option>
                </select>
              </div>
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
}
