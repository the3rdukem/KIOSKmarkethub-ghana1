import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyPhoneOTP, normalizePhoneNumber, isValidGhanaPhone } from '@/lib/db/dal/phone-auth';
import { createSession } from '@/lib/db/dal/sessions';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 7 * 24 * 60 * 60,
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone, otp } = body;

    if (!phone || !otp) {
      return NextResponse.json(
        { success: false, error: 'Phone number and verification code are required' },
        { status: 400 }
      );
    }

    if (!/^\d{6}$/.test(otp)) {
      return NextResponse.json(
        { success: false, error: 'Verification code must be 6 digits' },
        { status: 400 }
      );
    }

    const normalizedPhone = normalizePhoneNumber(phone);
    
    if (!isValidGhanaPhone(normalizedPhone)) {
      return NextResponse.json(
        { success: false, error: 'Invalid phone number format' },
        { status: 400 }
      );
    }

    const result = await verifyPhoneOTP(normalizedPhone, otp);

    if (!result.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: result.message,
          attemptsRemaining: result.attemptsRemaining
        },
        { status: 400 }
      );
    }

    if (result.user) {
      const isPending = result.user.status === 'pending';
      
      if (!isPending) {
        const { session, token } = await createSession(result.user.id, result.user.role);
        
        const cookieStore = await cookies();
        cookieStore.set('session_token', token, COOKIE_OPTIONS);
      }

      return NextResponse.json({
        success: true,
        message: result.message,
        user: {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
          role: result.user.role,
          phone: result.user.phone,
          phoneVerified: result.user.phone_verified,
          status: result.user.status
        }
      });
    }

    return NextResponse.json({
      success: true,
      message: result.message
    });
  } catch (error) {
    console.error('[OTP Verify] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to verify code' },
      { status: 500 }
    );
  }
}
