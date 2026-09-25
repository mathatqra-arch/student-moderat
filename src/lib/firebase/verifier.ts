// ==========================================
// Firebase ID Token Verifier — Cloudflare Workers Compatible
// يستخدم fetch + Web Crypto API للتحقق من JWT بدون firebase-admin SDK
// ==========================================

interface FirebaseConfig {
  projectId: string;
  clientEmail?: string;
}

interface DecodedToken {
  uid: string;
  phone_number?: string;
  email?: string;
  name?: string;
  firebase?: {
    sign_in_provider?: string;
    identities?: Record<string, unknown>;
  };
  iss: string;
  aud: string;
  exp: number;
  iat: number;
  sub: string;
  [key: string]: any;
}

const GOOGLE_PUBLIC_KEYS_URL =
  "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";

// Cache for public keys (تجنّب الطلبات المتكررة)
let cachedKeys: Record<string, string> | null = null;
let cachedKeysExpiry = 0;

/**
 * يحصل على Google public keys مع cache
 */
async function getGooglePublicKeys(): Promise<Record<string, string>> {
  const now = Date.now();
  if (cachedKeys && now < cachedKeysExpiry) {
    return cachedKeys;
  }

  // Cloudflare Workers يدعم cf cache options في fetch
  // لكن TypeScript قد لا يتعرف عليها، نستخدم type assertion
  const fetchOptions: any = {
    cf: { cacheTtl: 3600, cacheEverything: true },
  };
  const res = await fetch(GOOGLE_PUBLIC_KEYS_URL, fetchOptions);

  if (!res.ok) {
    throw new Error(`Failed to fetch Google public keys: ${res.status}`);
  }

  const keys = (await res.json()) as Record<string, string>;

  // Cache لمدة ساعة (أو حسب Cache-Control header)
  const cacheControl = res.headers.get("cache-control") || "";
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
  const maxAge = maxAgeMatch ? parseInt(maxAgeMatch[1], 10) : 3600;

  cachedKeys = keys;
  cachedKeysExpiry = now + maxAge * 1000;

  return keys;
}

/**
 * يحوّل PEM certificate إلى CryptoKey للتحقق
 */
async function pemToCryptoKey(pem: string): Promise<CryptoKey> {
  // استخراج الـ certificate من PEM
  const pemContents = pem
    .replace(/-----BEGIN CERTIFICATE-----/, "")
    .replace(/-----END CERTIFICATE-----/, "")
    .replace(/\s/g, "");

  // decode base64
  const der = base64ToArrayBuffer(pemContents);

  // استيراد كمفتاح public للتحقق من RS256
  return crypto.subtle.importKey(
    "spki",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );
}

/**
 * يحوّل base64 string إلى ArrayBuffer (مع دعم base64url)
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  // دعم base64url
  const b64 = base64.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);

  const binaryString = atob(padded);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * يتحقق من Firebase ID Token باستخدام Web Crypto API
 * متوافق مع Cloudflare Workers
 */
export async function verifyFirebaseIdToken(
  idToken: string,
  config: FirebaseConfig
): Promise<DecodedToken> {
  if (!idToken) {
    throw new Error("ID token is required");
  }

  if (!config.projectId) {
    throw new Error("Firebase project ID is required");
  }

  // 1. تقسيم JWT إلى أجزائه
  const parts = idToken.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid JWT format: expected 3 parts");
  }

  const [headerB64, payloadB64, signatureB64] = parts;

  // 2. decode header و payload
  let header: any;
  let payload: any;
  try {
    header = JSON.parse(atob(headerB64.replace(/-/g, "+").replace(/_/g, "/")));
    payload = JSON.parse(atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/")));
  } catch (err) {
    throw new Error("Failed to decode JWT header/payload");
  }

  // 3. التحقق من الـ algorithm
  if (header.alg !== "RS256") {
    throw new Error(`Unexpected algorithm: ${header.alg}. Expected RS256.`);
  }

  // 4. التحقق من الـ kid في header
  if (!header.kid) {
    throw new Error("JWT header missing 'kid'");
  }

  // 5. الحصول على Google public keys
  const publicKeys = await getGooglePublicKeys();
  const publicKeyPem = publicKeys[header.kid];
  if (!publicKeyPem) {
    throw new Error(`Public key not found for kid: ${header.kid}`);
  }

  // 6. التحقق من الـ signature باستخدام Web Crypto API
  const cryptoKey = await pemToCryptoKey(publicKeyPem);
  const signedData = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const signature = base64ToArrayBuffer(signatureB64);

  const isValid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    signature,
    signedData
  );

  if (!isValid) {
    throw new Error("Invalid ID token signature");
  }

  // 7. التحقق من الـ claims
  const now = Math.floor(Date.now() / 1000);

  // التحقق من iss
  const expectedIss = `https://securetoken.google.com/${config.projectId}`;
  if (payload.iss !== expectedIss) {
    throw new Error(`Invalid issuer. Expected: ${expectedIss}, got: ${payload.iss}`);
  }

  // التحقق من aud
  if (payload.aud !== config.projectId) {
    throw new Error(`Invalid audience. Expected: ${config.projectId}, got: ${payload.aud}`);
  }

  // التحقق من exp
  if (!payload.exp || payload.exp < now) {
    throw new Error("ID token has expired");
  }

  // التحقق من iat
  if (!payload.iat || payload.iat > now + 60) {
    throw new Error("ID token issued in the future");
  }

  // التحقق من sub (uid)
  if (!payload.sub || typeof payload.sub !== "string") {
    throw new Error("ID token missing 'sub' (uid) claim");
  }

  // التحقق من أن الـ token يخص Firebase Auth
  if (payload.firebase?.sign_in_provider && !payload.firebase.sign_in_provider.startsWith("phone")) {
    // نقبل أي مزود، لكن نُفضّل phone
  }

  return payload as DecodedToken;
}

/**
 * يتحقق إذا كانت إعدادات Firebase مُهيّأة (للـ setup endpoint)
 */
export function isFirebaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  );
}

/**
 * يحصل على project_id من الإعدادات
 */
export function getFirebaseProjectId(): string | null {
  // أولوية 1: متغير منفصل
  const directProjectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (directProjectId) return directProjectId;

  // أولوية 2: استخراج من service account JSON
  const saJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (saJson) {
    try {
      const parsed = JSON.parse(saJson);
      if (parsed.project_id) return parsed.project_id;
    } catch {}
  }

  return null;
}

/**
 * يحصل على client_email من الإعدادات (اختياري)
 */
export function getFirebaseClientEmail(): string | null {
  const saJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (saJson) {
    try {
      const parsed = JSON.parse(saJson);
      return parsed.client_email || null;
    } catch {}
  }
  return process.env.FIREBASE_CLIENT_EMAIL || null;
}
