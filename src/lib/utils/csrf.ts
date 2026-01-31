import { randomBytes } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const CSRF_COOKIE_NAME = 'csrf_token';
const CSRF_HEADER_NAME = 'x-csrf-token';
const CSRF_TOKEN_LENGTH = 32;

const CSRF_COOKIE_OPTIONS = {
  httpOnly: false,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
  maxAge: 7 * 24 * 60 * 60,
};

export function generateCsrfToken(): string {
  return randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
}

export async function setCsrfCookie(): Promise<string> {
  const token = generateCsrfToken();
  const cookieStore = await cookies();
  cookieStore.set(CSRF_COOKIE_NAME, token, CSRF_COOKIE_OPTIONS);
  return token;
}

export async function getCsrfTokenFromCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(CSRF_COOKIE_NAME)?.value || null;
}

export function getCsrfTokenFromHeader(request: NextRequest): string | null {
  return request.headers.get(CSRF_HEADER_NAME);
}

export async function validateCsrfToken(request: NextRequest): Promise<boolean> {
  const cookieToken = await getCsrfTokenFromCookie();
  const headerToken = getCsrfTokenFromHeader(request);

  if (!cookieToken || !headerToken) {
    return false;
  }

  if (cookieToken.length !== headerToken.length) {
    return false;
  }

  let mismatch = 0;
  for (let i = 0; i < cookieToken.length; i++) {
    mismatch |= cookieToken.charCodeAt(i) ^ headerToken.charCodeAt(i);
  }
  return mismatch === 0;
}

export interface CsrfCheckResult {
  valid: boolean;
  response?: NextResponse;
}

export async function withCsrfProtection(request: NextRequest): Promise<CsrfCheckResult> {
  const method = request.method.toUpperCase();
  
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    return { valid: true };
  }

  const isValid = await validateCsrfToken(request);
  
  if (!isValid) {
    console.warn('[CSRF] Token validation failed', {
      method,
      path: request.nextUrl.pathname,
    });
    
    return {
      valid: false,
      response: NextResponse.json(
        { error: 'Invalid or missing CSRF token', code: 'CSRF_VALIDATION_FAILED' },
        { status: 403 }
      ),
    };
  }

  return { valid: true };
}

export async function ensureCsrfToken(): Promise<string> {
  const existing = await getCsrfTokenFromCookie();
  if (existing) {
    return existing;
  }
  return await setCsrfCookie();
}

export { CSRF_COOKIE_NAME, CSRF_HEADER_NAME };
