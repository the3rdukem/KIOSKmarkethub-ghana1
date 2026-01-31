/**
 * Vendor Payout OTP API
 * 
 * POST: Request OTP for payout account security actions
 * 
 * Sends an OTP to the vendor's verified phone number AND email for confirming
 * sensitive actions like adding payout accounts. Dual delivery for reliability.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { validateSession } from '@/lib/db/dal/sessions';
import { getUserById } from '@/lib/db/dal/users';
import { query } from '@/lib/db';
import { createHmac, randomInt } from 'crypto';
import { getIntegrationById } from '@/lib/db/dal/integrations';
import { sendEmail } from '@/lib/email/email-service';

const OTP_EXPIRY_MINUTES = 10;
const OTP_COOLDOWN_SECONDS = 60;
const OTP_LENGTH = 6;

function getOTPPepper(): string {
  const pepper = process.env.OTP_SECRET_PEPPER;
  if (!pepper && process.env.NODE_ENV === 'production') {
    console.error('[SECURITY] OTP_SECRET_PEPPER environment variable is not set in production!');
    throw new Error('OTP_SECRET_PEPPER must be configured in production');
  }
  return pepper || 'kiosk-otp-dev-pepper-not-for-production';
}

function generateOTP(): string {
  const min = Math.pow(10, OTP_LENGTH - 1);
  const max = Math.pow(10, OTP_LENGTH) - 1;
  return randomInt(min, max + 1).toString();
}

function hashOTP(otp: string): string {
  return createHmac('sha256', getOTPPepper()).update(otp).digest('hex');
}

function maskPhone(phone: string): string {
  if (phone.length < 6) return phone;
  return phone.slice(0, 4) + '****' + phone.slice(-3);
}

function formatPhoneForArkesel(phone: string): string {
  let cleaned = phone.replace(/[\s\-\(\)\+]/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '233' + cleaned.substring(1);
  }
  if (!cleaned.startsWith('233')) {
    cleaned = '233' + cleaned;
  }
  return cleaned;
}

async function getArkeselConfig(): Promise<{ apiKey: string; senderId: string; isDemoMode: boolean } | null> {
  try {
    const integration = await getIntegrationById('arkesel_otp');
    
    if (!integration || !integration.isEnabled || !integration.isConfigured) {
      return null;
    }
    
    const apiKey = integration.credentials?.apiKey;
    const senderId = integration.credentials?.senderId;
    
    if (!apiKey || !senderId) {
      return null;
    }
    
    return {
      apiKey,
      senderId,
      isDemoMode: integration.environment === 'demo'
    };
  } catch (error) {
    console.error('[Payout OTP] Error loading Arkesel config:', error);
    return null;
  }
}

async function sendOTPviaSMS(phone: string, otp: string): Promise<{ success: boolean; error?: string }> {
  try {
    const config = await getArkeselConfig();
    
    if (!config) {
      console.log('[Payout OTP] SMS service not configured');
      return { 
        success: process.env.NODE_ENV !== 'production',
        error: process.env.NODE_ENV === 'production' 
          ? 'SMS service not configured' 
          : undefined
      };
    }

    const formattedPhone = formatPhoneForArkesel(phone);
    const message = `Your KIOSK payout security code is: ${otp}. Valid for ${OTP_EXPIRY_MINUTES} minutes. Do not share this code with anyone.`;
    
    if (config.isDemoMode) {
      console.log('[Payout OTP DEMO] OTP:', otp, 'to:', formattedPhone);
      return { success: true };
    }
    
    const response = await fetch('https://sms.arkesel.com/api/v2/sms/send', {
      method: 'POST',
      headers: {
        'api-key': config.apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sender: config.senderId,
        message,
        recipients: [formattedPhone]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Payout OTP] SMS API error:', response.status, errorText);
      return { success: false, error: 'SMS delivery failed' };
    }

    const result = await response.json();
    const isSuccess = result.status === 'success' || result.code === 'ok';
    return { 
      success: isSuccess,
      error: isSuccess ? undefined : 'SMS delivery failed'
    };
  } catch (error) {
    console.error('[Payout OTP] Failed to send SMS:', error);
    return { success: false, error: 'SMS service error' };
  }
}

async function sendOTPviaEmail(
  email: string, 
  otp: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!email || email.includes('@phone.kiosk.local')) {
      return { success: true };
    }

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #16a34a;">KIOSK Payout Security Code</h2>
        <p>You requested a code to add a payout account.</p>
        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
          <p style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1f2937; margin: 0;">
            ${otp}
          </p>
        </div>
        <p style="color: #6b7280; font-size: 14px;">
          This code is valid for ${OTP_EXPIRY_MINUTES} minutes. Do not share this code with anyone.
        </p>
        <p style="color: #6b7280; font-size: 14px;">
          If you didn't request this code, please secure your account immediately.
        </p>
      </div>
    `;

    const result = await sendEmail({
      to: email,
      subject: 'Your KIOSK Payout Security Code',
      html: htmlContent,
      text: `Your KIOSK payout security code is: ${otp}\n\nThis code is valid for ${OTP_EXPIRY_MINUTES} minutes.\nDo not share this code with anyone.`,
    });

    return { success: result.success, error: result.error };
  } catch (error) {
    console.error('[Payout OTP] Email error:', error);
    return { success: false, error: 'Email service error' };
  }
}

/**
 * POST /api/vendor/payouts/otp
 * Request OTP for payout account security
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

    const user = await getUserById(session.user_id);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (!user.phone_verified || !user.phone) {
      return NextResponse.json({ 
        error: 'Phone verification required',
        code: 'PHONE_NOT_VERIFIED'
      }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const purpose = body.purpose || 'payout_account';

    const lastSent = user.phone_otp_last_sent ? new Date(user.phone_otp_last_sent) : null;
    if (lastSent) {
      const secondsSinceLastSent = (Date.now() - lastSent.getTime()) / 1000;
      if (secondsSinceLastSent < OTP_COOLDOWN_SECONDS) {
        const remaining = Math.ceil(OTP_COOLDOWN_SECONDS - secondsSinceLastSent);
        return NextResponse.json({
          error: `Please wait ${remaining} seconds before requesting a new code`,
          code: 'OTP_COOLDOWN',
          cooldownRemaining: remaining
        }, { status: 429 });
      }
    }

    const otp = generateOTP();
    const otpHash = hashOTP(otp);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
    const now = new Date();

    // Dual delivery: Send OTP via both SMS and Email in parallel
    const [smsSent, emailSent] = await Promise.all([
      sendOTPviaSMS(user.phone, otp),
      sendOTPviaEmail(user.email || '', otp)
    ]);
    
    // Success if at least one delivery method worked
    const deliverySuccess = smsSent.success || emailSent.success;
    
    if (!deliverySuccess) {
      return NextResponse.json({ 
        error: 'Failed to send verification code. Please try again.',
        code: 'DELIVERY_FAILED'
      }, { status: 500 });
    }
    
    console.log('[Payout OTP] Delivery status:', {
      sms: smsSent.success ? 'sent' : 'failed',
      email: user.email && !user.email.includes('@phone.kiosk.local') 
        ? (emailSent.success ? 'sent' : 'failed') 
        : 'skipped'
    });

    await query(
      `UPDATE users SET 
        phone_otp_hash = $1,
        phone_otp_expires = $2,
        phone_otp_attempts = 0,
        phone_otp_last_sent = $3,
        updated_at = $4
      WHERE id = $5`,
      [otpHash, expiresAt, now, now.toISOString(), user.id]
    );

    return NextResponse.json({
      success: true,
      message: `Verification code sent to ${maskPhone(user.phone)}`,
      purpose,
      expiresIn: OTP_EXPIRY_MINUTES * 60
    });

  } catch (error) {
    console.error('[Payout OTP API] Error:', error);
    return NextResponse.json({ error: 'Failed to send verification code' }, { status: 500 });
  }
}
