import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// ==========================================
// Middleware - حماية صفحات الأدمن و APIs
// المسار المخفي: /go/admin
// مبدأ Fail-Closed: أي خطأ في المصادقة = رفض الوصول
// ==========================================

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://apcxwxnkntegbkimsmty.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// المسارات المحمية
const PROTECTED_PATHS = ["/admin", "/go/admin"];
const PROTECTED_API_PATHS = ["/api/admin"];

// استثناءات (لا تتطلب تسجيل دخول)
const PUBLIC_PATHS = [
  "/admin/login",
  "/go/admin/login",
  "/api/admin/login",
  "/api/admin/health",
];

async function getSession(request: NextRequest): Promise<{ session: unknown | null; error: unknown | null }> {
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
    return { session, error: null };
  } catch (err) {
    return { session: null, error: err };
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. تحقق من صفحات /admin و /go/admin
  const isProtectedPage = PROTECTED_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
  const isPublicPage = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );

  if (isProtectedPage && !isPublicPage) {
    const { session, error } = await getSession(request);

    // Fail-closed: لو المصادقة فشلت (Supabase متاح مش مثلاً) → تحويل للدخول
    if (error || !session) {
      const loginUrl = new URL("/go/admin/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // 2. تحقق من مسارات /api/admin
  const isProtectedApi = PROTECTED_API_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
  const isPublicApi = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );

  if (isProtectedApi && !isPublicApi) {
    const { session, error } = await getSession(request);

    // Fail-closed للـ APIs أيضاً
    if (error) {
      return NextResponse.json(
        { error: "Authentication service unavailable" },
        { status: 503 }
      );
    }
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized: تسجيل دخول الأدمن مطلوب" },
        { status: 401 }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/go/admin/:path*", "/api/admin/:path*"],
};
