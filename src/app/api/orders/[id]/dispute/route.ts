/**
 * Phase 7B: Buyer Dispute API
 * 
 * POST /api/orders/[id]/dispute
 * Allows buyers to raise a dispute within the 48-hour window after delivery
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { validateSession } from '@/lib/db/dal/sessions';
import { raiseDispute } from '@/lib/db/dal/orders';
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

    const body = await request.json();
    const { reason } = body;

    if (!reason || typeof reason !== 'string' || reason.trim().length < 10) {
      return NextResponse.json({ 
        error: 'Please provide a detailed reason for the dispute (at least 10 characters)' 
      }, { status: 400 });
    }

    const result = await raiseDispute(id, session.user_id, reason.trim());

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: result.statusCode || 400 }
      );
    }

    // Notify admin about the dispute (fire-and-forget)
    createNotification({
      userId: 'admin', // Will be picked up by admin notification system
      role: 'admin',
      type: 'order_disputed',
      title: 'Order Dispute Raised',
      message: `A buyer has raised a dispute for order #${id}. Reason: ${reason.substring(0, 100)}...`,
      payload: { orderId: id, reason },
    }).catch(err => console.error('[NOTIFICATION] Failed to notify admin of dispute:', err));

    return NextResponse.json({
      success: true,
      message: 'Dispute raised successfully. Our team will review your case within 24-48 hours.',
      order: result.order ? {
        id: result.order.id,
        status: result.order.status,
        disputedAt: result.order.disputed_at,
        disputeReason: result.order.dispute_reason,
      } : null,
    });
  } catch (error) {
    console.error('Raise dispute error:', error);
    return NextResponse.json({ error: 'Failed to raise dispute' }, { status: 500 });
  }
}
