/**
 * Admin Dispute Detail API
 * 
 * GET /api/admin/disputes/[id] - Get dispute details
 * PATCH /api/admin/disputes/[id] - Update dispute (status, priority, assignment)
 * POST /api/admin/disputes/[id] - Special actions (resolve, escalate, close, add message)
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { validateSession } from '@/lib/db/dal/sessions';
import { 
  getDisputeById, 
  updateDispute, 
  resolveDispute, 
  escalateDispute, 
  closeDispute,
  addDisputeMessage
} from '@/lib/db/dal/disputes';
import { createNotification } from '@/lib/db/dal/notifications';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const session = await validateSession(sessionToken);
    if (!session || (session.user_role !== 'admin' && session.user_role !== 'master_admin')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const dispute = await getDisputeById(id);
    if (!dispute) {
      return NextResponse.json({ error: 'Dispute not found' }, { status: 404 });
    }

    return NextResponse.json({ dispute });
  } catch (error) {
    console.error('[Admin Dispute API] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch dispute' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const session = await validateSession(sessionToken);
    if (!session || (session.user_role !== 'admin' && session.user_role !== 'master_admin')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { status, priority, assignedTo, description } = body;

    const dispute = await updateDispute(
      id,
      { status, priority, assignedTo, description },
      session.user_id,
      session.user_role as 'admin' | 'master_admin'
    );

    if (!dispute) {
      return NextResponse.json({ error: 'Dispute not found' }, { status: 404 });
    }

    return NextResponse.json({ dispute });
  } catch (error) {
    console.error('[Admin Dispute API] PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update dispute' }, { status: 500 });
  }
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
    if (!session || (session.user_role !== 'admin' && session.user_role !== 'master_admin')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { action } = body;

    let dispute;

    switch (action) {
      case 'resolve': {
        const { resolutionType, resolution, refundAmount } = body;
        if (!resolutionType || !resolution) {
          return NextResponse.json({ error: 'Resolution type and description required' }, { status: 400 });
        }
        
        try {
          dispute = await resolveDispute(
            id,
            { resolutionType, resolution, refundAmount },
            session.user_id,
            session.user_role as 'admin' | 'master_admin'
          );
        } catch (e) {
          return NextResponse.json({ error: (e as Error).message }, { status: 400 });
        }

        if (dispute) {
          createNotification({
            userId: dispute.buyer_id,
            role: 'buyer',
            type: 'dispute_resolved',
            title: 'Dispute Resolved',
            message: `Your dispute for order #${dispute.order_id} has been resolved. Resolution: ${resolutionType}`,
            payload: { disputeId: dispute.id, orderId: dispute.order_id, resolutionType },
          }).catch(err => console.error('[NOTIFICATION] Failed to notify buyer:', err));

          createNotification({
            userId: dispute.vendor_id,
            role: 'vendor',
            type: 'dispute_resolved',
            title: 'Dispute Resolved',
            message: `A dispute for order #${dispute.order_id} has been resolved. Resolution: ${resolutionType}`,
            payload: { disputeId: dispute.id, orderId: dispute.order_id, resolutionType },
          }).catch(err => console.error('[NOTIFICATION] Failed to notify vendor:', err));
        }
        break;
      }

      case 'escalate': {
        const { reason } = body;
        dispute = await escalateDispute(
          id,
          session.user_id,
          session.user_role as 'admin' | 'master_admin',
          reason
        );
        break;
      }

      case 'close': {
        const { reason } = body;
        dispute = await closeDispute(
          id,
          session.user_id,
          session.user_role as 'admin' | 'master_admin',
          reason
        );

        if (dispute) {
          createNotification({
            userId: dispute.buyer_id,
            role: 'buyer',
            type: 'dispute_closed',
            title: 'Dispute Closed',
            message: `Your dispute for order #${dispute.order_id} has been closed.`,
            payload: { disputeId: dispute.id, orderId: dispute.order_id },
          }).catch(err => console.error('[NOTIFICATION] Failed to notify buyer:', err));
        }
        break;
      }

      case 'add_message': {
        const { message } = body;
        if (!message || typeof message !== 'string' || message.trim().length === 0) {
          return NextResponse.json({ error: 'Message is required' }, { status: 400 });
        }
        
        dispute = await addDisputeMessage(
          id,
          session.user_id,
          'Admin',
          'admin',
          message.trim()
        );
        break;
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    if (!dispute) {
      return NextResponse.json({ error: 'Dispute not found' }, { status: 404 });
    }

    return NextResponse.json({ dispute, action });
  } catch (error) {
    console.error('[Admin Dispute API] POST action error:', error);
    return NextResponse.json({ error: 'Failed to perform action' }, { status: 500 });
  }
}
