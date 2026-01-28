/**
 * Vendor Payouts API
 * 
 * Handles vendor balance and withdrawal requests
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { validateSession } from '@/lib/db/dal/sessions';
import { 
  getVendorBalance, 
  getVendorPayouts, 
  requestWithdrawal,
  getPrimaryBankAccount 
} from '@/lib/db/dal/payouts';

/**
 * GET /api/vendor/payouts
 * Get vendor balance and payout history
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

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'all';

    if (type === 'balance') {
      const balance = await getVendorBalance(session.user_id);
      return NextResponse.json({ balance });
    }

    if (type === 'history') {
      const limit = parseInt(searchParams.get('limit') || '20');
      const offset = parseInt(searchParams.get('offset') || '0');
      const status = searchParams.get('status') || undefined;

      const payouts = await getVendorPayouts(session.user_id, { status, limit, offset });
      return NextResponse.json({ payouts });
    }

    // Default: return both
    const [balance, payouts, primaryAccount] = await Promise.all([
      getVendorBalance(session.user_id),
      getVendorPayouts(session.user_id, { limit: 10 }),
      getPrimaryBankAccount(session.user_id),
    ]);

    return NextResponse.json({ 
      balance, 
      payouts,
      primary_account: primaryAccount,
    });
  } catch (error) {
    console.error('[Vendor Payouts API] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch payout data' }, { status: 500 });
  }
}

/**
 * POST /api/vendor/payouts
 * Request a withdrawal
 */
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { amount, bank_account_id } = body;

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    if (!bank_account_id) {
      return NextResponse.json({ error: 'Bank account required' }, { status: 400 });
    }

    const result = await requestWithdrawal({
      vendor_id: session.user_id,
      bank_account_id,
      amount,
      initiated_by: 'vendor',
      initiated_by_id: session.user_id,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ 
      success: true, 
      payout: result.payout,
      message: 'Withdrawal request submitted successfully'
    });
  } catch (error) {
    console.error('[Vendor Payouts API] POST error:', error);
    return NextResponse.json({ error: 'Failed to process withdrawal' }, { status: 500 });
  }
}
