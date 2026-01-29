/**
 * Vendor Disputes API
 * 
 * GET /api/vendor/disputes - Get disputes against vendor's orders
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { validateSession } from '@/lib/db/dal/sessions';
import { getVendorDisputes } from '@/lib/db/dal/disputes';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const session = await validateSession(sessionToken);
    if (!session) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    if (session.user_role !== 'vendor') {
      return NextResponse.json({ error: 'Vendor access required' }, { status: 403 });
    }

    const disputes = await getVendorDisputes(session.user_id);
    return NextResponse.json({ disputes });
  } catch (error) {
    console.error('[Vendor Disputes API] error:', error);
    return NextResponse.json({ error: 'Failed to fetch disputes' }, { status: 500 });
  }
}
