/**
 * Admin Retry Payout API
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { validateSession } from '@/lib/db/dal/sessions';
import { getPayoutById, getBankAccountById } from '@/lib/db/dal/payouts';
import { initiateTransfer } from '@/lib/services/paystack';
import { query } from '@/lib/db';
import { createAuditLog } from '@/lib/db/dal/audit';

/**
 * POST /api/admin/payouts/[id]/retry
 * Retry a failed payout
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const payout = await getPayoutById(id);

    if (!payout) {
      return NextResponse.json({ error: 'Payout not found' }, { status: 404 });
    }

    if (payout.status !== 'failed') {
      return NextResponse.json({ error: 'Can only retry failed payouts' }, { status: 400 });
    }

    const bankAccount = await getBankAccountById(payout.bank_account_id);
    if (!bankAccount || !bankAccount.paystack_recipient_code) {
      return NextResponse.json({ error: 'Bank account not properly configured' }, { status: 400 });
    }

    // Generate new reference
    const newReference = `PO-RETRY-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    // Retry the transfer
    const transferResult = await initiateTransfer({
      amount: Math.round(payout.net_amount * 100), // Convert to pesewas
      recipient: bankAccount.paystack_recipient_code,
      reference: newReference,
      reason: `KIOSK Vendor Payout (Retry)`,
    });

    if (!transferResult.success) {
      return NextResponse.json({ error: transferResult.error || 'Transfer failed' }, { status: 400 });
    }

    // Update payout with new reference and status
    await query(
      `UPDATE vendor_payouts 
       SET reference = $1, 
           transfer_code = $2, 
           status = 'processing', 
           failure_reason = NULL,
           updated_at = NOW() 
       WHERE id = $3`,
      [newReference, transferResult.data?.transfer_code, id]
    );

    await createAuditLog({
      action: 'payout.retry',
      adminId: session.user_id,
      adminRole: session.user_role,
      category: 'vendor',
      targetId: newReference,
      targetType: 'payout',
      targetName: `Payout ${newReference}`,
      details: JSON.stringify({
        payout_id: payout.id,
        old_reference: payout.reference,
        new_reference: newReference,
        vendor_id: payout.vendor_id,
        amount: payout.net_amount,
      }),
      severity: 'info',
    });

    return NextResponse.json({ 
      success: true,
      reference: newReference,
      transfer_code: transferResult.data?.transfer_code,
    });
  } catch (error) {
    console.error('[Admin Retry Payout API] POST error:', error);
    return NextResponse.json({ error: 'Failed to retry payout' }, { status: 500 });
  }
}
