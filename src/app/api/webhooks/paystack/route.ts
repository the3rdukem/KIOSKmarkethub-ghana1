/**
 * Paystack Webhook Handler
 *
 * Handles payment event notifications from Paystack.
 * Verifies webhook signature and updates order payment status.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPaystackCredentials } from '@/lib/db/dal/integrations';
import { updateOrderPaymentStatus } from '@/lib/db/dal/orders';
import { createAuditLog } from '@/lib/db/dal/audit';
import { createHash } from 'crypto';

interface PaystackEvent {
  event: string;
  data: {
    reference: string;
    amount: number;
    currency: string;
    status: string;
    channel: string;
    paid_at?: string;
    customer: {
      email: string;
      phone?: string;
    };
    metadata?: {
      orderId?: string;
      buyerId?: string;
      [key: string]: unknown;
    };
  };
}

/**
 * Verify Paystack webhook signature
 */
function verifySignature(payload: string, signature: string, secret: string): boolean {
  if (!secret) {
    console.warn('[PAYSTACK_WEBHOOK] No webhook secret configured');
    return false;
  }

  const hash = createHash('sha512')
    .update(payload)
    .digest('hex');

  return hash === signature;
}

/**
 * POST /api/webhooks/paystack
 *
 * Handle Paystack webhook events
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('x-paystack-signature') || '';

    const credentials = await getPaystackCredentials();

    if (!credentials || !credentials.isEnabled) {
      console.error('[PAYSTACK_WEBHOOK] Paystack is not configured or enabled');
      return NextResponse.json({ error: 'Payment gateway not configured' }, { status: 503 });
    }

    if (credentials.webhookSecret) {
      if (!verifySignature(rawBody, signature, credentials.webhookSecret)) {
        console.error('[PAYSTACK_WEBHOOK] Invalid signature');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    let event: PaystackEvent;
    try {
      event = JSON.parse(rawBody);
    } catch {
      console.error('[PAYSTACK_WEBHOOK] Invalid JSON payload');
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    console.log(`[PAYSTACK_WEBHOOK] Received event: ${event.event}`);

    switch (event.event) {
      case 'charge.success':
        await handleChargeSuccess(event.data);
        break;

      case 'charge.failed':
        await handleChargeFailed(event.data);
        break;

      // Phase 3A: Only handle charge events. Transfer events (vendor payouts) are out of scope.
      // These handlers are left as no-ops for forward compatibility but do not process data.
      case 'transfer.success':
      case 'transfer.failed':
        console.log(`[PAYSTACK_WEBHOOK] Transfer event ignored in Phase 3A: ${event.event}`);
        break;

      default:
        console.log(`[PAYSTACK_WEBHOOK] Unhandled event type: ${event.event}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[PAYSTACK_WEBHOOK] Error processing webhook:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Handle successful payment
 */
async function handleChargeSuccess(data: PaystackEvent['data']): Promise<void> {
  console.log(`[PAYSTACK_WEBHOOK] Payment successful: ${data.reference}`);

  const orderId = data.metadata?.orderId;

  if (!orderId) {
    console.error('[PAYSTACK_WEBHOOK] No orderId in payment metadata');
    return;
  }

  try {
    const { getOrderById } = await import('@/lib/db/dal/orders');
    const order = await getOrderById(orderId);
    
    if (!order) {
      console.error(`[PAYSTACK_WEBHOOK] Order ${orderId} not found`);
      return;
    }

    // IDEMPOTENCY CHECK: Skip if order is already paid
    if (order.payment_status === 'paid') {
      // Check if this is a duplicate webhook for the same reference
      if (order.payment_reference === data.reference) {
        console.log(`[PAYSTACK_WEBHOOK] Duplicate webhook - order ${orderId} already paid with reference ${data.reference}`);
        return;
      }
      // Different reference for already-paid order - log for audit
      console.warn(`[PAYSTACK_WEBHOOK] Order ${orderId} already paid (ref: ${order.payment_reference}), ignoring new reference ${data.reference}`);
      await createAuditLog({
        action: 'PAYMENT_DUPLICATE_IGNORED',
        category: 'order',
        targetId: orderId,
        targetType: 'order',
        targetName: `Order ${orderId}`,
        details: JSON.stringify({
          existingReference: order.payment_reference,
          newReference: data.reference,
          reason: 'Order already paid, ignoring duplicate payment attempt',
        }),
        severity: 'warning',
      });
      return;
    }

    const paidAmountGHS = data.amount / 100;
    const orderTotal = order.total;
    const tolerance = 0.01;

    if (Math.abs(paidAmountGHS - orderTotal) > tolerance) {
      console.error(`[PAYSTACK_WEBHOOK] Amount mismatch for order ${orderId}: paid ${paidAmountGHS}, expected ${orderTotal}`);
      await createAuditLog({
        action: 'PAYMENT_AMOUNT_MISMATCH',
        category: 'order',
        targetId: orderId,
        targetType: 'order',
        targetName: `Order ${orderId}`,
        details: JSON.stringify({
          reference: data.reference,
          paidAmount: paidAmountGHS,
          expectedAmount: orderTotal,
          currency: data.currency,
        }),
        severity: 'warning',
      });
      return;
    }

    await updateOrderPaymentStatus(orderId, {
      paymentStatus: 'paid',
      paymentMethod: data.channel,
      paymentProvider: 'paystack',
      paymentReference: data.reference,
      paidAt: data.paid_at || new Date().toISOString(),
    });

    console.log(`[PAYSTACK_WEBHOOK] Order ${orderId} marked as paid`);

    await createAuditLog({
      action: 'PAYMENT_RECEIVED',
      category: 'order',
      targetId: orderId,
      targetType: 'order',
      targetName: `Order ${orderId}`,
      details: JSON.stringify({
        reference: data.reference,
        amount: paidAmountGHS,
        currency: data.currency,
        channel: data.channel,
        customerEmail: data.customer.email,
      }),
      severity: 'info',
    });
  } catch (error) {
    console.error(`[PAYSTACK_WEBHOOK] Failed to update order ${orderId}:`, error);
  }
}

/**
 * Handle failed payment - restore inventory for the order
 */
async function handleChargeFailed(data: PaystackEvent['data']): Promise<void> {
  console.log(`[PAYSTACK_WEBHOOK] Payment failed: ${data.reference}`);

  const orderId = data.metadata?.orderId;

  if (!orderId) {
    console.error('[PAYSTACK_WEBHOOK] No orderId in payment metadata');
    return;
  }

  try {
    const { getOrderById, getOrderItemsByOrderId } = await import('@/lib/db/dal/orders');
    const { restoreInventory } = await import('@/lib/db/dal/products');

    const order = await getOrderById(orderId);
    if (!order) {
      console.error(`[PAYSTACK_WEBHOOK] Order ${orderId} not found for inventory restoration`);
      return;
    }

    // IDEMPOTENCY CHECK: Skip if order is already paid (success came after failure)
    if (order.payment_status === 'paid') {
      console.log(`[PAYSTACK_WEBHOOK] Order ${orderId} already paid, ignoring failed webhook`);
      return;
    }

    // IDEMPOTENCY CHECK: Skip if already failed with same reference (duplicate webhook)
    if (order.payment_status === 'failed' && order.payment_reference === data.reference) {
      console.log(`[PAYSTACK_WEBHOOK] Duplicate failure webhook - order ${orderId} already failed with reference ${data.reference}`);
      return;
    }

    // Only restore inventory if this is the first failure for this order (payment_status is still 'pending')
    const shouldRestoreInventory = order.payment_status === 'pending';

    await updateOrderPaymentStatus(orderId, {
      paymentStatus: 'failed',
      paymentProvider: 'paystack',
      paymentReference: data.reference,
    });

    console.log(`[PAYSTACK_WEBHOOK] Order ${orderId} marked as payment failed`);

    // Only restore inventory once - when transitioning from pending to failed
    if (!shouldRestoreInventory) {
      console.log(`[PAYSTACK_WEBHOOK] Skipping inventory restoration - order was already in failed state`);
      await createAuditLog({
        action: 'PAYMENT_FAILED',
        category: 'order',
        targetId: orderId,
        targetType: 'order',
        targetName: `Order ${orderId}`,
        details: JSON.stringify({
          reference: data.reference,
          amount: data.amount / 100,
          currency: data.currency,
          inventoryRestored: 0,
          reason: 'Retry payment failed, inventory already restored from previous attempt',
        }),
        severity: 'warning',
      });
      return;
    }

    const orderItems = await getOrderItemsByOrderId(orderId);
    let restoredCount = 0;

    for (const item of orderItems) {
      const restored = await restoreInventory(item.product_id, item.quantity);
      if (restored) {
        restoredCount++;
        console.log(`[PAYSTACK_WEBHOOK] Restored ${item.quantity} units of product ${item.product_id}`);
      }
    }

    await createAuditLog({
      action: 'PAYMENT_FAILED',
      category: 'order',
      targetId: orderId,
      targetType: 'order',
      targetName: `Order ${orderId}`,
      details: JSON.stringify({
        reference: data.reference,
        amount: data.amount / 100,
        currency: data.currency,
        inventoryRestored: restoredCount,
        totalItems: orderItems.length,
      }),
      severity: 'warning',
    });

    console.log(`[PAYSTACK_WEBHOOK] Restored inventory for ${restoredCount}/${orderItems.length} items`);
  } catch (error) {
    console.error(`[PAYSTACK_WEBHOOK] Failed to update order ${orderId}:`, error);
  }
}

// Phase 3A: Transfer handlers removed. Vendor payouts are out of scope for this phase.
