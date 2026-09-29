// ==========================================
// Rate Limiter — Atomic DB-backed sliding window
// يعمل على أي استضافة (Vercel / Cloudflare Workers / Node)
// لأن العدّاد مخزّن في Supabase وليس في الذاكرة
//
// يعتمد على RPC: public.rate_limit_hit(key, window_seconds, max_requests)
// لو الـ RPC غير موجود → fail-open (يسمح بالطلب) حتى لا يتعطل النظام
// ==========================================

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://apcxwxnkntegbkimsmty.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient | null {
  if (!SUPABASE_SERVICE_ROLE_KEY) return null;
  if (!_client) {
    _client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return _client;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retry_after: number; // seconds
}

export interface RateLimitConfig {
  /** معرّف فريد للحد (مثل: login, mcp_write) */
  bucket: string;
  /** نافذة الزمن بالثواني */
  windowSeconds: number;
  /** أقصى عدد طلبات داخل النافذة */
  maxRequests: number;
}

// إعدادات جاهزة للمسارات الحساسة
export const RATE_LIMITS = {
  login: { bucket: "admin_login", windowSeconds: 300, maxRequests: 10 } as RateLimitConfig,
  passwordChange: { bucket: "admin_password", windowSeconds: 600, maxRequests: 5 } as RateLimitConfig,
} as const;

function clientIp(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

/**
 * يستهلك "ضربة" واحدة من الحد المسموح.
 * @returns allowed=false عند تجاوز الحد
 */
export async function hitRateLimit(
  config: RateLimitConfig,
  identifier: string
): Promise<RateLimitResult> {
  const supabase = getClient();

  // بدون service key أو بدون RPC → fail-open (لا نعطل النظام أبداً)
  if (!supabase) {
    return { allowed: true, remaining: 0, retry_after: 0 };
  }

  const key = `${config.bucket}:${identifier}`;

  try {
    const { data, error } = await supabase.rpc("rate_limit_hit", {
      p_key: key,
      p_window_seconds: config.windowSeconds,
      p_max: config.maxRequests,
    });

    if (error) {
      console.warn("rate_limit_hit unavailable (fail-open):", error.message);
      return { allowed: true, remaining: 0, retry_after: 0 };
    }

    // الـ RPC يرجع { allowed, current, max, retry_after }
    const result = Array.isArray(data) ? data[0] : data;
    const allowed = result?.allowed !== false;
    const current = Number(result?.current ?? 0);
    return {
      allowed,
      remaining: Math.max(0, config.maxRequests - current),
      retry_after: Number(result?.retry_after ?? 0),
    };
  } catch (err) {
    console.warn("Rate limit check failed (fail-open):", err);
    return { allowed: true, remaining: 0, retry_after: 0 };
  }
}

/**
 * Helper: استخراج IP من الطلب
 */
export { clientIp as getRateLimitIdentifier };

/**
 * Helper جاهز: يتحقق من الحد ويرجع استجابة 429 جاهزة أو null إن مسموح
 */
export async function enforceRateLimit(
  req: Request,
  config: RateLimitConfig
): Promise<Response | null> {
  const result = await hitRateLimit(config, clientIp(req));
  if (result.allowed) return null;
  return new Response(
    JSON.stringify({
      ok: false,
      error: `تم تجاوز الحد المسموح من المحاولات. حاول مجدداً بعد ${result.retry_after} ثانية.`,
      retry_after: result.retry_after,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Retry-After": String(result.retry_after),
      },
    }
  );
}
