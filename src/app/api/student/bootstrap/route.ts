import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ==========================================
// GET /api/student/bootstrap
// ريكوست واحد يجيب كل محتوى صفحة الطالب دفعة واحدة:
// الإعلانات + الجدول الأسبوعي + التكليفات + الروابط السريعة + المواعيد المهمة
// بدل 5-7 ريكوستات منفصلة من المتصفح — كل الاستعلامات بتيجي متوازية من السيرفر
// بيانات عامة (نفس RLS القراءة العامة) — قابلة للكاش على الحافة
// ==========================================

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();
    const nowISO = new Date().toISOString();

    // كل الاستعلامات متوازية — أسرع ريكوست منفرد ممكن
    const [annRes, schedRes, tasksRes, linksRes, datesRes, catsRes] = await Promise.all([
      // الإعلانات: المثبت الأول ثم الأحدث
      supabase
        .from("announcements")
        .select("*")
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false }),
      // الجدول الأسبوعي النشط: اليوم ثم الوقت
      supabase
        .from("schedules")
        .select("*, subjects(name, color)")
        .eq("is_active", true)
        .order("day_of_week")
        .order("start_time"),
      // التكليفات النشطة: من الأقرب انتهاءً
      supabase
        .from("tasks")
        .select("*")
        .eq("status", "active")
        .order("deadline", { ascending: true }),
      // الروابط السريعة
      supabase.from("quick_links").select("*").order("order_index", { ascending: true }),
      // المواعيد المهمة القادمة (أول 10)
      supabase
        .from("important_dates")
        .select("*, subjects(*)")
        .gte("date", nowISO)
        .order("date", { ascending: true })
        .limit(10),
      // التصنيفات النشطة (إعلانات + استفسارات) — للفورم والفلاتر
      // لو الميجيشن مش متشغّل، الخطأ هنا مش هيوقف الرست — الفرونت يرجع للافتراضي
      supabase
        .from("categories")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
    ]);

    // لو كل الاستعلامات فشلت (مثلاً Supabase نازل) — رجّع خطأ واضح بدل داتا فاضية
    if (annRes.error && schedRes.error && tasksRes.error && linksRes.error && datesRes.error) {
      throw new Error(annRes.error.message || "فشل تحميل المحتوى");
    }

    const body = {
      announcements: annRes.data || [],
      schedules: schedRes.data || [],
      tasks: tasksRes.data || [],
      links: linksRes.data || [],
      important_dates: datesRes.data || [],
      categories: catsRes.data || [],
      generated_at: new Date().toISOString(),
    };

    return NextResponse.json(body, {
      headers: {
        // كاش حافة قصير + stale-while-revalidate — سرعة موبايل بدون فقدان تحديثات الأدمن
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "فشل تحميل المحتوى";
    console.error("GET /api/student/bootstrap error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
