/**
 * Admin Dispute Stats API
 * 
 * GET /api/admin/disputes/stats - Get dispute statistics
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { validateSession } from '@/lib/db/dal/sessions';
import { getDisputeStats } from '@/lib/db/dal/disputes';

export async function GET() {
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

    const stats = await getDisputeStats();
    return NextResponse.json(stats);
  } catch (error) {
    console.error('[Admin Dispute Stats API] error:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
