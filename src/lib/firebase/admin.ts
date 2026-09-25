// ==========================================
// Firebase Admin — Cloudflare Workers Compatible
// ==========================================
// بدلاً من استخدام firebase-admin SDK (الذي يعتمد على Node.js HTTP modules
// التي لا تعمل على Workers)، نستخدم verifier مخصص يعتمد على fetch + Web Crypto API

import { verifyFirebaseIdToken, isFirebaseConfigured, getFirebaseProjectId } from "./verifier";

export { verifyFirebaseIdToken, isFirebaseConfigured, getFirebaseProjectId };

// للتوافق مع الكود القديم
export function getAdminAuth() {
  // ليس متاحاً على Workers — نرجع null
  // استخدم verifyFirebaseIdToken مباشرة
  return null;
}
