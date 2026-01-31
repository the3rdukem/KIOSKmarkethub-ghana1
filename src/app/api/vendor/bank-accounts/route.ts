/**
 * Vendor Bank Accounts API
 * 
 * Manages vendor payout destinations (bank accounts and mobile money)
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { validateSession } from '@/lib/db/dal/sessions';
import { getUserById } from '@/lib/db/dal/users';
import { query } from '@/lib/db';
import { 
  getVendorBankAccounts, 
  addBankAccount, 
  deleteBankAccount,
  setPrimaryBankAccount,
  verifyAndRegisterBankAccount
} from '@/lib/db/dal/payouts';

/**
 * GET /api/vendor/bank-accounts
 * Get all bank accounts for the authenticated vendor
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

    const accounts = await getVendorBankAccounts(session.user_id);

    return NextResponse.json({ accounts });
  } catch (error) {
    console.error('[Vendor Bank Accounts API] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch bank accounts' }, { status: 500 });
  }
}

/**
 * POST /api/vendor/bank-accounts
 * Add a new bank account
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

    // Security: Require verified phone before adding payout accounts
    const user = await getUserById(session.user_id);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    if (!user.phone_verified) {
      return NextResponse.json({ 
        error: 'Phone verification required',
        code: 'PHONE_NOT_VERIFIED',
        message: 'You must verify your phone number before adding payout accounts. Please update your profile with a verified phone number.'
      }, { status: 403 });
    }

    const body = await request.json();
    const { 
      account_type, 
      bank_code, 
      bank_name, 
      account_number, 
      account_name,
      mobile_money_provider,
      is_primary,
      payoutToken 
    } = body;

    // Security: Require OTP verification for adding payout accounts
    if (!payoutToken) {
      return NextResponse.json({ 
        error: 'OTP verification required',
        code: 'OTP_REQUIRED',
        message: 'Please verify with OTP before adding a payout account.'
      }, { status: 403 });
    }

    // Validate payout auth token
    if (user.payout_auth_token !== payoutToken) {
      return NextResponse.json({ 
        error: 'Invalid or expired verification',
        code: 'INVALID_TOKEN'
      }, { status: 403 });
    }

    if (!user.payout_auth_expires || new Date(user.payout_auth_expires) < new Date()) {
      return NextResponse.json({ 
        error: 'Verification expired. Please verify again.',
        code: 'TOKEN_EXPIRED'
      }, { status: 403 });
    }

    if (!account_type || !account_number || !account_name) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (account_type === 'bank' && !bank_code) {
      return NextResponse.json({ error: 'Bank code is required for bank accounts' }, { status: 400 });
    }

    if (account_type === 'mobile_money' && !mobile_money_provider) {
      return NextResponse.json({ error: 'Mobile money provider is required' }, { status: 400 });
    }

    const result = await addBankAccount({
      vendor_id: session.user_id,
      account_type,
      bank_code,
      bank_name,
      account_number,
      account_name,
      mobile_money_provider,
      is_primary,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // Security: Invalidate payout token after successful use to prevent reuse
    await query(
      `UPDATE users SET payout_auth_token = NULL, payout_auth_expires = NULL, updated_at = $1 WHERE id = $2`,
      [new Date().toISOString(), session.user_id]
    );

    return NextResponse.json({ account: result.account });
  } catch (error) {
    console.error('[Vendor Bank Accounts API] POST error:', error);
    return NextResponse.json({ error: 'Failed to add bank account' }, { status: 500 });
  }
}

/**
 * PATCH /api/vendor/bank-accounts
 * Update bank account (set primary or verify)
 */
export async function PATCH(request: NextRequest) {
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
    const { account_id, action } = body;

    if (!account_id || !action) {
      return NextResponse.json({ error: 'Missing account_id or action' }, { status: 400 });
    }

    if (action === 'set_primary') {
      const success = await setPrimaryBankAccount(session.user_id, account_id);
      if (!success) {
        return NextResponse.json({ error: 'Failed to set primary account' }, { status: 400 });
      }
      return NextResponse.json({ success: true });
    }

    if (action === 'verify') {
      const result = await verifyAndRegisterBankAccount(account_id);
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('[Vendor Bank Accounts API] PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update bank account' }, { status: 500 });
  }
}

/**
 * DELETE /api/vendor/bank-accounts
 * Delete a bank account
 */
export async function DELETE(request: NextRequest) {
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
    const accountId = searchParams.get('id');

    if (!accountId) {
      return NextResponse.json({ error: 'Account ID required' }, { status: 400 });
    }

    const success = await deleteBankAccount(session.user_id, accountId);
    if (!success) {
      return NextResponse.json({ error: 'Failed to delete bank account' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Vendor Bank Accounts API] DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete bank account' }, { status: 500 });
  }
}
