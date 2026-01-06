/**
 * Admin Login API Route
 *
 * Uses unified auth service - admin login is now just a wrapper
 * that validates the user has admin role after unified login.
 * Includes AUDIT LOGGING for admin auth events.
 * 
 * Sets ONLY session_token cookie (httpOnly).
 * Role is derived from session validation, not separate cookies.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { loginAdmin, getRouteForRole, type AuthErrorCode } from '@/lib/db/dal/auth-service';
import { logAuthEvent, logSecurityEvent } from '@/lib/db/dal/audit';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 7 * 24 * 60 * 60,
};

function getHttpStatus(code: AuthErrorCode): number {
  switch (code) {
    case 'INVALID_INPUT': return 400;
    case 'ADMIN_NOT_FOUND': return 401;
    case 'USER_NOT_FOUND': return 401;
    case 'INVALID_CREDENTIALS': return 401;
    case 'ADMIN_DISABLED': return 403;
    case 'SESSION_CREATION_FAILED': return 500;
    case 'TRANSACTION_FAILED': return 500;
    default: return 500;
  }
}

export async function POST(request: NextRequest) {
  const ipAddress = request.headers.get('x-forwarded-for') || undefined;
  const userAgent = request.headers.get('user-agent') || undefined;

  try {
    const body = await request.json();
    const { email, password } = body;

    console.log('[ADMIN_LOGIN_API] Starting unified admin login', { email });

    const result = loginAdmin(
      { email, password },
      { ipAddress, userAgent }
    );

    if (!result.success || !result.data) {
      const error = result.error!;
      console.log('[ADMIN_LOGIN_API] Admin login failed:', error.code, error.message);

      logSecurityEvent(
        'ADMIN_LOGIN_FAILED',
        `Admin login attempt failed for ${email}: ${error.code}`,
        {
          adminEmail: email,
          ipAddress,
          severity: error.code === 'ADMIN_NOT_FOUND' ? 'warning' : 'critical',
        }
      );

      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          details: error.details,
        },
        { status: getHttpStatus(error.code) }
      );
    }

    const { admin, session } = result.data;
    console.log('[ADMIN_LOGIN_API] Admin login successful, setting session cookie', { adminId: admin.id, role: admin.role });

    logAuthEvent(
      'ADMIN_LOGIN_SUCCESS',
      admin.id,
      admin.email,
      true,
      {
        ipAddress,
        userAgent,
        details: `Admin logged in (role: ${admin.adminRole || admin.role})`,
      }
    );

    const cookieStore = await cookies();

    cookieStore.set('session_token', session.token, COOKIE_OPTIONS);

    console.log('[ADMIN_LOGIN_API] Session cookie set, returning success');

    return NextResponse.json({
      success: true,
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
        adminRole: admin.adminRole,
        permissions: admin.permissions,
        createdAt: admin.createdAt,
      },
      redirect: getRouteForRole(admin.role),
    });
  } catch (error) {
    console.error('[ADMIN_LOGIN_API] Unexpected error:', error);

    logSecurityEvent(
      'ADMIN_LOGIN_ERROR',
      `System error during admin login: ${error instanceof Error ? error.message : String(error)}`,
      {
        ipAddress,
        severity: 'critical',
      }
    );

    return NextResponse.json(
      {
        error: 'Admin login failed due to an unexpected error',
        code: 'TRANSACTION_FAILED',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
