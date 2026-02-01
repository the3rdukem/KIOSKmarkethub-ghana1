/**
 * Session Validation API Route
 *
 * Uses unified auth service for session validation.
 * Returns the same user format for all user types (buyers, vendors, admins).
 * 
 * ONLY checks session_token cookie.
 * Role is derived from session, not separate cookies.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { validateSessionToken } from '@/lib/db/dal/auth-service';
import { ensureCsrfToken } from '@/lib/utils/csrf';
import { createLogger } from '@/lib/utils/logger';

const log = createLogger('AUTH_SESSION');

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    log.debug('Validating session', { hasToken: !!sessionToken });

    if (!sessionToken) {
      log.debug('No session token found');
      return NextResponse.json({ authenticated: false, user: null });
    }

    const result = await validateSessionToken(sessionToken);

    if (!result.success || !result.data) {
      const error = result.error!;
      log.debug('Session validation failed', { code: error.code, message: error.message });

      cookieStore.set('session_token', '', {
        ...COOKIE_OPTIONS,
        maxAge: 0,
      });

      return NextResponse.json({
        authenticated: false,
        user: null,
        error: error.message,
        code: error.code,
      });
    }

    const { session, user } = result.data;
    log.debug('Session valid', { sessionId: session.id, userId: session.userId, role: session.userRole });

    if (!user) {
      log.error('Session valid but no user data', { sessionId: session.id });
      return NextResponse.json({ authenticated: false, user: null });
    }

    await ensureCsrfToken();

    return NextResponse.json({
      authenticated: true,
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
        businessType: user.businessType,
        isVerified: user.verificationStatus === 'verified',
        verificationStatus: user.verificationStatus,
        storeDescription: user.storeDescription,
        storeBanner: user.storeBanner,
        storeLogo: user.storeLogo,
        createdAt: user.createdAt,
        adminRole: user.adminRole,
        permissions: user.permissions,
      },
      session: {
        id: session.id,
        expiresAt: session.expiresAt,
      },
    });
  } catch (error) {
    log.error('Unexpected error', {}, error);
    return NextResponse.json({
      authenticated: false,
      user: null,
      error: 'Session validation failed',
      code: 'TRANSACTION_FAILED',
    });
  }
}
