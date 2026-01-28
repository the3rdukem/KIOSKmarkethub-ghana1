/**
 * Ghana Banks List API
 * 
 * Returns list of banks in Ghana from Paystack
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { validateSession } from '@/lib/db/dal/sessions';
import { listGhanaBanks } from '@/lib/services/paystack';

/**
 * GET /api/vendor/banks
 * Get list of banks in Ghana
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const session = await validateSession(sessionToken);
    if (!session || session.user_role !== 'vendor') {
      return NextResponse.json({ error: 'Vendor access required' }, { status: 403 });
    }

    const result = await listGhanaBanks();

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to fetch banks' }, { status: 500 });
    }

    return NextResponse.json({ banks: result.banks || [] });
  } catch (error) {
    console.error('[Vendor Banks API] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch banks list' }, { status: 500 });
  }
}
