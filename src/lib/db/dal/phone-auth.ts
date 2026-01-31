/**
 * Phone Authentication Data Access Layer
 *
 * Handles OTP generation, sending, and verification for phone-based authentication.
 * Works with the Arkesel SMS integration.
 * 
 * Security: Uses HMAC with server pepper for OTP hashing to prevent offline brute-force
 */

import { query } from '../index';
import { createHmac, randomInt } from 'crypto';
import { DbUser, getUserByPhone, getPhoneVariants } from './users';
import { getIntegrationById } from './integrations';

const OTP_EXPIRY_MINUTES = 10;
const OTP_COOLDOWN_SECONDS = 60;
const MAX_OTP_ATTEMPTS = 5;
const OTP_LENGTH = 6;

function getOTPPepper(): string {
  const pepper = process.env.OTP_SECRET_PEPPER;
  if (!pepper && process.env.NODE_ENV === 'production') {
    console.error('[SECURITY] OTP_SECRET_PEPPER environment variable is not set in production!');
    throw new Error('OTP_SECRET_PEPPER must be configured in production');
  }
  return pepper || 'kiosk-otp-dev-pepper-not-for-production';
}

const OTP_PEPPER = getOTPPepper();

export interface OTPResult {
  success: boolean;
  message: string;
  cooldownRemaining?: number;
}

export interface OTPVerifyResult {
  success: boolean;
  message: string;
  user?: DbUser;
  attemptsRemaining?: number;
}

function generateOTP(): string {
  const min = Math.pow(10, OTP_LENGTH - 1);
  const max = Math.pow(10, OTP_LENGTH) - 1;
  return randomInt(min, max + 1).toString();
}

function hashOTP(otp: string): string {
  return createHmac('sha256', OTP_PEPPER).update(otp).digest('hex');
}

export function normalizePhoneNumber(phone: string): string {
  let cleaned = phone.replace(/[\s\-\(\)]/g, '');
  
  if (cleaned.startsWith('00233')) {
    cleaned = '+233' + cleaned.slice(5);
  } else if (cleaned.startsWith('233') && !cleaned.startsWith('+')) {
    cleaned = '+' + cleaned;
  } else if (cleaned.startsWith('0') && cleaned.length === 10) {
    cleaned = '+233' + cleaned.slice(1);
  }
  
  return cleaned;
}

export function isValidGhanaPhone(phone: string): boolean {
  const normalized = normalizePhoneNumber(phone);
  return /^\+233[0-9]{9}$/.test(normalized);
}

export async function sendPhoneOTP(phone: string): Promise<OTPResult> {
  const normalizedPhone = normalizePhoneNumber(phone);
  
  if (!isValidGhanaPhone(normalizedPhone)) {
    return {
      success: false,
      message: 'Invalid Ghana phone number. Please use format: 0XX XXX XXXX or +233 XX XXX XXXX'
    };
  }

  const existingUser = await getUserByPhone(normalizedPhone);
  
  if (existingUser) {
    const lastSent = existingUser.phone_otp_last_sent ? new Date(existingUser.phone_otp_last_sent) : null;
    if (lastSent) {
      const secondsSinceLastSent = (Date.now() - lastSent.getTime()) / 1000;
      if (secondsSinceLastSent < OTP_COOLDOWN_SECONDS) {
        const remaining = Math.ceil(OTP_COOLDOWN_SECONDS - secondsSinceLastSent);
        return {
          success: false,
          message: `Please wait ${remaining} seconds before requesting a new code`,
          cooldownRemaining: remaining
        };
      }
    }
  }

  const otp = generateOTP();
  const otpHash = hashOTP(otp);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
  const now = new Date();

  const smsSent = await sendOTPviaSMS(normalizedPhone, otp);
  
  if (!smsSent.success) {
    return {
      success: false,
      message: 'Failed to send verification code. Please try again.'
    };
  }

  if (existingUser) {
    await query(
      `UPDATE users SET 
        phone_otp_hash = $1,
        phone_otp_expires = $2,
        phone_otp_attempts = 0,
        phone_otp_last_sent = $3,
        updated_at = $3
      WHERE id = $4`,
      [otpHash, expiresAt.toISOString(), now.toISOString(), existingUser.id]
    );
  } else {
    await query(
      `INSERT INTO users (id, email, name, role, status, phone, phone_otp_hash, phone_otp_expires, phone_otp_attempts, phone_otp_last_sent, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, $9, $10, $11)`,
      [
        `user_${Date.now()}_${randomInt(1000, 9999)}`,
        `pending_${normalizedPhone.replace('+', '')}@phone.kiosk.local`,
        'Phone User',
        'buyer',
        'pending',
        normalizedPhone,
        otpHash,
        expiresAt.toISOString(),
        now.toISOString(),
        now.toISOString(),
        now.toISOString()
      ]
    );
  }

  return {
    success: true,
    message: `Verification code sent to ${maskPhone(normalizedPhone)}`
  };
}

export async function verifyPhoneOTP(phone: string, otp: string): Promise<OTPVerifyResult> {
  const normalizedPhone = normalizePhoneNumber(phone);
  
  if (!isValidGhanaPhone(normalizedPhone)) {
    return {
      success: false,
      message: 'Invalid phone number format'
    };
  }

  const user = await getUserByPhone(normalizedPhone);
  
  if (!user) {
    return {
      success: false,
      message: 'No verification pending for this phone number'
    };
  }

  if (user.is_deleted === 1) {
    return {
      success: false,
      message: 'This account has been deleted'
    };
  }

  if (user.status === 'banned') {
    return {
      success: false,
      message: 'This account has been banned'
    };
  }

  if (user.status === 'suspended') {
    return {
      success: false,
      message: 'This account has been suspended. Please contact support.'
    };
  }

  if (user.phone_otp_attempts >= MAX_OTP_ATTEMPTS) {
    return {
      success: false,
      message: 'Too many failed attempts. Please request a new code.',
      attemptsRemaining: 0
    };
  }

  if (!user.phone_otp_expires || new Date(user.phone_otp_expires) < new Date()) {
    return {
      success: false,
      message: 'Verification code has expired. Please request a new code.'
    };
  }

  const providedHash = hashOTP(otp);
  
  if (providedHash !== user.phone_otp_hash) {
    const newAttempts = user.phone_otp_attempts + 1;
    await query(
      `UPDATE users SET phone_otp_attempts = $1, updated_at = $2 WHERE id = $3`,
      [newAttempts, new Date().toISOString(), user.id]
    );
    
    return {
      success: false,
      message: 'Invalid verification code',
      attemptsRemaining: MAX_OTP_ATTEMPTS - newAttempts
    };
  }

  await query(
    `UPDATE users SET 
      phone_verified = TRUE,
      phone_otp_hash = NULL,
      phone_otp_expires = NULL,
      phone_otp_attempts = 0,
      status = CASE WHEN status = 'pending' THEN 'active' ELSE status END,
      updated_at = $1
    WHERE id = $2`,
    [new Date().toISOString(), user.id]
  );

  const updatedUser = await getUserByPhone(normalizedPhone);
  
  return {
    success: true,
    message: 'Phone number verified successfully',
    user: updatedUser || undefined
  };
}

export async function resendPhoneOTP(phone: string): Promise<OTPResult> {
  return sendPhoneOTP(phone);
}

export async function isPhoneVerified(phone: string): Promise<boolean> {
  const normalizedPhone = normalizePhoneNumber(phone);
  const user = await getUserByPhone(normalizedPhone);
  return user?.phone_verified === true;
}

export async function getOTPStatus(phone: string): Promise<{
  exists: boolean;
  verified: boolean;
  hasPendingOTP: boolean;
  canResend: boolean;
  cooldownRemaining: number;
}> {
  const normalizedPhone = normalizePhoneNumber(phone);
  const user = await getUserByPhone(normalizedPhone);
  
  if (!user) {
    return {
      exists: false,
      verified: false,
      hasPendingOTP: false,
      canResend: true,
      cooldownRemaining: 0
    };
  }

  const lastSent = user.phone_otp_last_sent ? new Date(user.phone_otp_last_sent) : null;
  let cooldownRemaining = 0;
  
  if (lastSent) {
    const secondsSinceLastSent = (Date.now() - lastSent.getTime()) / 1000;
    if (secondsSinceLastSent < OTP_COOLDOWN_SECONDS) {
      cooldownRemaining = Math.ceil(OTP_COOLDOWN_SECONDS - secondsSinceLastSent);
    }
  }

  const hasPendingOTP = !!(
    user.phone_otp_hash &&
    user.phone_otp_expires &&
    new Date(user.phone_otp_expires) > new Date()
  );

  return {
    exists: true,
    verified: user.phone_verified === true,
    hasPendingOTP,
    canResend: cooldownRemaining === 0,
    cooldownRemaining
  };
}

function maskPhone(phone: string): string {
  if (phone.length < 6) return phone;
  return phone.slice(0, 4) + '****' + phone.slice(-3);
}

async function getArkeselConfig(): Promise<{ apiKey: string; senderId: string; isDemoMode: boolean } | null> {
  try {
    const integration = await getIntegrationById('arkesel_otp');
    
    if (!integration) {
      console.log('[Phone Auth] Arkesel integration not found');
      return null;
    }
    
    if (!integration.isEnabled || !integration.isConfigured) {
      console.log('[Phone Auth] Arkesel integration not configured or not enabled', {
        isEnabled: integration.isEnabled,
        isConfigured: integration.isConfigured
      });
      return null;
    }
    
    const apiKey = integration.credentials?.apiKey;
    const senderId = integration.credentials?.senderId;
    
    if (!apiKey || !senderId) {
      console.log('[Phone Auth] Arkesel credentials incomplete');
      return null;
    }
    
    return {
      apiKey,
      senderId,
      isDemoMode: integration.environment === 'demo'
    };
  } catch (error) {
    console.error('[Phone Auth] Error loading Arkesel config:', error);
    return null;
  }
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

async function sendOTPviaSMS(phone: string, otp: string): Promise<{ success: boolean; error?: string }> {
  try {
    const config = await getArkeselConfig();
    
    if (!config) {
      console.log('[Phone Auth] SMS service not configured, OTP not sent');
      return { 
        success: process.env.NODE_ENV !== 'production',
        error: process.env.NODE_ENV === 'production' 
          ? 'SMS service not configured' 
          : undefined
      };
    }

    const formattedPhone = formatPhoneForArkesel(phone);
    const message = `Your KIOSK verification code is: ${otp}. Valid for ${OTP_EXPIRY_MINUTES} minutes. Do not share this code.`;
    
    if (config.isDemoMode) {
      console.log('[Phone Auth DEMO] OTP:', otp, 'to:', formattedPhone);
      console.log('[Phone Auth DEMO] Message:', message);
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
      console.error('[Phone Auth] SMS API error:', response.status, errorText);
      return { success: false, error: 'SMS delivery failed' };
    }

    const result = await response.json();
    console.log('[Phone Auth] SMS API response:', result);
    
    // Arkesel returns { status: "success" } on success
    const isSuccess = result.status === 'success' || result.code === 'ok';
    return { 
      success: isSuccess,
      error: isSuccess ? undefined : 'SMS delivery failed'
    };
  } catch (error) {
    console.error('[Phone Auth] Failed to send SMS:', error);
    return { success: false, error: 'SMS service error' };
  }
}

export { getPhoneVariants };
