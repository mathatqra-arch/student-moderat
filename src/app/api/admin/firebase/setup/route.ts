import { NextResponse } from "next/server";
import { isFirebaseConfigured, getFirebaseProjectId } from "@/lib/firebase/verifier";

// ==========================================
// Firebase Setup Endpoint
// يتحقق من إعدادات Firebase ويعرض حالتها + يرجع الـ client config
// (endpoint عام - مش محمي - عشان الـ client يقدر يقرأ الإعدادات)
// ==========================================

export async function GET() {
  const clientConfigured = Boolean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY);
  const adminConfigured = isFirebaseConfigured();

  let adminAuthError: string | null = null;
  if (adminConfigured) {
    const projectId = getFirebaseProjectId();
    if (!projectId) {
      adminAuthError = "Could not extract project_id from Firebase config";
    }
  }

  // الـ client config الـ public (آمن للعرض في المتصفح)
  const clientConfig = clientConfigured
    ? {
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
      }
    : null;

  return NextResponse.json({
    client_configured: clientConfigured,
    admin_configured: adminConfigured,
    admin_auth_error: adminAuthError,
    ready: clientConfigured && adminConfigured && !adminAuthError,
    config: {
      apiKey_present: Boolean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY),
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || null,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || null,
      service_account_json_present: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON),
      separate_creds_present: Boolean(
        process.env.FIREBASE_PROJECT_ID &&
          process.env.FIREBASE_CLIENT_EMAIL &&
          process.env.FIREBASE_PRIVATE_KEY
      ),
    },
    // الـ client config (يُرجع للعميل عشان يـ initialize Firebase SDK)
    client_config: clientConfig,
    setup_instructions: !clientConfigured
      ? {
          title: "خطوات تفعيل Firebase Phone Auth (مجاني 100%)",
          steps: [
            "1. اذهب إلى https://console.firebase.google.com",
            "2. أنشئ مشروع جديد (مثلاً: student-moderat-auth)",
            "3. من Authentication → Sign-in method → فعّل Phone",
            "4. من Project Settings (أيقونة الترس) → أضف Web App",
            "5. انسخ الـ config values (apiKey, authDomain, projectId, etc.)",
            "6. من Project Settings → Service Accounts → Generate New Private Key",
            "7. أضف القيم في ملف .env.local (انظر .env.example)",
            "8. أعد تشغيل الخادم",
          ],
          env_vars_needed: [
            "NEXT_PUBLIC_FIREBASE_API_KEY",
            "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
            "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
            "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
            "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
            "NEXT_PUBLIC_FIREBASE_APP_ID",
            "FIREBASE_SERVICE_ACCOUNT_JSON (كل الـ JSON كنسخة نصية)",
          ],
          free_quota: "10 SMS/يوم في الـ Spark Plan المجاني",
          console_url: "https://console.firebase.google.com",
        }
      : null,
  });
}
