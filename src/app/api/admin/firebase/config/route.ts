import { NextResponse } from "next/server";

// ==========================================
// Firebase Client Config Endpoint
// يرجع إعدادات Firebase الـ public للعميل
// ضروري على Cloudflare Workers لأن NEXT_PUBLIC_ vars تُقرأ في runtime، مش compile-time
// ==========================================

export async function GET() {
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || null,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || null,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || null,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || null,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || null,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || null,
  };

  const isConfigured = Boolean(config.apiKey && config.projectId && config.appId);

  return NextResponse.json({
    configured: isConfigured,
    config: isConfigured ? config : null,
  });
}
