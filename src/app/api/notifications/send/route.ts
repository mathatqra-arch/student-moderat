import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, message, category, url } = body;

    if (!title || !message) {
      return NextResponse.json(
        { error: "الموضوع ونص الرسالة مطلوبان" },
        { status: 400 }
      );
    }

    // Web Push Notification Payload Dispatch Simulation
    const notificationPayload = {
      title: title || "تنبيه جديد من منصة الدفعة",
      body: message,
      category: category || "عام",
      url: url || "/student",
      timestamp: new Date().toISOString(),
    };

    console.log("Dispatching Web Push Notification:", notificationPayload);

    return NextResponse.json({
      success: true,
      message: "تم إرسال الإشعار الفوري للطلاب المسجلين بنجاح.",
      payload: notificationPayload,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "فشل إرسال الإشعارات: " + error.message },
      { status: 500 }
    );
  }
}
