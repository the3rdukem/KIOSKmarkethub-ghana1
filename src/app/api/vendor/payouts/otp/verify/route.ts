/**
 * Vendor Payout OTP Verification API
 * 
 * POST: Verify OTP for payout account security actions
 * 
 * Verifies the OTP and returns a temporary token that can be used
 * to authorize sensitive actions like adding payout accounts.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { validateSession } from '@/lib/db/dal/sessions';
import { getUserById } from '@/lib/db/dal/users';
import { query } from '@/lib/db';
import { createHmac, randomBytes } from 'crypto';

const MAX_OTP_ATTEMPTS = 5;

function getOTPPepper(): string {
  const pepper = process.env.OTP_SECRET_PEPPER;
  if (!pepper && process.env.NODE_ENV === 'production') {
    throw new Error('OTP_SECRET_PEPPER must be configured in production');
  }
  return pepper || 'kiosk-otp-dev-pepper-not-for-production';
}

function hashOTP(otp: string): string {
  return createHmac('sha256', getOTPPepper()).update(otp).digest('hex');
}

function generatePayoutToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * POST /api/vendor/payouts/otp/verify
 * Verify OTP and get authorization token for payout actions
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const session = await validateSession(sessionToken);
    if (!session || session.user_role !== 'vendor') {
      return NextResponse.json({ error: 'Vendor access required' }, { status: 403 });
    }

    const body = await request.json();
    const { otp } = body;

    if (!otp || typeof otp !== 'string' || otp.length !== 6) {
      return NextResponse.json({ error: 'Invalid OTP format' }, { status: 400 });
    }

    const user = await getUserById(session.user_id);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (!user.phone_verified) {
      return NextResponse.json({ 
        error: 'Phone verification required',
        code: 'PHONE_NOT_VERIFIED'
      }, { status: 403 });
    }

    if ((user.phone_otp_attempts || 0) >= MAX_OTP_ATTEMPTS) {
      return NextResponse.json({
        error: 'Too many failed attempts. Please request a new code.',
        code: 'MAX_ATTEMPTS_EXCEEDED',
        attemptsRemaining: 0
      }, { status: 429 });
    }

    if (!user.phone_otp_expires || new Date(user.phone_otp_expires) < new Date()) {
      return NextResponse.json({
        error: 'Verification code has expired. Please request a new code.',
        code: 'OTP_EXPIRED'
      }, { status: 400 });
    }

    const providedHash = hashOTP(otp);
    
    if (providedHash !== user.phone_otp_hash) {
      const newAttempts = (user.phone_otp_attempts || 0) + 1;
      await query(
        `UPDATE users SET phone_otp_attempts = $1, updated_at = $2 WHERE id = $3`,
        [newAttempts, new Date().toISOString(), user.id]
      );
      
      return NextResponse.json({
        error: 'Invalid verification code',
        code: 'INVALID_OTP',
        attemptsRemaining: MAX_OTP_ATTEMPTS - newAttempts
      }, { status: 400 });
    }

    const payoutToken = generatePayoutToken();
    const tokenExpires = new Date(Date.now() + 15 * 60 * 1000);

    await query(
      `UPDATE users SET 
        phone_otp_hash = NULL,
        phone_otp_expires = NULL,
        phone_otp_attempts = 0,
        payout_auth_token = $1,
        payout_auth_expires = $2,
        updated_at = $3
      WHERE id = $4`,
      [payoutToken, tokenExpires.toISOString(), new Date().toISOString(), user.id]
    );

    return NextResponse.json({
      success: true,
      message: 'Verification successful',
      payoutToken,
      expiresIn: 15 * 60
    });

  } catch (error) {
    console.error('[Payout OTP Verify API] Error:', error);
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}
