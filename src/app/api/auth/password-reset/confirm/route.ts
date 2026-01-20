/**
 * Password Reset Confirm API
 * 
 * POST /api/auth/password-reset/confirm
 * 
 * Validates token and updates password.
 * Does NOT create a session - user must log in after reset.
 */

import { NextRequest, NextResponse } from 'next/server';
import { resetPassword, validateResetToken } from '@/lib/db/dal/password-reset';
import { logAuthEvent } from '@/lib/db/dal/audit';

export async function POST(request: NextRequest) {
  const ipAddress = request.headers.get('x-forwarded-for') || undefined;
  const userAgent = request.headers.get('user-agent') || undefined;

  try {
    const body = await request.json();
    const { token, newPassword } = body;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Reset token is required' },
        { status: 400 }
      );
    }

    if (!newPassword) {
      return NextResponse.json(
        { success: false, error: 'New password is required' },
        { status: 400 }
      );
    }

    console.log('[PASSWORD_RESET_CONFIRM] Processing reset request');

    const result = await resetPassword(token, newPassword);

    if (!result.success) {
      const tokenValidation = await validateResetToken(token);
      
      await logAuthEvent(
        'PASSWORD_RESET_FAILED',
        tokenValidation.userId || 'unknown',
        'unknown',
        false,
        { ipAddress, userAgent, details: result.error }
      );

      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    const tokenValidation = await validateResetToken(token);
    
    await logAuthEvent(
      'PASSWORD_RESET_SUCCESS',
      tokenValidation.userId || 'unknown',
      'unknown',
      true,
      { ipAddress, userAgent, details: 'Password successfully reset' }
    );

    console.log('[PASSWORD_RESET_CONFIRM] Password reset successful');

    return NextResponse.json({
      success: true,
      message: 'Your password has been reset successfully. Please log in with your new password.',
    });
  } catch (error) {
    console.error('[PASSWORD_RESET_CONFIRM] Error:', error);

    return NextResponse.json(
      { success: false, error: 'Failed to reset password. Please try again.' },
      { status: 500 }
    );
  }
}
