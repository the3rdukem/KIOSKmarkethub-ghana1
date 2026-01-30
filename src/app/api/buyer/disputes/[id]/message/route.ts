/**
 * Buyer Dispute Message API
 * 
 * POST /api/buyer/disputes/[id]/message - Add a message to a dispute
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { validateSession } from '@/lib/db/dal/sessions';
import { getDisputeById, addDisputeMessage } from '@/lib/db/dal/disputes';
import { getUserById } from '@/lib/db/dal/users';
import { createNotification } from '@/lib/db/dal/notifications';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const session = await validateSession(sessionToken);
    if (!session) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    if (session.user_role !== 'buyer') {
      return NextResponse.json({ error: 'Buyer access required' }, { status: 403 });
    }

    const dispute = await getDisputeById(id);
    if (!dispute) {
      return NextResponse.json({ error: 'Dispute not found' }, { status: 404 });
    }

    if (dispute.buyer_id !== session.user_id) {
      return NextResponse.json({ error: 'Not authorized to message on this dispute' }, { status: 403 });
    }

    if (dispute.status === 'resolved' || dispute.status === 'closed') {
      return NextResponse.json({ error: 'Cannot add messages to resolved or closed disputes' }, { status: 400 });
    }

    const body = await request.json();
    const { message } = body;

    if (!message || typeof message !== 'string' || message.trim().length < 5) {
      return NextResponse.json({ error: 'Message must be at least 5 characters' }, { status: 400 });
    }

    if (message.length > 2000) {
      return NextResponse.json({ error: 'Message cannot exceed 2000 characters' }, { status: 400 });
    }

    const buyer = await getUserById(session.user_id);
    const buyerName = buyer?.name || 'Buyer';

    const updatedDispute = await addDisputeMessage(
      id,
      session.user_id,
      buyerName,
      'buyer',
      message.trim()
    );

    if (!updatedDispute) {
      return NextResponse.json({ error: 'Failed to add message' }, { status: 500 });
    }

    // Notify vendor about the buyer's reply
    try {
      await createNotification({
        userId: dispute.vendor_id,
        role: 'vendor',
        type: 'dispute_message',
        title: 'Buyer Response to Dispute',
        message: `${buyerName} has replied to the dispute for order #${dispute.order_id.slice(-8).toUpperCase()}`,
        payload: {
          disputeId: id,
          orderId: dispute.order_id,
          buyerName,
          link: '/vendor/disputes'
        }
      });
    } catch (notifError) {
      console.error('[Buyer Dispute Message API] notification error:', notifError);
    }

    return NextResponse.json({ 
      success: true,
      dispute: updatedDispute,
      message: 'Response added successfully'
    });
  } catch (error) {
    console.error('[Buyer Dispute Message API] error:', error);
    return NextResponse.json({ error: 'Failed to add message' }, { status: 500 });
  }
}
