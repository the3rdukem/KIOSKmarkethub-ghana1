import { NextRequest, NextResponse } from 'next/server';
import { sendPhoneOTP, isValidGhanaPhone, normalizePhoneNumber } from '@/lib/db/dal/phone-auth';
import { withRateLimit, getClientIdentifier } from '@/lib/utils/rate-limiter';

export async function POST(request: NextRequest) {
  const rateLimitCheck = await withRateLimit(request, 'otp_send', getClientIdentifier(request));
  if (!rateLimitCheck.allowed) {
    return rateLimitCheck.response;
  }

  try {
    const body = await request.json();
    const { phone } = body;

    if (!phone) {
      return NextResponse.json(
        { success: false, error: 'Phone number is required' },
        { status: 400 }
      );
    }

    const normalizedPhone = normalizePhoneNumber(phone);
    
    if (!isValidGhanaPhone(normalizedPhone)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid Ghana phone number. Please use format: 0XX XXX XXXX or +233 XX XXX XXXX' 
        },
        { status: 400 }
      );
    }

    const result = await sendPhoneOTP(normalizedPhone);

    if (!result.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: result.message,
          cooldownRemaining: result.cooldownRemaining 
        },
        { status: 429 }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message
    });
  } catch (error) {
    console.error('[OTP Send] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to send verification code' },
      { status: 500 }
    );
  }
}
