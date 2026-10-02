import type { Metadata, Viewport } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";

// الخط أساسي self-hosted عبر next/font — بيتحمّل من نفس الدومين (بدون ريكوست Google حاجز للعرض)
const cairo = Cairo({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-cairo",
  preload: true,
});

export const metadata: Metadata = {
  title: "منصة الدفعة",
  description: "منصة طلابية موحدة للإعلانات والجداول والتكليفات والروابط والاستفسارات",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#F5F5F0",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const cfAnalyticsToken = process.env.NEXT_PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN;
  return (
    <html lang="ar" dir="rtl" className={`light ${cairo.variable}`} suppressHydrationWarning>
      <body className={cairo.className}>
        {
          // ==========================================
          // بافر عالمي لحدث beforeinstallprompt — لازم يشتغل قبل أي React
          // كروم بيبعت الحدث بدري قبل الهيدريشن، ولو مفيش بافر بيتضيع
          // وكل بوب أبس التثبيت (طالب/إدارة) بيقراه من window.__pwaBuf
          // ==========================================
        }
        <script
          dangerouslySetInnerHTML={{
            __html: `try{(function(){window.__pwaBuf=null;window.addEventListener('beforeinstallprompt',function(e){try{e.preventDefault()}catch(_){};window.__pwaBuf=e;try{window.dispatchEvent(new CustomEvent('pwa-install-available'))}catch(_){}});window.addEventListener('appinstalled',function(){try{window.dispatchEvent(new CustomEvent('pwa-app-installed'))}catch(_){}});function __chunkRecover(e){try{var m=((e&&e.message)||'')+((e&&e.reason&&e.reason.message)||'');if(/ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module/i.test(m)){var k='__chunkRecoveryAt';var last=+sessionStorage.getItem(k)||0;if(Date.now()-last>15000){sessionStorage.setItem(k,String(Date.now()));location.reload();}}}catch(_){}}window.addEventListener('error',function(e){__chunkRecover(e.error||e)},true);window.addEventListener('unhandledrejection',function(e){__chunkRecover(e.reason)})})()}catch(_){}`,
          }}
        />
        {children}
        {cfAnalyticsToken && (
          <script
            defer
            src="https://static.cloudflareinsights.com/beacon.min.js"
            data-cf-beacon={`{"token":"${cfAnalyticsToken}"}`}
          />
        )}
      </body>
    </html>
  );
}
