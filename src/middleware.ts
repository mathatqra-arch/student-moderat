import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// ==========================================
// Middleware - حماية صفحات /admin ومسارات /api/admin
// ==========================================

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://apcxwxnkntegbkimsmty.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// المسارات المحمية
const PROTECTED_PATHS = ["/admin"];
const PROTECTED_API_PATHS = ["/api/admin"];

// استثناءات (لا تتطلب تسجيل دخول)
const PUBLIC_PATHS = ["/admin/login", "/api/admin/login", "/api/admin/health"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. تحقق من صفحات /admin (UI)
  const isProtectedPage = PROTECTED_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
  const isPublicPage = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );

  if (isProtectedPage && !isPublicPage) {
    const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      cookies: {
        getAll() {
          return request.cookies.getAll().map((c) => ({
            name: c.name,
            value: c.value,
          }));
        },
        setAll() {
          // لا نعدّل الكوكيز في الـ middleware - يعتمد على client-side auth
        },
      },
    });

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        const loginUrl = new URL("/admin/login", request.url);
        loginUrl.searchParams.set("redirect", pathname);
        return NextResponse.redirect(loginUrl);
      }
    } catch (err) {
      // في حالة فشل التحقق، اسمح بالمرور (الصفحة ستتعامل مع التحقق)
      // هذا يمنع توقف التطبيق عند انقطاع Supabase
      console.error("Middleware auth check failed:", err);
    }
  }

  // 2. تحقق من مسارات /api/admin (Server-to-Server)
  const isProtectedApi = PROTECTED_API_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
  const isPublicApi = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );

  if (isProtectedApi && !isPublicApi) {
    const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      cookies: {
        getAll() {
          return request.cookies.getAll().map((c) => ({
            name: c.name,
            value: c.value,
          }));
        },
        setAll() {},
      },
    });

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        return NextResponse.json(
          { error: "Unauthorized: تسجيل دخول الأدمن مطلوب" },
          { status: 401 }
        );
      }
    } catch (err) {
      console.error("Middleware API auth check failed:", err);
      return NextResponse.json(
        { error: "Authentication service unavailable" },
        { status: 503 }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
