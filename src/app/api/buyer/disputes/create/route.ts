/**
 * Buyer Dispute Creation API
 * 
 * POST /api/buyer/disputes/create
 * Allows buyers to raise a dispute for an order within the 48-hour window
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { validateSession } from '@/lib/db/dal/sessions';
import { getOrderById, getOrderItemsByOrderId, updateOrder } from '@/lib/db/dal/orders';
import { createDispute, getDisputeByOrderId } from '@/lib/db/dal/disputes';
import { createNotification } from '@/lib/db/dal/notifications';

const DISPUTE_WINDOW_HOURS = 48;

export async function POST(request: NextRequest) {
  try {
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
    const { orderId, type, description, productId, productName, amount, evidence } = body;

    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
    }

    if (!type || !['refund', 'quality', 'delivery', 'fraud', 'other'].includes(type)) {
      return NextResponse.json({ error: 'Valid dispute type is required' }, { status: 400 });
    }

    if (!description || description.trim().length < 20) {
      return NextResponse.json({ 
        error: 'Please provide a detailed description (at least 20 characters)' 
      }, { status: 400 });
    }

    const order = await getOrderById(orderId);
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (order.buyer_id !== session.user_id) {
      return NextResponse.json({ error: 'You can only raise disputes for your own orders' }, { status: 403 });
    }

    const existingDispute = await getDisputeByOrderId(orderId);
    if (existingDispute && existingDispute.status !== 'closed') {
      return NextResponse.json({ 
        error: 'A dispute already exists for this order. Please check your disputes page.' 
      }, { status: 400 });
    }

    const deliveredStatuses = ['delivered', 'completed', 'fulfilled'];
    if (!deliveredStatuses.includes(order.status)) {
      return NextResponse.json({ 
        error: 'Disputes can only be raised for delivered orders' 
      }, { status: 400 });
    }

    const deliveryTimestamp = order.delivered_at || order.updated_at;
    const deliveredAt = new Date(deliveryTimestamp);
    const now = new Date();
    const hoursSinceDelivery = (now.getTime() - deliveredAt.getTime()) / (1000 * 60 * 60);

    if (hoursSinceDelivery > DISPUTE_WINDOW_HOURS) {
      return NextResponse.json({ 
        error: `The dispute window has closed. Disputes must be raised within ${DISPUTE_WINDOW_HOURS} hours of delivery.` 
      }, { status: 400 });
    }

    const orderItems = await getOrderItemsByOrderId(orderId);
    if (orderItems.length === 0) {
      return NextResponse.json({ error: 'No items found for this order' }, { status: 400 });
    }

    const uniqueVendors = new Set(orderItems.map(item => item.vendor_id));
    const isMultiVendor = uniqueVendors.size > 1;

    if (isMultiVendor && !productId) {
      return NextResponse.json({ 
        error: 'This order contains items from multiple vendors. Please select the specific product you have an issue with.' 
      }, { status: 400 });
    }

    let targetItem = orderItems[0];
    
    if (productId) {
      const matchedItem = orderItems.find(item => item.product_id === productId);
      if (!matchedItem) {
        return NextResponse.json({ 
          error: 'The specified product is not part of this order' 
        }, { status: 400 });
      }
      targetItem = matchedItem;
    }

    const vendorId = targetItem.vendor_id;
    const vendorName = targetItem.vendor_name || 'Unknown Vendor';
    const resolvedProductId = targetItem.product_id;
    const resolvedProductName = productName || targetItem.product_name;

    console.log('[DISPUTE] Creating dispute:', {
      orderId,
      isMultiVendor,
      productId: resolvedProductId,
      vendorId,
      vendorName,
    });

    if (!vendorId) {
      return NextResponse.json({ error: 'Could not determine vendor for this order' }, { status: 400 });
    }

    const dispute = await createDispute({
      orderId,
      buyerId: session.user_id,
      buyerName: order.buyer_name,
      buyerEmail: order.buyer_email,
      vendorId,
      vendorName,
      productId: resolvedProductId,
      productName: resolvedProductName,
      amount: amount || targetItem.final_price || order.total,
      type,
      description: description.trim(),
      evidence: Array.isArray(evidence) ? evidence : [],
      priority: type === 'fraud' ? 'urgent' : 'medium',
    });

    // Update order status to 'disputed'
    await updateOrder(orderId, { status: 'disputed' });

    createNotification({
      userId: vendorId,
      role: 'vendor',
      type: 'dispute_opened',
      title: 'New Dispute Raised',
      message: `A buyer has raised a ${type} dispute for order #${orderId}. Please review and respond.`,
      payload: { disputeId: dispute.id, orderId, type },
    }).catch(err => console.error('[NOTIFICATION] Failed to notify vendor of dispute:', err));

    return NextResponse.json({
      success: true,
      dispute: {
        id: dispute.id,
        orderId: dispute.order_id,
        type: dispute.type,
        status: dispute.status,
        createdAt: dispute.created_at,
      },
    });
  } catch (error) {
    console.error('[Buyer Dispute Create API] error:', error);
    return NextResponse.json({ error: 'Failed to create dispute' }, { status: 500 });
  }
}
