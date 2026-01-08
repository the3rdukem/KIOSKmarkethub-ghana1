/**
 * User Logout API Route
 *
 * UNIFIED LOGOUT - Used by ALL user types (Buyer, Vendor, Admin)
 * 
 * CRITICAL: Uses Firefox-safe cookie deletion:
 * - Set cookie value to empty string
 * - Set maxAge = 0
 * - Use IDENTICAL attributes to how cookies were set
 * 
 * This approach works across ALL browsers including Firefox.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { logoutByToken, validateSessionToken } from '@/lib/db/dal/auth-service';
import { logAuthEvent } from '@/lib/db/dal/audit';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

export async function POST(request: NextRequest) {
  const ipAddress = request.headers.get('x-forwarded-for') || undefined;
  const userAgent = request.headers.get('user-agent') || undefined;

  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    console.log('[LOGOUT_API] Starting logout', { hasToken: !!sessionToken });

    let userId = 'unknown';
    let userEmail = 'unknown';
    let userRole = 'unknown';

    if (sessionToken) {
      const sessionResult = await validateSessionToken(sessionToken);
      if (sessionResult.success && sessionResult.data?.user) {
        userId = sessionResult.data.user.id;
        userEmail = sessionResult.data.user.email;
        userRole = sessionResult.data.user.role;
      }

      const deleted = await logoutByToken(sessionToken);
      console.log('[LOGOUT_API] Session deleted from database:', deleted);
    }

    await logAuthEvent(
      'LOGOUT',
      userId,
      userEmail,
      true,
      {
        ipAddress,
        userAgent,
        details: `User logged out (role: ${userRole})`,
      }
    );

    cookieStore.set('session_token', '', {
      ...COOKIE_OPTIONS,
      maxAge: 0,
    });

    cookieStore.set('user_role', '', {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
      maxAge: 0,
    });

    cookieStore.set('is_authenticated', '', {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
      maxAge: 0,
    });

    // Clear guest session cookie to prevent cart state leakage
    // NOTE: User carts are NOT deleted on logout - they persist in database
    // Only guest carts are ephemeral and cleared when guest_session_id cookie expires
    cookieStore.set('guest_session_id', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
      maxAge: 0,
    });

    console.log('[LOGOUT_API] Logout successful, session cleared (user cart preserved)');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[LOGOUT_API] Error:', error);
    return NextResponse.json(
      { error: 'Logout failed', code: 'TRANSACTION_FAILED' },
      { status: 500 }
    );
  }
}
