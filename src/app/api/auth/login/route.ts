/**
 * User Login API Route
 *
 * Uses atomic auth service with SPECIFIC error codes.
 * NO generic "An error occurred" messages.
 * Includes AUDIT LOGGING for all auth events.
 * 
 * Sets ONLY session_token cookie (httpOnly).
 * Role is derived from session validation, not separate cookies.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { loginUser, getRouteForRole, type AuthErrorCode } from '@/lib/db/dal/auth-service';
import { logAuthEvent } from '@/lib/db/dal/audit';

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
    case 'USER_NOT_FOUND': return 401;
    case 'INVALID_CREDENTIALS': return 401;
    case 'USER_SUSPENDED': return 403;
    case 'USER_BANNED': return 403;
    case 'USER_DELETED': return 410;
    case 'ROLE_ASSIGNMENT_FAILED': return 500;
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
    const { email, phone, password } = body;

    console.log('[LOGIN_API] Starting atomic login', { email, phone: phone ? '***' : undefined });

    const result = await loginUser(
      { email, phone, password },
      { ipAddress, userAgent }
    );

    if (!result.success || !result.data) {
      const error = result.error!;
      console.log('[LOGIN_API] Login failed:', error.code, error.message);

      await logAuthEvent(
        'LOGIN_FAILED',
        email || 'unknown',
        email || 'unknown',
        false,
        {
          ipAddress,
          userAgent,
          details: `${error.code}: ${error.message}`,
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

    const { user, session } = result.data;
    console.log('[LOGIN_API] Login successful, setting session cookie', { userId: user.id, role: user.role });

    await logAuthEvent(
      'LOGIN_SUCCESS',
      user.id,
      user.email,
      true,
      {
        ipAddress,
        userAgent,
        details: `User logged in as ${user.role}`,
      }
    );

    const cookieStore = await cookies();

    cookieStore.set('session_token', session.token, COOKIE_OPTIONS);

    console.log('[LOGIN_API] Session cookie set, returning success');

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
        avatar: user.avatar,
        phone: user.phone,
        location: user.location,
        businessName: user.businessName,
        isVerified: user.verificationStatus === 'verified',
        verificationStatus: user.verificationStatus,
        createdAt: user.createdAt,
      },
      redirect: getRouteForRole(user.role),
    });
  } catch (error) {
    console.error('[LOGIN_API] Unexpected error:', error);

    await logAuthEvent(
      'LOGIN_ERROR',
      'system',
      'unknown',
      false,
      {
        ipAddress,
        userAgent,
        details: error instanceof Error ? error.message : String(error),
      }
    );

    return NextResponse.json(
      {
        error: 'Login failed due to an unexpected error',
        code: 'TRANSACTION_FAILED',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
