/**
 * Admin Cancel Payout API
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { validateSession } from '@/lib/db/dal/sessions';
import { updatePayoutStatus, getPayoutById } from '@/lib/db/dal/payouts';
import { createAuditLog } from '@/lib/db/dal/audit';

/**
 * POST /api/admin/payouts/[id]/cancel
 * Cancel a pending payout
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

    if (!['pending', 'processing'].includes(payout.status)) {
      return NextResponse.json({ error: 'Cannot cancel this payout' }, { status: 400 });
    }

    const success = await updatePayoutStatus(payout.reference, 'cancelled', 'Cancelled by admin');

    if (!success) {
      return NextResponse.json({ error: 'Failed to cancel payout' }, { status: 500 });
    }

    await createAuditLog({
      action: 'payout.cancelled',
      adminId: session.user_id,
      adminRole: session.user_role,
      category: 'vendor',
      targetId: payout.reference,
      targetType: 'payout',
      targetName: `Payout ${payout.reference}`,
      details: JSON.stringify({
        payout_id: payout.id,
        vendor_id: payout.vendor_id,
        amount: payout.amount,
      }),
      severity: 'info',
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Admin Cancel Payout API] POST error:', error);
    return NextResponse.json({ error: 'Failed to cancel payout' }, { status: 500 });
  }
}
