/**
 * Paystack Webhook Handler
 *
 * Handles payment event notifications from Paystack.
 * Verifies webhook signature and updates order payment status.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPaystackCredentials } from '@/lib/db/dal/integrations';
import { updateOrderPaymentStatus, parseOrderItems, getOrderItemsByOrderId } from '@/lib/db/dal/orders';
import { createAuditLog } from '@/lib/db/dal/audit';
import { createHash } from 'crypto';
import { sendOrderConfirmationSMS, sendVendorNewOrderSMS } from '@/lib/services/arkesel-sms';
import { getUserById } from '@/lib/db/dal/users';
import { sendPaymentReceivedEmail } from '@/lib/services/order-emails';
import { updatePayoutStatus, getPayoutById, getPayoutByReference } from '@/lib/db/dal/payouts';
import { sendSMS } from '@/lib/services/arkesel-sms';

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

      // Phase 14: Handle transfer events for vendor payouts
      case 'transfer.success':
        await handleTransferSuccess(event.data);
        break;

      case 'transfer.failed':
        await handleTransferFailed(event.data);
        break;

      case 'transfer.reversed':
        await handleTransferReversed(event.data);
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

    // Send SMS notifications (fire-and-forget)
    try {
      // Get buyer info for SMS
      const buyer = await getUserById(order.buyer_id);
      const buyerPhone = buyer?.phone || data.customer.phone;
      
      if (buyerPhone) {
        sendOrderConfirmationSMS(
          buyerPhone,
          order.buyer_name || buyer?.name || 'Customer',
          order.buyer_id,
          orderId,
          paidAmountGHS
        ).catch(err => console.error('[SMS] Failed to send order confirmation SMS:', err));
      }

      // Send payment received email to buyer (fire-and-forget)
      sendPaymentReceivedEmail({
        orderId,
        orderNumber: orderId,
        buyerId: order.buyer_id,
        buyerName: order.buyer_name,
        buyerEmail: order.buyer_email || buyer?.email || data.customer.email,
        orderTotal: `GHS ${paidAmountGHS.toFixed(2)}`,
      }).catch(err => console.error('[EMAIL] Failed to send payment received email:', err));

      // Send SMS to vendors about new order
      const orderItems = await getOrderItemsByOrderId(orderId);
      const vendorIds = [...new Set(orderItems.map(item => item.vendor_id))];
      
      for (const vendorId of vendorIds) {
        const vendor = await getUserById(vendorId);
        if (vendor?.phone) {
          const vendorItems = orderItems.filter(item => item.vendor_id === vendorId);
          const vendorAmount = vendorItems.reduce((sum, item) => sum + (item.final_price || item.unit_price * item.quantity), 0);
          
          sendVendorNewOrderSMS(
            vendor.phone,
            vendor.business_name || vendor.name || 'Vendor',
            vendorId,
            orderId,
            vendorAmount
          ).catch(err => console.error('[SMS] Failed to send vendor new order SMS:', err));
        }
      }
    } catch (smsError) {
      console.error('[PAYSTACK_WEBHOOK] SMS notification error (non-blocking):', smsError);
    }
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

// ============================================
// Phase 14: Transfer Handlers (Vendor Payouts)
// ============================================

interface TransferData {
  reference: string;
  transfer_code?: string;
  status: string;
  amount: number;
  currency: string;
  reason?: string;
  recipient?: {
    name?: string;
    details?: {
      account_number?: string;
      bank_name?: string;
    };
  };
}

/**
 * Handle successful transfer (vendor payout)
 */
async function handleTransferSuccess(data: TransferData): Promise<void> {
  console.log(`[PAYSTACK_WEBHOOK] Transfer successful: ${data.reference}`);

  try {
    // Update payout status
    const updated = await updatePayoutStatus(data.reference, 'success');
    
    if (!updated) {
      console.warn(`[PAYSTACK_WEBHOOK] Could not find payout with reference: ${data.reference}`);
      return;
    }

    // Log audit
    await createAuditLog({
      action: 'payout.success',
      adminId: 'system',
      adminRole: 'system',
      category: 'vendor',
      targetId: data.reference,
      targetType: 'payout',
      targetName: `Payout ${data.reference}`,
      details: JSON.stringify({
        reference: data.reference,
        transfer_code: data.transfer_code,
        amount: data.amount / 100,
        currency: data.currency,
        recipient: data.recipient?.name,
      }),
      severity: 'info',
    });

    console.log(`[PAYSTACK_WEBHOOK] Payout ${data.reference} marked as successful`);
    
    // Send SMS notification to vendor
    try {
      const payout = await getPayoutByReference(data.reference);
      if (payout?.vendor_phone) {
        const amountGHS = (data.amount / 100).toFixed(2);
        await sendSMS({
          phone: payout.vendor_phone,
          eventType: 'payout_completed',
          recipientId: payout.vendor_id,
          recipientRole: 'vendor',
          recipientName: payout.vendor_name,
          variables: {
            amount: amountGHS,
            reference: data.reference,
            account: payout.bank_account_name || 'your account',
          },
        });
        console.log(`[PAYSTACK_WEBHOOK] SMS sent to vendor for payout ${data.reference}`);
      }
    } catch (smsError) {
      console.error('[PAYSTACK_WEBHOOK] Failed to send payout SMS:', smsError);
    }
  } catch (error) {
    console.error(`[PAYSTACK_WEBHOOK] Failed to process transfer success:`, error);
  }
}

/**
 * Handle failed transfer (vendor payout)
 */
async function handleTransferFailed(data: TransferData): Promise<void> {
  console.log(`[PAYSTACK_WEBHOOK] Transfer failed: ${data.reference}`);

  try {
    // Update payout status with failure reason
    const failureReason = data.reason || 'Transfer failed';
    const updated = await updatePayoutStatus(data.reference, 'failed', failureReason);
    
    if (!updated) {
      console.warn(`[PAYSTACK_WEBHOOK] Could not find payout with reference: ${data.reference}`);
      return;
    }

    // Log audit
    await createAuditLog({
      action: 'payout.failed',
      adminId: 'system',
      adminRole: 'system',
      category: 'vendor',
      targetId: data.reference,
      targetType: 'payout',
      targetName: `Payout ${data.reference}`,
      details: JSON.stringify({
        reference: data.reference,
        amount: data.amount / 100,
        currency: data.currency,
        reason: failureReason,
      }),
      severity: 'warning',
    });

    console.log(`[PAYSTACK_WEBHOOK] Payout ${data.reference} marked as failed: ${failureReason}`);
    
    // Send SMS notification to vendor
    try {
      const payout = await getPayoutByReference(data.reference);
      if (payout?.vendor_phone) {
        const amountGHS = (data.amount / 100).toFixed(2);
        await sendSMS({
          phone: payout.vendor_phone,
          eventType: 'payout_failed',
          recipientId: payout.vendor_id,
          recipientRole: 'vendor',
          recipientName: payout.vendor_name,
          variables: {
            amount: amountGHS,
            reference: data.reference,
            reason: failureReason,
          },
        });
        console.log(`[PAYSTACK_WEBHOOK] SMS sent to vendor for failed payout ${data.reference}`);
      }
    } catch (smsError) {
      console.error('[PAYSTACK_WEBHOOK] Failed to send payout SMS:', smsError);
    }
  } catch (error) {
    console.error(`[PAYSTACK_WEBHOOK] Failed to process transfer failure:`, error);
  }
}

/**
 * Handle reversed transfer (vendor payout)
 */
async function handleTransferReversed(data: TransferData): Promise<void> {
  console.log(`[PAYSTACK_WEBHOOK] Transfer reversed: ${data.reference}`);

  try {
    // Update payout status
    const updated = await updatePayoutStatus(data.reference, 'reversed', 'Transfer was reversed');
    
    if (!updated) {
      console.warn(`[PAYSTACK_WEBHOOK] Could not find payout with reference: ${data.reference}`);
      return;
    }

    // Log audit
    await createAuditLog({
      action: 'payout.reversed',
      adminId: 'system',
      adminRole: 'system',
      category: 'vendor',
      targetId: data.reference,
      targetType: 'payout',
      targetName: `Payout ${data.reference}`,
      details: JSON.stringify({
        reference: data.reference,
        amount: data.amount / 100,
        currency: data.currency,
      }),
      severity: 'warning',
    });

    console.log(`[PAYSTACK_WEBHOOK] Payout ${data.reference} marked as reversed`);
    
    // Send SMS notification to vendor (use failed template for reversed)
    try {
      const payout = await getPayoutByReference(data.reference);
      if (payout?.vendor_phone) {
        const amountGHS = (data.amount / 100).toFixed(2);
        await sendSMS({
          phone: payout.vendor_phone,
          eventType: 'payout_failed',
          recipientId: payout.vendor_id,
          recipientRole: 'vendor',
          recipientName: payout.vendor_name,
          variables: {
            amount: amountGHS,
            reference: data.reference,
            reason: 'Transfer was reversed by the bank',
          },
        });
        console.log(`[PAYSTACK_WEBHOOK] SMS sent to vendor for reversed payout ${data.reference}`);
      }
    } catch (smsError) {
      console.error('[PAYSTACK_WEBHOOK] Failed to send payout SMS:', smsError);
    }
  } catch (error) {
    console.error(`[PAYSTACK_WEBHOOK] Failed to process transfer reversal:`, error);
  }
}
