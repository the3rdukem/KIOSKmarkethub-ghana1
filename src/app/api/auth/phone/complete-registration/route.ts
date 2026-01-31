import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { query } from '@/lib/db';
import { normalizePhoneNumber, isValidGhanaPhone, getPhoneVariants } from '@/lib/db/dal/phone-auth';
import { createSession } from '@/lib/db/dal/sessions';
import { hashPassword } from '@/lib/db/dal/auth-service';

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
    const { phone, password, name, role, location, businessName, businessType, address } = body;

    if (!phone || !name || !password) {
      return NextResponse.json(
        { success: false, error: 'Phone, password, and name are required' },
        { status: 400 }
      );
    }

    const passwordErrors: string[] = [];
    if (password.length < 8) passwordErrors.push("at least 8 characters");
    if (!/[A-Z]/.test(password)) passwordErrors.push("one uppercase letter");
    if (!/[a-z]/.test(password)) passwordErrors.push("one lowercase letter");
    if (!/[0-9]/.test(password)) passwordErrors.push("one number");
    
    if (passwordErrors.length > 0) {
      return NextResponse.json(
        { success: false, error: `Password must contain ${passwordErrors.join(", ")}` },
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

    if (!['buyer', 'vendor'].includes(role)) {
      return NextResponse.json(
        { success: false, error: 'Invalid role' },
        { status: 400 }
      );
    }

    const phoneVariants = getPhoneVariants(normalizedPhone);
    const placeholders = phoneVariants.map((_, i) => `$${i + 1}`).join(', ');
    const result = await query(
      `SELECT * FROM users WHERE phone IN (${placeholders}) LIMIT 1`,
      phoneVariants
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Phone not verified. Please verify your phone first.' },
        { status: 400 }
      );
    }

    const user = result.rows[0];

    if (!user.phone_verified) {
      return NextResponse.json(
        { success: false, error: 'Phone not verified. Please verify your phone first.' },
        { status: 400 }
      );
    }

    if (user.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: 'Account already registered' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const passwordHash = hashPassword(password);
    
    const updateFields: string[] = [
      'name = $1',
      'role = $2',
      'status = $3',
      'password_hash = $4',
      'updated_at = $5'
    ];
    const updateValues: (string | null)[] = [name, role, 'active', passwordHash, now];
    let paramIndex = 6;

    if (location) {
      updateFields.push(`location = $${paramIndex}`);
      updateValues.push(location);
      paramIndex++;
    }

    if (role === 'vendor') {
      if (businessName) {
        updateFields.push(`store_name = $${paramIndex}`);
        updateValues.push(businessName);
        paramIndex++;
      }
      if (businessType) {
        updateFields.push(`business_type = $${paramIndex}`);
        updateValues.push(businessType);
        paramIndex++;
      }
      if (address) {
        updateFields.push(`address = $${paramIndex}`);
        updateValues.push(address);
        paramIndex++;
      }
    }

    updateValues.push(user.id as string);
    
    await query(
      `UPDATE users SET ${updateFields.join(', ')} WHERE id = $${paramIndex}`,
      updateValues
    );

    const { session, token } = await createSession(user.id as string, role as 'buyer' | 'vendor' | 'admin' | 'master_admin');
    
    const cookieStore = await cookies();
    cookieStore.set('session_token', token, COOKIE_OPTIONS);

    return NextResponse.json({
      success: true,
      message: 'Registration completed successfully',
      user: {
        id: user.id,
        email: user.email,
        name: name,
        role: role,
        phone: normalizedPhone,
        phoneVerified: true
      }
    });
  } catch (error) {
    console.error('[Phone Registration] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Registration failed' },
      { status: 500 }
    );
  }
}
