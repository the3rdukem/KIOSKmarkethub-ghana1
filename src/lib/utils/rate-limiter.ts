/**
 * Rate Limiter Utility
 * 
 * Helper functions to apply rate limiting to API endpoints.
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  checkRateLimit, 
  getRateLimitHeaders, 
  RateLimitConfig,
  RateLimitResult 
} from '@/lib/db/dal/rate-limits';

export type RateLimitAction = 
  | 'login'
  | 'admin_login'
  | 'otp_send'
  | 'otp_verify'
  | 'password_reset'
  | 'message_send'
  | 'api_general'
  | 'api_public_read'
  | 'api_search';

export function getClientIdentifier(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown';
  return ip;
}

export async function withRateLimit(
  request: NextRequest,
  action: RateLimitAction,
  identifier?: string,
  config?: RateLimitConfig
): Promise<{ allowed: true; result: RateLimitResult } | { allowed: false; response: NextResponse }> {
  const key = identifier || getClientIdentifier(request);
  const result = await checkRateLimit(key, action, config);

  if (!result.allowed) {
    const headers = getRateLimitHeaders(result);
    return {
      allowed: false,
      response: NextResponse.json(
        {
          error: 'Too many requests',
          message: 'Please try again later',
          retryAfter: result.retryAfterSeconds,
        },
        {
          status: 429,
          headers,
        }
      ),
    };
  }

  return { allowed: true, result };
}

export function addRateLimitHeaders(
  response: NextResponse,
  result: RateLimitResult
): NextResponse {
  const headers = getRateLimitHeaders(result);
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  return response;
}
