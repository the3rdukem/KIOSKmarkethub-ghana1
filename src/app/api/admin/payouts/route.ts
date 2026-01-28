/**
 * Admin Payouts API
 * 
 * Manages all vendor payouts (admin view)
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { validateSession } from '@/lib/db/dal/sessions';
import { getAllPayouts } from '@/lib/db/dal/payouts';

/**
 * GET /api/admin/payouts
 * Get all payouts with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const session = await validateSession(sessionToken);
    if (!session || session.user_role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const vendor_id = searchParams.get('vendor_id') || undefined;
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    const payouts = await getAllPayouts({
      status,
      vendorId: vendor_id,
      limit,
      offset,
    });

    return NextResponse.json({ payouts });
  } catch (error) {
    console.error('[Admin Payouts API] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch payouts' }, { status: 500 });
  }
}
