import Link from "next/link";
import { BookOpen, ArrowLeft } from "lucide-react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden bg-[rgb(var(--bg))]">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-brand-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="absolute top-4 left-4 z-20">
        <ThemeToggle />
      </div>

      <div className="max-w-md w-full text-center space-y-8 relative z-10 animate-slide-up">
        <div className="space-y-4">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl gradient-brand text-white shadow-xl shadow-brand-600/30">
            <BookOpen className="w-10 h-10" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-l from-brand-500 to-indigo-500 bg-clip-text text-transparent">
              منصة الدفعة
            </h1>
            <p className="text-[rgb(var(--text-muted))] text-sm max-w-xs mx-auto mt-2">
              المستجدات الأكاديمية والجداول والتكليفات في مكان واحد
            </p>
          </div>
        </div>

        <Link
          href="/student"
          className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl gradient-brand text-white font-semibold transition-all shadow-lg shadow-brand-600/30 hover:shadow-glow-lg hover:-translate-y-0.5"
        >
          <span>دخول واجهة الطلاب</span>
          <ArrowLeft className="w-4 h-4" />
        </Link>
      </div>
    </main>
  );
}
