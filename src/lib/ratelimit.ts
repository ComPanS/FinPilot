/**
 * Rate limiting via Upstash Redis.
 * Skips limiting when UPSTASH_REDIS_REST_URL/TOKEN are not set.
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

/** 5 login attempts per minute per identifier */
export const authLimiter = createLimiter("auth", 5, "1 m");

/** 3 forgot-password emails per hour per identifier */
export const forgotPasswordLimiter = createLimiter("forgot", 3, "1 h");

/** 3 verification resends per hour per identifier */
export const resendVerificationLimiter = createLimiter("resend", 3, "1 h");

/** 20 AI chat requests per minute per identifier (stricter than quota) */
export const aiChatLimiter = createLimiter("ai-chat", 20, "1 m");

/** 60 webhook requests per minute per IP */
export const webhookLimiter = createLimiter("webhook", 60, "1 m");

function createLimiter(
  prefix: string,
  limit: number,
  window: string
): { limit: (id: string) => Promise<{ success: boolean }> } {
  const redis = getRedis();
  if (!redis) {
    return {
      limit: async () => ({ success: true }),
    };
  }
  const ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, window),
    prefix: `rl:${prefix}`,
  });
  return {
    limit: async (id: string) => {
      const { success } = await ratelimit.limit(id);
      return { success };
    },
  };
}

export function getClientIdentifier(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() ?? headers.get("x-real-ip") ?? "unknown";
  return ip;
}
