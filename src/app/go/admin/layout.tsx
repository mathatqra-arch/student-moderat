import type { Metadata } from "next";
import { AdminPwaPrompt } from "@/components/ui/pwa/Prompts";

// ==========================================
// Layout مسار الأدمن — بيتجاوز هوية الـ PWA العامة بهوية منفصلة
// manifest منفصل بـ id مختلف → لو الطالب والأدمن الاتنين اتنزلوا على
// نفس الجهاز بيتسجلوا كتطبيقين مستقلين بدون أي تعارض
// (Next App Router: الـ metadata بتاع الـ layout الابن بيتجاوز مفاتيح الأب)
// ==========================================
export const metadata: Metadata = {
  manifest: "/manifest-admin.json",
  icons: {
    icon: [
      { url: "/icons/icon-admin-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-admin-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/icon-admin-192.png",
  },
};

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      {children}
      {/* بوب أب تثبيت تطبيق الإدارة — شكل مستقل + تتبع تثبيت منفصل عن تطبيق الطالب */}
      <AdminPwaPrompt />
    </>
  );
}
