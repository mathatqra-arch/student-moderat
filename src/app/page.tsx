import Link from "next/link";
import { Shield, Sparkles, Bell, Calendar, HelpCircle, CheckCircle2 } from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden bg-gradient-to-b from-dark-bg via-[#0d1322] to-dark-bg">
      {/* Background Decorative Blur */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-2xl w-full text-center space-y-8 relative z-10">
        {/* Status Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-panel text-blue-400 text-sm font-medium border border-blue-500/20 shadow-lg shadow-blue-500/10">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>تم إنجاز المرحلة الأولى: تهيئة المشروع والبنية التحتية بنجاح</span>
        </div>

        {/* Hero Title */}
        <div className="space-y-4">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white leading-tight">
            منصة إدارة الدفعة <span className="bg-gradient-to-l from-blue-400 to-indigo-500 bg-clip-text text-transparent">(Batch Platform)</span>
          </h1>
          <p className="text-gray-400 text-lg max-w-xl mx-auto">
            الحل التقني الذكي لتنظيم العمليات الأكاديمية والطلابية، تجميع الجداول والإعلانات، وإدارة استفسارات الطلاب بسرعة وكفاءة.
          </p>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-right">
          <div className="glass-card p-4 rounded-xl space-y-2">
            <Bell className="w-6 h-6 text-blue-400" />
            <h3 className="font-semibold text-white text-sm">الإعلانات</h3>
            <p className="text-xs text-gray-400">تحديثات وإشعارات عاجلة</p>
          </div>
          <div className="glass-card p-4 rounded-xl space-y-2">
            <Calendar className="w-6 h-6 text-amber-400" />
            <h3 className="font-semibold text-white text-sm">التكليفات</h3>
            <p className="text-xs text-gray-400">مواعيد التسليم النهائية</p>
          </div>
          <div className="glass-card p-4 rounded-xl space-y-2">
            <HelpCircle className="w-6 h-6 text-emerald-400" />
            <h3 className="font-semibold text-white text-sm">الاستفسارات</h3>
            <p className="text-xs text-gray-400">تواصل فوري No-Auth</p>
          </div>
          <div className="glass-card p-4 rounded-xl space-y-2">
            <Sparkles className="w-6 h-6 text-purple-400" />
            <h3 className="font-semibold text-white text-sm">الذكاء الاصطناعي</h3>
            <p className="text-xs text-gray-400">تحليل وإجابات ذكية</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <Link
            href="/student"
            className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2"
          >
            واجهة الطلاب (PWA)
          </Link>
          <Link
            href="/admin"
            className="w-full sm:w-auto px-6 py-3.5 rounded-xl glass-panel hover:bg-gray-800 text-gray-200 font-semibold transition border border-gray-700 flex items-center justify-center gap-2"
          >
            <Shield className="w-4 h-4 text-gray-400" />
            لوحة تحكم الأدمن
          </Link>
        </div>
      </div>
    </main>
  );
}
