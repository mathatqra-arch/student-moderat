"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Calendar, Users, FolderKanban, BookOpen } from "lucide-react";
import { QuickLink } from "@/types/database";
import { createClient } from "@/lib/supabase/client";

const defaultLinks: QuickLink[] = [
  {
    id: "1",
    title: "📅 الجدول الدراسي الرسمي (الفصل الدراسي)",
    url: "https://drive.google.com",
    type: "schedule",
    order_index: 1,
    created_at: new Date().toISOString(),
  },
  {
    id: "2",
    title: "💬 جروب الواتساب الرسمي للدفعة",
    url: "https://chat.whatsapp.com",
    type: "group",
    order_index: 2,
    created_at: new Date().toISOString(),
  },
  {
    id: "3",
    title: "📂 مجلد الدرايف الشامل (المحاضرات والسلايدات)",
    url: "https://drive.google.com",
    type: "drive",
    order_index: 3,
    created_at: new Date().toISOString(),
  },
  {
    id: "4",
    title: "📖 المراجع والكتب الأكاديمية المقررة",
    url: "https://drive.google.com",
    type: "material",
    order_index: 4,
    created_at: new Date().toISOString(),
  },
];

export default function QuickLinksSection() {
  const [links, setLinks] = useState<QuickLink[]>(defaultLinks);

  useEffect(() => {
    async function fetchLinks() {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("quick_links")
          .select("*")
          .order("order_index", { ascending: true });

        if (!error && data && data.length > 0) {
          setLinks(data);
        }
      } catch (err) {
        console.error("Error fetching links:", err);
      }
    }

    fetchLinks();
  }, []);

  const getLinkIcon = (type: string) => {
    switch (type) {
      case "schedule":
        return <Calendar className="w-5 h-5 text-amber-400" />;
      case "group":
        return <Users className="w-5 h-5 text-emerald-400" />;
      case "drive":
        return <FolderKanban className="w-5 h-5 text-blue-400" />;
      default:
        return <BookOpen className="w-5 h-5 text-purple-400" />;
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-gray-100">الوصول السريع للجداول والمجموعات</h2>
      </div>

      <div className="grid grid-cols-1 gap-2.5">
        {links.map((link) => (
          <a
            key={link.id}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="glass-card p-4 rounded-2xl flex items-center justify-between group border border-gray-800 hover:border-blue-500/40 transition"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gray-900 border border-gray-800 group-hover:border-blue-500/30 transition">
                {getLinkIcon(link.type)}
              </div>
              <span className="font-semibold text-gray-200 text-sm group-hover:text-blue-400 transition">
                {link.title}
              </span>
            </div>
            <ExternalLink className="w-4 h-4 text-gray-500 group-hover:text-blue-400 transition" />
          </a>
        ))}
      </div>
    </div>
  );
}
