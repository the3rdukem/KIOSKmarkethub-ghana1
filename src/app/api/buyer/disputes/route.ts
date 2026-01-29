/**
 * Buyer Disputes API
 * 
 * GET /api/buyer/disputes - Get buyer's disputes
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { validateSession } from '@/lib/db/dal/sessions';
import { getBuyerDisputes } from '@/lib/db/dal/disputes';

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

    const disputes = await getBuyerDisputes(session.user_id);
    return NextResponse.json({ disputes });
  } catch (error) {
    console.error('[Buyer Disputes API] error:', error);
    return NextResponse.json({ error: 'Failed to fetch disputes' }, { status: 500 });
  }
}
