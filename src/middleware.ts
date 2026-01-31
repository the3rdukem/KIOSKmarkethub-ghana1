import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware for Role-Based Route Protection and CSRF Validation
 *
 * This runs on the server BEFORE any page or component loads.
 * 
 * Authentication is now server-authoritative via session_token cookie only.
 * The middleware cannot validate the session directly (no DB access in Edge),
 * so it just passes through and lets client-side route guards handle auth.
 * 
 * For protected routes, we set headers to indicate auth requirements
 * which the client-side route guards use to validate.
 * 
 * CSRF protection is applied to state-changing API requests (POST, PUT, DELETE, PATCH).
 */

const CSRF_COOKIE_NAME = 'csrf_token';
const CSRF_HEADER_NAME = 'x-csrf-token';

const CSRF_EXEMPT_PATHS = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/admin/login',
  '/api/auth/logout',
  '/api/auth/otp/send',
  '/api/auth/otp/verify',
  '/api/auth/phone/complete-registration',
  '/api/auth/password-reset/request',
  '/api/auth/password-reset/reset',
  '/api/auth/google/callback',
  '/api/webhooks/',
  '/api/paystack/webhook',
  '/api/db/init',
  '/api/site-settings/public',
  '/api/stats/public',
  '/api/footer-links/public',
  '/api/hero-slides',
  '/api/products',
  '/api/categories',
  '/api/search',
  '/api/geocode',
  '/api/analytics/',
  '/api/cart',
  '/api/wishlist',
  '/api/reviews',
  '/api/messaging',
  '/api/notifications',
  '/api/orders',
];

function isCsrfExempt(pathname: string): boolean {
  return CSRF_EXEMPT_PATHS.some(path => pathname.startsWith(path));
}

function validateCsrfToken(request: NextRequest): boolean {
  const cookieToken = request.cookies.get(CSRF_COOKIE_NAME)?.value;
  const headerToken = request.headers.get(CSRF_HEADER_NAME);

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

const roleExclusiveRoutes: { pattern: RegExp; allowedRoles: string[]; loginPath: string }[] = [
  {
    pattern: /^\/vendor(?!\/login|\/[a-zA-Z0-9_-]+$)/,
    allowedRoles: ['vendor'],
    loginPath: '/vendor/login'
  },
  {
    pattern: /^\/admin(?!\/login)/,
    allowedRoles: ['admin', 'master_admin'],
    loginPath: '/admin/login'
  },
  {
    pattern: /^\/buyer/,
    allowedRoles: ['buyer', 'vendor', 'admin', 'master_admin'],
    loginPath: '/auth/login'
  },
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method.toUpperCase();

  if (
    pathname.startsWith('/_next') ||
    pathname.includes('.') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/api')) {
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
      if (!isCsrfExempt(pathname)) {
        if (!validateCsrfToken(request)) {
          console.warn('[MIDDLEWARE] CSRF validation failed', { pathname, method });
          return NextResponse.json(
            { error: 'Invalid or missing CSRF token', code: 'CSRF_VALIDATION_FAILED' },
            { status: 403 }
          );
        }
      }
    }
    return NextResponse.next();
  }

  const sessionToken = request.cookies.get('session_token')?.value;
  const hasSession = !!sessionToken;

  for (const route of roleExclusiveRoutes) {
    if (route.pattern.test(pathname)) {
      if (!hasSession) {
        const response = NextResponse.next();
        response.headers.set('x-requires-auth', 'true');
        response.headers.set('x-required-roles', route.allowedRoles.join(','));
        response.headers.set('x-login-path', route.loginPath);
        return response;
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)',
  ],
};
