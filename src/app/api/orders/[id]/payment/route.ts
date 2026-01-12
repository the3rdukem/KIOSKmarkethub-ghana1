/**
 * Payment Initialization API
 * 
 * Phase 3A: Server-side payment reference generation for retry payments.
 * Generates a unique reference, stores it on the order, and returns it to the client.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { validateSession } from '@/lib/db/dal/sessions';
import { getOrderById } from '@/lib/db/dal/orders';
import { query } from '@/lib/db';
import { generatePaymentReference } from '@/lib/services/paystack';
import { createAuditLog } from '@/lib/db/dal/audit';

interface PaymentInitRequest {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/orders/[id]/payment
 * 
 * Initialize a payment attempt for an order.
 * Generates a server-side reference and stores it on the order.
 * 
 * Phase 3A Requirements:
 * - Reference is system-generated and unique
 * - Reference is stored on order BEFORE redirect
 * - Only orders in pending_payment status with pending/failed payment can be initialized
 * - Already-paid orders are rejected (idempotency guard)
 */
export async function POST(request: NextRequest, { params }: PaymentInitRequest) {
  try {
    const { id: orderId } = await params;

    // Verify authentication
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const session = await validateSession(sessionToken);
    if (!session) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    // Get the order
    const order = await getOrderById(orderId);
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Verify the user owns this order
    if (order.buyer_id !== session.user_id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // IDEMPOTENCY GUARD: Reject if order is already paid
    if (order.payment_status === 'paid') {
      return NextResponse.json({ 
        error: 'Order has already been paid',
        paymentStatus: order.payment_status 
      }, { status: 400 });
    }

    // Verify order is in a payable state
    if (order.status !== 'pending_payment') {
      return NextResponse.json({ 
        error: 'Order is not in a payable state',
        currentStatus: order.status 
      }, { status: 400 });
    }

    // Only allow payment for pending or failed payment status
    if (order.payment_status !== 'pending' && order.payment_status !== 'failed') {
      return NextResponse.json({ 
        error: 'Payment cannot be initiated for this order',
        paymentStatus: order.payment_status 
      }, { status: 400 });
    }

    // Generate a new unique reference server-side
    const paymentReference = generatePaymentReference();
    const now = new Date().toISOString();

    // Store the reference on the order BEFORE returning to client
    // Use direct query to only update payment_reference, not status fields
    // This preserves the payment_status (pending/failed) and only updates tracking fields
    await query(
      `UPDATE orders 
       SET payment_reference = $1, 
           payment_provider = 'paystack',
           updated_at = $2
       WHERE id = $3 AND payment_status != 'paid'`,
      [paymentReference, now, orderId]
    );

    // Log the payment initialization attempt for audit trail
    await createAuditLog({
      action: 'PAYMENT_INITIALIZED',
      category: 'order',
      targetId: orderId,
      targetType: 'order',
      targetName: `Order ${orderId}`,
      adminId: session.user_id,
      details: JSON.stringify({
        reference: paymentReference,
        amount: order.total,
        currency: order.currency || 'GHS',
        previousReference: order.payment_reference,
        previousPaymentStatus: order.payment_status,
      }),
      severity: 'info',
    });

    // Return the reference and order details for Paystack popup
    return NextResponse.json({
      success: true,
      paymentReference,
      orderId: order.id,
      amount: order.total,
      currency: order.currency || 'GHS',
      email: order.buyer_email,
    });
  } catch (error) {
    console.error('Payment initialization error:', error);
    return NextResponse.json({ error: 'Failed to initialize payment' }, { status: 500 });
  }
}
