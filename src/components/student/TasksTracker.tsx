"use client";

import { useEffect, useState } from "react";
import { Clock, Calendar, CheckCircle, AlertTriangle } from "lucide-react";
import { Task } from "@/types/database";
import { createClient } from "@/lib/supabase/client";

const defaultTasks: Task[] = [
  {
    id: "1",
    subject: "الذكاء الاصطناعي",
    title: "تطبيق نموذج التصنيف باستخدام Python",
    description: "تسليم المشروع البرمجي المصغر لتصنيف البيانات باستخدام Scikit-learn ورسومات البياني.",
    deadline: new Date(Date.now() + 3600000 * 36).toISOString(),
    status: "active",
    created_at: new Date().toISOString(),
  },
  {
    id: "2",
    subject: "قواعد البيانات",
    title: "تصميم مخطط ERD ورسومات العلاقات",
    description: "إعداد ملف PDF يوضح مخطط الكائنات والعلاقات لنظام إدارة مستشفى.",
    deadline: new Date(Date.now() + 3600000 * 96).toISOString(),
    status: "active",
    created_at: new Date().toISOString(),
  },
  {
    id: "3",
    subject: "شبكات الحاسوب",
    title: "تقرير بروتوكولات TCP/IP",
    description: "إعداد تقرير من 3 صفحات حول الفرق بين TCP و UDP مع أمثلة عملية.",
    deadline: new Date(Date.now() - 3600000 * 12).toISOString(),
    status: "closed",
    created_at: new Date().toISOString(),
  },
];

export default function TasksTracker() {
  const [tasks, setTasks] = useState<Task[]>(defaultTasks);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function fetchTasks() {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("tasks")
          .select("*")
          .order("deadline", { ascending: true });

        if (!error && data && data.length > 0) {
          setTasks(data);
        }
      } catch (err) {
        console.error("Error fetching tasks:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchTasks();
  }, []);

  const getUrgencyBadge = (deadlineStr: string, status: string) => {
    if (status === "closed") {
      return {
        text: "منتهي",
        class: "bg-gray-800 text-gray-400 border-gray-700",
        icon: CheckCircle,
      };
    }

    const diffMs = new Date(deadlineStr).getTime() - Date.now();
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours < 0) {
      return {
        text: "انتهى وقت التسليم",
        class: "bg-rose-500/10 text-rose-400 border-rose-500/30",
        icon: AlertTriangle,
      };
    } else if (diffHours <= 24) {
      return {
        text: `متبقي ${Math.round(diffHours)} ساعة (عاجل)`,
        class: "bg-amber-500/10 text-amber-400 border-amber-500/30 animate-pulse",
        icon: Clock,
      };
    } else {
      const days = Math.round(diffHours / 24);
      return {
        text: `متبقي ${days} أيام`,
        class: "bg-blue-500/10 text-blue-400 border-blue-500/30",
        icon: Calendar,
      };
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-gray-100">التكليفات والمهام الأكاديمية</h2>
        <span className="text-xs text-blue-400 font-medium">إجمالي: {tasks.length} مهام</span>
      </div>

      <div className="space-y-3">
        {tasks.map((task) => {
          const urgency = getUrgencyBadge(task.deadline, task.status);
          const UrgencyIcon = urgency.icon;

          return (
            <div
              key={task.id}
              className="glass-card p-4 rounded-2xl space-y-3 border border-gray-800/80 hover:border-blue-500/30 transition"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-blue-600/20 text-blue-300 border border-blue-500/30">
                  {task.subject}
                </span>

                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${urgency.class}`}>
                  <UrgencyIcon className="w-3.5 h-3.5" />
                  <span>{urgency.text}</span>
                </div>
              </div>

              <div>
                <h3 className="font-bold text-gray-100 text-base">{task.title}</h3>
                {task.description && (
                  <p className="text-gray-400 text-xs mt-1 leading-relaxed">{task.description}</p>
                )}
              </div>

              <div className="pt-2 border-t border-gray-800/60 flex items-center justify-between text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-gray-400" />
                  موعد التسليم: {new Date(task.deadline).toLocaleDateString("ar-EG", {
                    weekday: "long",
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
