/**
 * Password Reset Request API
 * 
 * POST /api/auth/password-reset/request
 * 
 * Initiates password reset flow by sending a reset email.
 * ALWAYS returns 200 OK to prevent email enumeration.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createPasswordResetToken } from '@/lib/db/dal/password-reset';
import { sendEmail } from '@/lib/email';
import { logAuthEvent } from '@/lib/db/dal/audit';
import { validateEmail } from '@/lib/validation';
import { withRateLimit, getClientIdentifier } from '@/lib/utils/rate-limiter';

export async function POST(request: NextRequest) {
  const ipAddress = request.headers.get('x-forwarded-for') || undefined;
  const userAgent = request.headers.get('user-agent') || undefined;

  const rateLimitCheck = await withRateLimit(request, 'password_reset', getClientIdentifier(request));
  if (!rateLimitCheck.allowed) {
    return rateLimitCheck.response;
  }

  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ success: true, message: 'If an account exists with this email, you will receive a password reset link.' });
    }

    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      return NextResponse.json({ success: true, message: 'If an account exists with this email, you will receive a password reset link.' });
    }

    console.log('[PASSWORD_RESET_REQUEST] Processing request for:', email);

    const result = await createPasswordResetToken(email);

    if (result.success && result.token && result.expiresAt) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL;
      if (!baseUrl) {
        console.error('[PASSWORD_RESET] NEXT_PUBLIC_APP_URL is not configured');
        return NextResponse.json({ 
          success: false, 
          error: 'Password reset is not properly configured. Please contact support.' 
        }, { status: 500 });
      }
      const resetLink = `${baseUrl}/reset-password?token=${result.token}`;
      const siteName = 'KIOSK';
      const supportEmail = 'support@kiosk.com.gh';
      
      await sendEmail({
        to: email,
        subject: `Reset Your Password - ${siteName}`,
        templateId: 'password_reset',
        templateData: {
          userName: result.userName || 'User',
          siteName,
          siteUrl: baseUrl,
          resetLink,
          supportEmail,
        },
        html: `
          <h2>Reset Your Password</h2>
          <p>You requested to reset your password. Click the link below to set a new password:</p>
          <p><a href="${resetLink}">${resetLink}</a></p>
          <p>This link expires in 30 minutes.</p>
          <p>If you didn't request this, you can safely ignore this email.</p>
        `,
        text: `Reset Your Password\n\nYou requested to reset your password. Visit this link to set a new password:\n\n${resetLink}\n\nThis link expires in 30 minutes.\n\nIf you didn't request this, you can safely ignore this email.`,
      });

      await logAuthEvent(
        'PASSWORD_RESET_REQUESTED',
        result.userId || 'unknown',
        email,
        true,
        { ipAddress, userAgent, details: 'Reset token generated and email sent' }
      );

      console.log('[PASSWORD_RESET_REQUEST] Email sent to:', email);
    } else {
      console.log('[PASSWORD_RESET_REQUEST] No account found or ineligible:', email);
    }

    return NextResponse.json({
      success: true,
      message: 'If an account exists with this email, you will receive a password reset link.',
    });
  } catch (error) {
    console.error('[PASSWORD_RESET_REQUEST] Error:', error);
    
    return NextResponse.json({
      success: true,
      message: 'If an account exists with this email, you will receive a password reset link.',
    });
  }
}
