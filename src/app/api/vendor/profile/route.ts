/**
 * Vendor Profile API
 * 
 * GET: Get the current vendor's profile (including vendor ID)
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateSessionToken } from '@/lib/db/dal/auth-service';
import { getVendorByUserId } from '@/lib/db/dal/vendors';
import { getUserById } from '@/lib/db/dal/users';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get('session_token')?.value;
    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await validateSessionToken(sessionToken);
    if (!result.success || !result.data) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const { session } = result.data;
    
    if (session.userRole !== 'vendor') {
      return NextResponse.json({ error: 'Not a vendor' }, { status: 403 });
    }

    const user = await getUserById(session.userId);
    const vendor = await getVendorByUserId(session.userId);

    return NextResponse.json({
      vendor: vendor ? {
        id: vendor.id,
        userId: vendor.user_id,
        businessName: vendor.business_name,
        verificationStatus: vendor.verification_status,
      } : null,
      user: user ? {
        id: user.id,
        name: user.name,
        email: user.email,
        businessName: user.business_name,
        phone: user.phone,
      } : null,
      phoneVerified: user?.phone_verified ?? false,
    });
  } catch (error) {
    console.error('[VENDOR_PROFILE_API] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch vendor profile' }, { status: 500 });
  }
}
