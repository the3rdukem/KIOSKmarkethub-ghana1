/**
 * Admin Payout Stats API
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { validateSession } from '@/lib/db/dal/sessions';
import { getPayoutStats } from '@/lib/db/dal/payouts';

/**
 * GET /api/admin/payouts/stats
 * Get payout statistics
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const session = await validateSession(sessionToken);
    if (!session || (session.user_role !== 'admin' && session.user_role !== 'master_admin')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const stats = await getPayoutStats();

    return NextResponse.json({ stats });
  } catch (error) {
    console.error('[Admin Payout Stats API] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch payout stats' }, { status: 500 });
  }
}
