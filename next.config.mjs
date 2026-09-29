/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // لا نتجاهل أخطاء TypeScript — التقطتها مبكراً قبل النشر
  typescript: {
    ignoreBuildErrors: false,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // منع تضمين الموقع داخل iframe (حماية من Clickjacking)
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            // CSP متوازنة: تسمح بسكربتات Next.js الداخلية وتمنع أي مصدر خارجي
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // Next.js يحتاج inline scripts للـ hydration و unsafe-eval في dev
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              // Supabase (قاعدة البيانات + المصادقة) + أي APIs داخلية
              `connect-src 'self' ${process.env.NEXT_PUBLIC_SUPABASE_URL || "https://*.supabase.co"} wss://*.supabase.co`,
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
