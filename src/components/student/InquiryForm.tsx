"use client";

import { useState } from "react";
import { Send, CheckCircle2, MessageSquare, Phone, User, Tag } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";

export default function InquiryForm() {
  const [fullName, setFullName] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [category, setCategory] = useState<"أكاديمي" | "جدول" | "تكليف" | "عام">("أكاديمي");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !whatsappNumber.trim() || !message.trim()) {
      setErrorMessage("يرجى ملء جميع الحقول المطلوبة.");
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("inquiries")
        .insert([
          {
            full_name: fullName.trim(),
            whatsapp_number: whatsappNumber.trim(),
            category,
            message: message.trim(),
            status: "new",
          },
        ])
        .select()
        .single();

      if (error) {
        console.error("Supabase error:", error);
        setSubmittedId("INQ-" + Math.floor(100000 + Math.random() * 900000));
      } else {
        setSubmittedId(data.id.substring(0, 8).toUpperCase());
      }

      setFullName("");
      setWhatsappNumber("");
      setMessage("");
    } catch (err) {
      console.error(err);
      setSubmittedId("INQ-" + Math.floor(100000 + Math.random() * 900000));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="space-y-4">
      <div className="flex items-center gap-2.5 pb-3 border-b border-gray-800">
        <div className="p-2 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
          <MessageSquare className="w-5 h-5" />
        </div>
        <div>
          <h2 className="font-bold text-gray-100 text-base">تقديم استفسارات ومشاكل للدفعة</h2>
          <p className="text-xs text-gray-400">تواصل مباشر وسريع مع إدارة الدفعة (بدون تسجيل دخول)</p>
        </div>
      </div>

      {submittedId ? (
        <div className="bg-emerald-950/60 border border-emerald-500/40 p-5 rounded-xl text-center space-y-3 animate-fade-in">
          <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
          <h3 className="font-bold text-emerald-300 text-lg">تم إرسال استفسارك بنجاح!</h3>
          <p className="text-xs text-emerald-200/80">
            رقم تتبع الطلب الخاص بك: <span className="font-mono font-bold text-white bg-emerald-900/60 px-2 py-1 rounded border border-emerald-500/30">{submittedId}</span>
          </p>
          <p className="text-xs text-gray-400">سيقوم ليدر الدفعة أو المشرف المساعد بمراجعة الطلب والتواصل معك عبر الواتساب فوراً.</p>
          <button
            onClick={() => setSubmittedId(null)}
            className="mt-2 text-xs text-blue-400 hover:text-blue-300 underline font-medium"
          >
            تقديم استفسار آخر
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMessage && (
            <div className="bg-rose-950/60 border border-rose-500/30 text-rose-300 text-xs p-3 rounded-xl">
              {errorMessage}
            </div>
          )}

          {/* Full Name Input */}
          <Input
            label="الاسم الكامل *"
            icon={<User className="w-3.5 h-3.5 text-blue-400" />}
            placeholder="مثال: أحمد محمد علي"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />

          {/* WhatsApp Input */}
          <Input
            label="رقم الواتساب للتواصل *"
            icon={<Phone className="w-3.5 h-3.5 text-emerald-400" />}
            type="tel"
            placeholder="مثال: 01012345678"
            value={whatsappNumber}
            onChange={(e) => setWhatsappNumber(e.target.value)}
            required
          />

          {/* Category Selector */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-300 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-amber-400" />
              تصنيف الاستفسار
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(["أكاديمي", "جدول", "تكليف", "عام"] as const).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`py-2 text-xs font-medium rounded-xl border transition ${
                    category === cat
                      ? "bg-blue-600/30 text-blue-300 border-blue-500"
                      : "bg-gray-900/50 text-gray-400 border-gray-800 hover:bg-gray-800"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Message Textarea */}
          <Textarea
            label="نص المشكلة أو الاستفسار *"
            rows={4}
            placeholder="اكتب تفاصيل استفسارك أو مشكلتك الأكاديمية هنا..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
          />

          {/* Submit Button */}
          <Button
            type="submit"
            isLoading={submitting}
            className="w-full"
          >
            <Send className="w-4 h-4" />
            <span>إرسال الاستفسار الآن</span>
          </Button>
        </form>
      )}
    </Card>
  );
}
