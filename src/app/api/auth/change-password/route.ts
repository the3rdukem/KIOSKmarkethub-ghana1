/**
 * Change Password API
 * 
 * POST /api/auth/change-password
 * 
 * Allows authenticated users (buyers, vendors) to change their password.
 * Requires current password validation before allowing the change.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { validateSession } from '@/lib/db/dal/sessions';
import { getUserById } from '@/lib/db/dal/users';
import { verifyPassword, hashPassword, validatePassword } from '@/lib/db/dal/auth-service';
import { query } from '@/lib/db';
import { logAuthEvent } from '@/lib/db/dal/audit';

export async function POST(request: NextRequest) {
  const ipAddress = request.headers.get('x-forwarded-for') || undefined;
  const userAgent = request.headers.get('user-agent') || undefined;

  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const session = await validateSession(sessionToken);
    if (!session) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const body = await request.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword) {
      return NextResponse.json({ error: 'Current password is required' }, { status: 400 });
    }

    if (!newPassword) {
      return NextResponse.json({ error: 'New password is required' }, { status: 400 });
    }

    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      return NextResponse.json({ 
        error: passwordValidation.errors[0],
        details: passwordValidation.errors.join('; ')
      }, { status: 400 });
    }

    const user = await getUserById(session.user_id);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const result = await query<{ password_hash: string }>(
      'SELECT password_hash FROM users WHERE id = $1',
      [session.user_id]
    );

    if (result.rows.length === 0 || !result.rows[0].password_hash) {
      await logAuthEvent(
        'PASSWORD_CHANGE_FAILED',
        session.user_id,
        user.email,
        false,
        { ipAddress, userAgent, details: 'User has no password (OAuth account)' }
      );
      return NextResponse.json({ 
        error: 'Cannot change password for OAuth accounts. Please use the login method you originally signed up with.' 
      }, { status: 400 });
    }

    const storedPasswordHash = result.rows[0].password_hash;

    if (!verifyPassword(currentPassword, storedPasswordHash)) {
      await logAuthEvent(
        'PASSWORD_CHANGE_FAILED',
        session.user_id,
        user.email,
        false,
        { ipAddress, userAgent, details: 'Invalid current password' }
      );
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });
    }

    const newPasswordHash = hashPassword(newPassword);

    await query(
      'UPDATE users SET password_hash = $1, updated_at = $2 WHERE id = $3',
      [newPasswordHash, new Date().toISOString(), session.user_id]
    );

    await logAuthEvent(
      'PASSWORD_CHANGE_SUCCESS',
      session.user_id,
      user.email,
      true,
      { ipAddress, userAgent, details: 'Password changed successfully' }
    );

    console.log('[PASSWORD_CHANGE] Password changed successfully for user:', session.user_id);

    return NextResponse.json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    console.error('[PASSWORD_CHANGE] Error:', error);
    return NextResponse.json(
      { error: 'Failed to change password. Please try again.' },
      { status: 500 }
    );
  }
}
