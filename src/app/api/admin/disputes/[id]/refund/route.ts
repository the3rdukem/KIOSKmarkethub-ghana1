/**
 * Admin Dispute Refund API
 * 
 * POST /api/admin/disputes/[id]/refund
 * Process a full refund for a dispute
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { validateSession } from '@/lib/db/dal/sessions';
import { getDisputeById } from '@/lib/db/dal/disputes';
import { getOrderById, updateOrder } from '@/lib/db/dal/orders';
import { refundTransaction } from '@/lib/services/paystack';
import { createAuditLog } from '@/lib/db/dal/audit';
import { createNotification } from '@/lib/db/dal/notifications';
import { query } from '@/lib/db';

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
    if (!session || (session.user_role !== 'admin' && session.user_role !== 'master_admin')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { refundAmount, customerNote } = body;

    const dispute = await getDisputeById(id);
    if (!dispute) {
      return NextResponse.json({ error: 'Dispute not found' }, { status: 404 });
    }

    if (dispute.refund_status === 'completed') {
      return NextResponse.json({ error: 'Refund already processed' }, { status: 400 });
    }

    if (dispute.refund_status === 'processing') {
      return NextResponse.json({ 
        error: 'Refund is already being processed. Please wait for confirmation or check the status.' 
      }, { status: 400 });
    }

    if (dispute.status !== 'resolved') {
      return NextResponse.json({ 
        error: 'Dispute must be resolved before processing a refund. Please resolve the dispute first.' 
      }, { status: 400 });
    }

    if (dispute.resolution_type !== 'full_refund' && dispute.resolution_type !== 'partial_refund') {
      return NextResponse.json({ 
        error: 'This dispute resolution type does not require a refund.' 
      }, { status: 400 });
    }

    const order = await getOrderById(dispute.order_id);
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (!order.payment_reference) {
      return NextResponse.json({ 
        error: 'No payment reference found. This order may not have been paid via Paystack.' 
      }, { status: 400 });
    }

    if (order.payment_status === 'refunded') {
      return NextResponse.json({ 
        error: 'This order has already been refunded.' 
      }, { status: 400 });
    }

    const amountToRefund = refundAmount || dispute.refund_amount || dispute.amount || order.total;
    if (!amountToRefund || amountToRefund <= 0) {
      return NextResponse.json({ error: 'Invalid refund amount' }, { status: 400 });
    }

    if (amountToRefund > order.total) {
      return NextResponse.json({ 
        error: `Refund amount (GHS ${amountToRefund}) cannot exceed order total (GHS ${order.total})` 
      }, { status: 400 });
    }

    const amountInPesewas = Math.round(amountToRefund * 100);

    await query(
      `UPDATE disputes SET refund_status = 'processing', updated_at = $2 WHERE id = $1`,
      [id, new Date().toISOString()]
    );

    console.log('[REFUND] Processing refund:', {
      disputeId: id,
      orderId: dispute.order_id,
      paymentReference: order.payment_reference,
      amount: amountToRefund,
      amountInPesewas,
    });

    const refundResult = await refundTransaction({
      transaction: order.payment_reference,
      amount: amountInPesewas,
      currency: 'GHS',
      customer_note: customerNote || `Refund for dispute ${id}`,
      merchant_note: `Dispute resolution refund. Dispute ID: ${id}, Order ID: ${dispute.order_id}`,
    });

    if (!refundResult.success) {
      await query(
        `UPDATE disputes SET refund_status = 'failed', updated_at = $2 WHERE id = $1`,
        [id, new Date().toISOString()]
      );
      
      console.error('[REFUND] Paystack refund failed:', refundResult.error);
      return NextResponse.json({ 
        error: refundResult.error || 'Failed to process refund with payment provider' 
      }, { status: 500 });
    }

    const now = new Date().toISOString();
    const paystackStatus = refundResult.data?.status;
    const isImmediatelyProcessed = paystackStatus === 'processed';
    
    await query(
      `UPDATE disputes SET 
        refund_status = $2,
        refund_reference = $3,
        refunded_at = CASE WHEN $2 = 'completed' THEN $4 ELSE NULL END,
        refund_amount = $5,
        updated_at = $4
      WHERE id = $1`,
      [
        id, 
        isImmediatelyProcessed ? 'completed' : 'processing',
        refundResult.data?.refund_reference || '', 
        now, 
        amountToRefund
      ]
    );

    if (isImmediatelyProcessed) {
      await updateOrder(dispute.order_id, {
        paymentStatus: 'refunded',
      });

      if (order.platform_commission && order.platform_commission > 0) {
        const commissionRefundRatio = Math.min(amountToRefund / order.total, 1);
        const commissionToReverse = Math.min(
          Math.round(order.platform_commission * commissionRefundRatio * 100) / 100,
          order.platform_commission
        );
        
        console.log('[REFUND] Commission reversal:', {
          originalCommission: order.platform_commission,
          refundRatio: commissionRefundRatio,
          commissionToReverse,
        });
        
        await query(
          `UPDATE orders SET 
            platform_commission = GREATEST(platform_commission - $2, 0),
            vendor_earnings = vendor_earnings + $2,
            updated_at = $3
          WHERE id = $1 AND platform_commission >= $2`,
          [dispute.order_id, commissionToReverse, now]
        );
      }
    } else {
      console.log('[REFUND] Refund initiated but pending confirmation:', {
        paystackStatus,
        refundReference: refundResult.data?.refund_reference,
      });
    }

    await createAuditLog({
      action: 'dispute_refund_processed',
      category: 'order',
      adminId: session.user_id,
      adminRole: session.user_role,
      targetId: id,
      targetType: 'dispute',
      details: JSON.stringify({
        orderId: dispute.order_id,
        refundAmount: amountToRefund,
        refundReference: refundResult.data?.refund_reference,
        paymentReference: order.payment_reference,
      }),
    });

    const finalStatus = isImmediatelyProcessed ? 'completed' : 'processing';
    
    if (isImmediatelyProcessed) {
      createNotification({
        userId: dispute.buyer_id,
        role: 'buyer',
        type: 'refund_processed',
        title: 'Refund Processed',
        message: `Your refund of GHS ${amountToRefund.toFixed(2)} for order #${dispute.order_id} has been processed. It will be credited to your original payment method.`,
        payload: { 
          disputeId: id, 
          orderId: dispute.order_id, 
          refundAmount: amountToRefund,
          refundReference: refundResult.data?.refund_reference,
        },
      }).catch(err => console.error('[NOTIFICATION] Failed to notify buyer of refund:', err));

      createNotification({
        userId: dispute.vendor_id,
        role: 'vendor',
        type: 'refund_processed',
        title: 'Order Refunded',
        message: `A refund of GHS ${amountToRefund.toFixed(2)} has been processed for order #${dispute.order_id} due to dispute resolution.`,
        payload: { 
          disputeId: id, 
          orderId: dispute.order_id, 
          refundAmount: amountToRefund,
        },
      }).catch(err => console.error('[NOTIFICATION] Failed to notify vendor of refund:', err));
    } else {
      createNotification({
        userId: dispute.buyer_id,
        role: 'buyer',
        type: 'refund_initiated',
        title: 'Refund Initiated',
        message: `Your refund of GHS ${amountToRefund.toFixed(2)} for order #${dispute.order_id} has been initiated. You will be notified when it is completed.`,
        payload: { 
          disputeId: id, 
          orderId: dispute.order_id, 
          refundAmount: amountToRefund,
        },
      }).catch(err => console.error('[NOTIFICATION] Failed to notify buyer of refund initiation:', err));
    }

    return NextResponse.json({
      success: true,
      refund: {
        disputeId: id,
        orderId: dispute.order_id,
        amount: amountToRefund,
        reference: refundResult.data?.refund_reference,
        status: finalStatus,
        paystackStatus,
      },
    });
  } catch (error) {
    console.error('[Admin Dispute Refund API] error:', error);
    return NextResponse.json({ error: 'Failed to process refund' }, { status: 500 });
  }
}
