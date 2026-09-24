import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "منصة إدارة الدفعة",
  description: "المنصة المتكاملة لإدارة الدفعة الأكاديمية والإنذارات والملاحظات والطلبات",
  manifest: "/manifest.json",
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#2563eb",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cfAnalyticsToken = process.env.NEXT_PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN;

  return (
    <html lang="ar" dir="rtl" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-dark-bg text-gray-100 font-['Cairo',sans-serif] antialiased selection:bg-blue-600 selection:text-white">
        {children}

        {/* Cloudflare Web Analytics */}
        {cfAnalyticsToken && (
          <Script
            defer
            src="https://static.cloudflareinsights.com/beacon.min.js"
            data-cf-beacon={`{"token": "${cfAnalyticsToken}"}`}
          />
        )}
      </body>
    </html>
  );
}
