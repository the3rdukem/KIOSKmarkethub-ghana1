/**
 * Rate Limiting Data Access Layer
 * 
 * Database-backed rate limiting for production use.
 * Works across server restarts and multiple instances.
 */

import { query } from '../index';
import { randomUUID } from 'crypto';

export interface RateLimitConfig {
  maxRequests: number;
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  retryAfterSeconds?: number;
}

interface RateLimitRow {
  id: string;
  key: string;
  action: string;
  count: number;
  window_start: string;
  window_seconds: number;
}

export const RATE_LIMIT_CONFIGS: Record<string, RateLimitConfig> = {
  login: { maxRequests: 5, windowSeconds: 300 },
  admin_login: { maxRequests: 3, windowSeconds: 600 },
  otp_send: { maxRequests: 5, windowSeconds: 3600 },
  otp_verify: { maxRequests: 5, windowSeconds: 300 },
  password_reset: { maxRequests: 3, windowSeconds: 3600 },
  message_send: { maxRequests: 20, windowSeconds: 60 },
  api_general: { maxRequests: 100, windowSeconds: 60 },
};

export async function checkRateLimit(
  key: string,
  action: string,
  config?: RateLimitConfig
): Promise<RateLimitResult> {
  const { maxRequests, windowSeconds } = config || RATE_LIMIT_CONFIGS[action] || { maxRequests: 100, windowSeconds: 60 };
  const now = new Date();

  try {
    const result = await query(
      `INSERT INTO rate_limits (id, key, action, count, window_start, window_seconds, created_at, updated_at)
       VALUES ($1, $2, $3, 1, $4, $5, $4, $4)
       ON CONFLICT (key, action) DO UPDATE SET
         count = CASE 
           WHEN rate_limits.window_start + (rate_limits.window_seconds * INTERVAL '1 second') < $4::timestamp
           THEN 1
           ELSE rate_limits.count + 1
         END,
         window_start = CASE 
           WHEN rate_limits.window_start + (rate_limits.window_seconds * INTERVAL '1 second') < $4::timestamp
           THEN $4::timestamp
           ELSE rate_limits.window_start
         END,
         window_seconds = $5,
         updated_at = $4::timestamp
       RETURNING count, window_start, window_seconds`,
      [randomUUID(), key, action, now.toISOString(), windowSeconds]
    );

    const row = result.rows[0];
    const currentCount = typeof row.count === 'number' ? row.count : parseInt(String(row.count));
    const windowStart = new Date(row.window_start as string);
    const windowEnd = new Date(windowStart.getTime() + (row.window_seconds as number) * 1000);

    if (currentCount > maxRequests) {
      const retryAfterSeconds = Math.ceil((windowEnd.getTime() - now.getTime()) / 1000);
      return {
        allowed: false,
        remaining: 0,
        resetAt: windowEnd,
        retryAfterSeconds: retryAfterSeconds > 0 ? retryAfterSeconds : 1,
      };
    }

    return {
      allowed: true,
      remaining: Math.max(0, maxRequests - currentCount),
      resetAt: windowEnd,
    };
  } catch (error) {
    console.error('[RATE_LIMIT] Error checking rate limit:', error);
    return {
      allowed: false,
      remaining: 0,
      resetAt: new Date(now.getTime() + windowSeconds * 1000),
      retryAfterSeconds: 60,
    };
  }
}

export async function resetRateLimit(key: string, action: string): Promise<void> {
  try {
    await query(
      `DELETE FROM rate_limits WHERE key = $1 AND action = $2`,
      [key, action]
    );
  } catch (error) {
    console.error('[RATE_LIMIT] Error resetting rate limit:', error);
  }
}

export async function cleanupExpiredRateLimits(): Promise<number> {
  try {
    const result = await query(
      `DELETE FROM rate_limits 
       WHERE window_start + (window_seconds * INTERVAL '1 second') < NOW()
       RETURNING id`
    );
    return result.rowCount || 0;
  } catch (error) {
    console.error('[RATE_LIMIT] Error cleaning up expired rate limits:', error);
    return 0;
  }
}

export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': Math.floor(result.resetAt.getTime() / 1000).toString(),
    ...(result.retryAfterSeconds && { 'Retry-After': result.retryAfterSeconds.toString() }),
  };
}
