"use client";

import { useEffect, useState } from "react";
import { Pin, Clock } from "lucide-react";
import { Announcement } from "@/types/database";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

const defaultAnnouncements: Announcement[] = [
  {
    id: "1",
    title: "📢 الجدول النهائي لامتحانات منتصف الفصل (Midterm)",
    content: "تم نشر جدول الامتحانات المعتمد رسمياً لجميع التخصصات. نرجو مراجعة القاعات والأوقات المحددة عبر قسم الروابط السريعة.",
    category: "عاجل",
    is_pinned: true,
    created_at: new Date().toISOString(),
  },
  {
    id: "2",
    title: "📚 تسليم أبحاث مادة الذكاء الاصطناعي والشبكات",
    content: "تنويه هام من الدكتور: آخر موعد لتسليم أبحاث مادة الذكاء الاصطناعي هو يوم الخميس القادم الساعة 11:59 مساءً.",
    category: "أكاديمي",
    is_pinned: false,
    created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
  },
  {
    id: "3",
    title: "🎓 محاضرة تعويضية يوم السبت القادم",
    content: "تقرر عقد محاضرة تعويضية لمادة قواعد البيانات الساعة 10:00 صباحاً أونلاين عبر المنصة الرسمية.",
    category: "هام",
    is_pinned: false,
    created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
  },
];

export default function AnnouncementsFeed() {
  const [announcements, setAnnouncements] = useState<Announcement[]>(defaultAnnouncements);
  const [filter, setFilter] = useState<string>("الكل");
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function fetchAnnouncements() {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("announcements")
          .select("*")
          .order("is_pinned", { ascending: false })
          .order("created_at", { ascending: false });

        if (!error && data && data.length > 0) {
          setAnnouncements(data);
        }
      } catch (err) {
        console.error("Error loading announcements:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchAnnouncements();
  }, []);

  const filteredItems = filter === "الكل" 
    ? announcements 
    : announcements.filter(item => item.category === filter);

  const getBadgeVariant = (category: string) => {
    switch (category) {
      case "عاجل": return "rose";
      case "أكاديمي": return "blue";
      case "هام": return "amber";
      default: return "gray";
    }
  };

  return (
    <div className="space-y-4">
      {/* Category Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        {["الكل", "عاجل", "أكاديمي", "هام", "عام"].map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition ${
              filter === cat
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                : "bg-gray-800/80 text-gray-400 hover:text-white hover:bg-gray-700/60"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Announcements List */}
      <div className="space-y-3">
        {filteredItems.map((item) => (
          <Card
            key={item.id}
            className={`relative space-y-2 border ${
              item.is_pinned ? "border-blue-500/40 bg-blue-950/20" : "border-gray-800/60"
            }`}
          >
            {item.is_pinned && (
              <div className="absolute top-3 left-3 flex items-center gap-1 text-xs text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                <Pin className="w-3 h-3 fill-current" />
                <span>مثبت</span>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Badge variant={getBadgeVariant(item.category)}>
                {item.category}
              </Badge>
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {new Date(item.created_at).toLocaleDateString("ar-EG", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>

            <h3 className="font-bold text-gray-100 text-base leading-snug">{item.title}</h3>
            <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-line">{item.content}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
