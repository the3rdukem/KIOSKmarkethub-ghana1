import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware for Role-Based Route Protection
 *
 * This runs on the server BEFORE any page or component loads.
 * 
 * Authentication is now server-authoritative via session_token cookie only.
 * The middleware cannot validate the session directly (no DB access in Edge),
 * so it just passes through and lets client-side route guards handle auth.
 * 
 * For protected routes, we set headers to indicate auth requirements
 * which the client-side route guards use to validate.
 */

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

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.') ||
    pathname.startsWith('/favicon')
  ) {
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
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*|api).*)',
  ],
};
