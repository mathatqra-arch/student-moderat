import { redirect } from "next/navigation";

// الصفحة الرئيسية redirect تلقائياً لواجهة الطلاب
export default function Home() {
  redirect("/student");
}
