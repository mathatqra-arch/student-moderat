// ==========================================
// Firebase Admin SDK — للـ server-side token verification
// ==========================================

import { initializeApp, getApps, cert, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

function getFirebaseConfig() {
  // أولوية 1: service account JSON كامل (موصى به للإنتاج)
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (serviceAccountJson) {
    try {
      const parsed = JSON.parse(serviceAccountJson);
      return { credential: cert(parsed) };
    } catch (err) {
      console.error("Invalid FIREBASE_SERVICE_ACCOUNT_JSON:", err);
    }
  }

  // أولوية 2: متغيرات منفصلة (سهولة الإعداد)
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (projectId && clientEmail && privateKey) {
    return {
      credential: cert({ projectId, clientEmail, privateKey }),
    };
  }

  // أولوية 3: applicationDefault() — ينفع لو على Google Cloud
  return { credential: applicationDefault() };
}

let adminApp: ReturnType<typeof initializeApp> | null = null;
let adminAuthInstance: ReturnType<typeof getAuth> | null = null;

export function getAdminAuth() {
  if (!adminApp) {
    if (getApps().length === 0) {
      adminApp = initializeApp(getFirebaseConfig());
    } else {
      adminApp = getApps()[0];
    }
    adminAuthInstance = getAuth(adminApp);
  }
  return adminAuthInstance!;
}

export function isFirebaseConfigured(): boolean {
  return Boolean(
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
      (process.env.FIREBASE_PROJECT_ID &&
        process.env.FIREBASE_CLIENT_EMAIL &&
        process.env.FIREBASE_PRIVATE_KEY)
  );
}
