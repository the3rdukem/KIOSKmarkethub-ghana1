/**
 * User Registration API Route
 *
 * Uses atomic auth service - ALL steps in ONE transaction.
 * If ANY step fails, NOTHING is created.
 * Includes AUDIT LOGGING for all registration events.
 * 
 * Sets ONLY session_token cookie (httpOnly).
 * Role is derived from session validation, not separate cookies.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { registerUser, getRouteForRole, type AuthErrorCode } from '@/lib/db/dal/auth-service';
import { logAuthEvent } from '@/lib/db/dal/audit';
import { isPhoneInUse } from '@/lib/db/dal/users';
import { 
  validatePhone, 
  normalizePhone, 
  validateEmail, 
  validateName, 
  validateBusinessName, 
  validateAddress,
  validateContentSafety 
} from '@/lib/validation';
import { setCsrfCookie } from '@/lib/utils/csrf';
import { createLogger } from '@/lib/utils/logger';

const log = createLogger('AUTH_REGISTER');

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 7 * 24 * 60 * 60,
};

function getHttpStatus(code: AuthErrorCode): number {
  switch (code) {
    case 'INVALID_INPUT': return 400;
    case 'EMAIL_EXISTS': return 409;
    case 'ROLE_ASSIGNMENT_FAILED': return 500;
    case 'SESSION_CREATION_FAILED': return 500;
    case 'VERIFICATION_STATE_MISSING': return 500;
    case 'PASSWORD_HASH_FAILED': return 500;
    case 'TRANSACTION_FAILED': return 500;
    default: return 500;
  }
}

export async function POST(request: NextRequest) {
  const ipAddress = request.headers.get('x-forwarded-for') || undefined;
  const userAgent = request.headers.get('user-agent') || undefined;

  try {
    const body = await request.json();
    const { email, password, name, role, phone, location, businessName, businessType, address } = body;

    // ===== COMPREHENSIVE VALIDATION =====
    
    // 1. Email validation (format + garbage detection)
    const emailResult = validateEmail(email);
    if (!emailResult.valid) {
      return NextResponse.json(
        { error: emailResult.message, code: emailResult.code, field: 'email' },
        { status: 400 }
      );
    }

    // 2. Name validation (content safety + garbage detection)
    // Parse first/last name if full name is provided
    const nameParts = (name || '').trim().split(/\s+/);
    if (nameParts.length >= 2) {
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ');
      
      const firstNameResult = validateName(firstName, 'First name');
      if (!firstNameResult.valid) {
        return NextResponse.json(
          { error: firstNameResult.message, code: firstNameResult.code, field: 'firstName' },
          { status: 400 }
        );
      }
      
      const lastNameResult = validateName(lastName, 'Last name');
      if (!lastNameResult.valid) {
        return NextResponse.json(
          { error: lastNameResult.message, code: lastNameResult.code, field: 'lastName' },
          { status: 400 }
        );
      }
    } else if (name) {
      // Single name validation
      const nameResult = validateName(name, 'Name');
      if (!nameResult.valid) {
        return NextResponse.json(
          { error: nameResult.message, code: nameResult.code, field: 'name' },
          { status: 400 }
        );
      }
    }

    // 3. Phone validation (Ghana format)
    if (phone) {
      const phoneResult = validatePhone(phone);
      if (!phoneResult.valid) {
        return NextResponse.json(
          { error: phoneResult.message, code: phoneResult.code, field: 'phone' },
          { status: 400 }
        );
      }
    }

    // Normalize phone for storage
    const normalizedPhone = phone ? normalizePhone(phone) : undefined;

    // 4. Phone uniqueness check
    if (normalizedPhone) {
      const phoneExists = await isPhoneInUse(normalizedPhone);
      if (phoneExists) {
        return NextResponse.json(
          { 
            error: 'This phone number is already associated with another account', 
            code: 'PHONE_ALREADY_IN_USE', 
            field: 'phone' 
          },
          { status: 409 }
        );
      }
    }

    // 5. Location/address validation (if provided)
    if (location) {
      const locationResult = validateAddress(location, 'Location');
      if (!locationResult.valid) {
        return NextResponse.json(
          { error: locationResult.message, code: locationResult.code, field: 'city' },
          { status: 400 }
        );
      }
      
      // Content safety check for location
      const locationSafetyResult = validateContentSafety(location);
      if (!locationSafetyResult.valid) {
        return NextResponse.json(
          { error: 'Location contains prohibited content', code: 'UNSAFE_CONTENT', field: 'city' },
          { status: 400 }
        );
      }
    }

    // 6. Vendor-specific validations
    if (role === 'vendor') {
      // Business name validation
      if (businessName) {
        const businessNameResult = validateBusinessName(businessName, 'Store name');
        if (!businessNameResult.valid) {
          return NextResponse.json(
            { error: businessNameResult.message, code: businessNameResult.code, field: 'businessName' },
            { status: 400 }
          );
        }
      }
      
      // Business address validation (vendors only)
      if (address) {
        const addressResult = validateAddress(address, 'Business address');
        if (!addressResult.valid) {
          return NextResponse.json(
            { error: addressResult.message, code: addressResult.code, field: 'address' },
            { status: 400 }
          );
        }
        
        // Content safety check for address
        const addressSafetyResult = validateContentSafety(address);
        if (!addressSafetyResult.valid) {
          return NextResponse.json(
            { error: 'Business address contains prohibited content', code: 'UNSAFE_CONTENT', field: 'address' },
            { status: 400 }
          );
        }
      }
    }

    log.info('Starting atomic registration', { email, role });

    // Note: Vendor business address is validated but stored in location field
    // Future enhancement: Add dedicated address column for vendors
    const result = await registerUser(
      { email, password, name, role, phone: normalizedPhone, location, businessName, businessType },
      { ipAddress, userAgent }
    );

    if (!result.success || !result.data) {
      const error = result.error!;
      log.warn('Registration failed', { code: error.code, message: error.message });

      await logAuthEvent(
        'REGISTRATION_FAILED',
        email || 'unknown',
        email || 'unknown',
        false,
        {
          ipAddress,
          userAgent,
          details: `${error.code}: ${error.message}. Role: ${role}`,
        }
      );

      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          details: error.details,
        },
        { status: getHttpStatus(error.code) }
      );
    }

    const { user, session } = result.data;
    log.info('Registration successful', { userId: user.id, role: user.role });

    await logAuthEvent(
      'REGISTRATION_SUCCESS',
      user.id,
      user.email,
      true,
      {
        ipAddress,
        userAgent,
        details: `New ${user.role} account created${user.role === 'vendor' ? ` (verification: ${user.verificationStatus})` : ''}`,
      }
    );

    const cookieStore = await cookies();

    cookieStore.set('session_token', session.token, COOKIE_OPTIONS);

    await setCsrfCookie();

    log.info('Session and CSRF cookies set');

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
        phone: user.phone,
        location: user.location,
        businessName: user.businessName,
        isVerified: user.verificationStatus === 'verified',
        verificationStatus: user.verificationStatus,
        createdAt: user.createdAt,
      },
      redirect: getRouteForRole(user.role),
    });
  } catch (error) {
    log.error('Unexpected error', {}, error);

    await logAuthEvent(
      'REGISTRATION_ERROR',
      'system',
      'unknown',
      false,
      {
        ipAddress,
        userAgent,
        details: error instanceof Error ? error.message : String(error),
      }
    );

    return NextResponse.json(
      {
        error: 'Registration failed due to an unexpected error',
        code: 'TRANSACTION_FAILED',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
