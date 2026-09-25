import Link from "next/link";
import {
  Shield,
  Sparkles,
  Bell,
  Calendar,
  HelpCircle,
  CheckCircle2,
  ArrowLeft,
  Smartphone,
} from "lucide-react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden bg-[rgb(var(--bg))]">
      {/* خلفية زخرفية */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-brand-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* زرار الـ Theme Toggle - في الزاوية */}
      <div className="absolute top-4 left-4 z-20">
        <ThemeToggle />
      </div>

      <div className="max-w-2xl w-full text-center space-y-8 relative z-10">
        {/* Status Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-panel text-brand-500 text-sm font-medium border border-brand-500/20 shadow-lg shadow-brand-500/10 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>منصة إدارة الدفعة — جاهزة للاستخدام</span>
        </div>

        {/* Hero Title */}
        <div className="space-y-4 animate-slide-up">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-brand-500 to-indigo-600 text-white shadow-xl shadow-brand-600/30 mb-2">
            <Sparkles className="w-10 h-10" />
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight leading-tight bg-gradient-to-l from-brand-500 to-indigo-500 bg-clip-text text-transparent">
            منصة إدارة الدفعة
          </h1>
          <p className="text-[rgb(var(--text-muted))] text-lg max-w-xl mx-auto leading-relaxed">
            الحل التقني الذكي لتنظيم العمليات الأكاديمية والطلابية، تجميع الجداول والإعلانات، وإدارة
            استفسارات الطلاب بسرعة وكفاءة.
          </p>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-right animate-slide-up" style={{ animationDelay: "100ms" }}>
          <div className="glass-card p-4 rounded-2xl space-y-2 group">
            <div className="w-10 h-10 rounded-xl bg-brand-500/15 text-brand-500 border border-brand-500/25 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Bell className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-sm">الإعلانات</h3>
            <p className="text-xs text-[rgb(var(--text-muted))]">تحديثات وإشعارات عاجلة</p>
          </div>
          <div className="glass-card p-4 rounded-2xl space-y-2 group">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-500 border border-amber-500/25 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Calendar className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-sm">التكليفات</h3>
            <p className="text-xs text-[rgb(var(--text-muted))]">مواعيد التسليم النهائية</p>
          </div>
          <div className="glass-card p-4 rounded-2xl space-y-2 group">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-500 border border-emerald-500/25 flex items-center justify-center group-hover:scale-110 transition-transform">
              <HelpCircle className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-sm">الاستفسارات</h3>
            <p className="text-xs text-[rgb(var(--text-muted))]">تواصل فوري بدون تسجيل</p>
          </div>
          <div className="glass-card p-4 rounded-2xl space-y-2 group">
            <div className="w-10 h-10 rounded-xl bg-purple-500/15 text-purple-500 border border-purple-500/25 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Smartphone className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-sm">الذكاء الاصطناعي</h3>
            <p className="text-xs text-[rgb(var(--text-muted))]">MCP + ChatGPT</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 animate-slide-up" style={{ animationDelay: "200ms" }}>
          <Link
            href="/student"
            className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-brand-600 hover:bg-brand-500 text-white font-semibold transition-all shadow-lg shadow-brand-600/30 hover:shadow-brand-600/40 hover:-translate-y-0.5 flex items-center justify-center gap-2"
          >
            <span>واجهة الطلاب</span>
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <Link
            href="/admin"
            className="w-full sm:w-auto px-6 py-3.5 rounded-2xl glass-panel hover:bg-[rgb(var(--surface-subtle))] text-[rgb(var(--text))] font-semibold transition-all border border-[rgb(var(--border))] hover:-translate-y-0.5 flex items-center justify-center gap-2"
          >
            <Shield className="w-4 h-4 text-brand-500" />
            <span>لوحة تحكم الأدمن</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
