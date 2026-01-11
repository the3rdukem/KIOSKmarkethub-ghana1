/**
 * Order API Route
 *
 * PHASE 2: Checkout & Order Pipeline
 * Operations for a specific order.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { validateSession } from '@/lib/db/dal/sessions';
import {
  getOrderById,
  getOrderItemsByOrderId,
  getVendorItemsForOrder,
  updateOrder,
  cancelOrderWithInventoryRestore,
  fulfillOrderItem,
  parseOrderItems,
  parseShippingAddress,
  type UpdateOrderInput,
} from '@/lib/db/dal/orders';
import { createAuditLog } from '@/lib/db/dal/audit';
import { getUserById } from '@/lib/db/dal/users';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/orders/[id]
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
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

    const order = await getOrderById(id);
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const isAdmin = session.user_role === 'admin' || session.user_role === 'master_admin';
    const isBuyer = order.buyer_id === session.user_id;
    const items = parseOrderItems(order);
    const isVendor = session.user_role === 'vendor' && items.some(item => item.vendorId === session.user_id);

    if (!isAdmin && !isBuyer && !isVendor) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const orderItems = await getOrderItemsByOrderId(id);

    const vendorItems = isVendor 
      ? orderItems.filter(item => item.vendor_id === session.user_id)
      : orderItems;

    // Normalize legacy items to have same fields for backwards compatibility
    const normalizedLegacyItems = items.map((item: any) => ({
      ...item,
      unitPrice: item.unitPrice ?? item.price ?? 0,
      finalPrice: item.finalPrice ?? (item.price ? item.price * item.quantity : null),
    }));

    return NextResponse.json({
      order: {
        id: order.id,
        buyerId: order.buyer_id,
        buyerName: order.buyer_name,
        buyerEmail: order.buyer_email,
        items: normalizedLegacyItems,
        orderItems: vendorItems.map(item => ({
          id: item.id,
          productId: item.product_id,
          productName: item.product_name,
          vendorId: item.vendor_id,
          vendorName: item.vendor_name,
          quantity: item.quantity,
          unitPrice: item.unit_price,
          appliedDiscount: item.applied_discount,
          finalPrice: item.final_price,
          fulfillmentStatus: item.fulfillment_status,
          fulfilledAt: item.fulfilled_at,
          image: item.image,
        })),
        subtotal: order.subtotal,
        discountTotal: order.discount_total || 0,
        shippingFee: order.shipping_fee,
        tax: order.tax,
        total: order.total,
        status: order.status,
        paymentStatus: order.payment_status,
        paymentMethod: order.payment_method,
        shippingAddress: parseShippingAddress(order),
        trackingNumber: order.tracking_number,
        couponCode: order.coupon_code,
        notes: order.notes,
        createdAt: order.created_at,
        updatedAt: order.updated_at,
      },
    });
  } catch (error) {
    console.error('Get order error:', error);
    return NextResponse.json({ error: 'Failed to fetch order' }, { status: 500 });
  }
}

/**
 * PUT /api/orders/[id]
 * Admin: update status, payment status
 * Vendor: Cannot directly update order status (use PATCH to fulfill items)
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
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

    const order = await getOrderById(id);
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const isAdmin = session.user_role === 'admin' || session.user_role === 'master_admin';

    if (!isAdmin) {
      return NextResponse.json({ error: 'Only admins can update orders' }, { status: 403 });
    }

    const body = await request.json();
    const updates: UpdateOrderInput = {};

    if (body.trackingNumber !== undefined) updates.trackingNumber = body.trackingNumber;
    if (body.notes !== undefined) updates.notes = body.notes;
    if (body.paymentStatus !== undefined) updates.paymentStatus = body.paymentStatus;

    const updatedOrder = await updateOrder(id, updates);

    if (!updatedOrder) {
      return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
    }

    const user = await getUserById(session.user_id);
    await createAuditLog({
      action: 'ORDER_UPDATED',
      category: 'order',
      adminId: session.user_id,
      adminName: user?.name || 'Admin',
      adminEmail: user?.email || '',
      adminRole: session.user_role,
      targetId: id,
      targetType: 'order',
      targetName: `Order ${id}`,
      details: `Updated: ${JSON.stringify(updates)}`,
    });

    return NextResponse.json({
      success: true,
      order: {
        id: updatedOrder.id,
        status: updatedOrder.status,
        paymentStatus: updatedOrder.payment_status,
        updatedAt: updatedOrder.updated_at,
      },
    });
  } catch (error) {
    console.error('Update order error:', error);
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
  }
}

/**
 * PATCH /api/orders/[id]
 * Vendor: Fulfill order items
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
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

    if (session.user_role !== 'vendor') {
      return NextResponse.json({ error: 'Only vendors can fulfill items' }, { status: 403 });
    }

    const order = await getOrderById(id);
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (order.status === 'cancelled') {
      return NextResponse.json({ error: 'Cannot fulfill items on cancelled order' }, { status: 400 });
    }

    const body = await request.json();
    const { action, itemId } = body;

    if (action !== 'fulfill') {
      return NextResponse.json({ error: 'Invalid action. Use: fulfill' }, { status: 400 });
    }

    if (!itemId) {
      return NextResponse.json({ error: 'Item ID required' }, { status: 400 });
    }

    const success = await fulfillOrderItem(itemId, session.user_id);

    if (!success) {
      return NextResponse.json({ 
        error: 'Failed to fulfill item. Item may not exist, may belong to another vendor, or may already be fulfilled.' 
      }, { status: 400 });
    }

    const user = await getUserById(session.user_id);
    await createAuditLog({
      action: 'ORDER_ITEM_FULFILLED',
      category: 'order',
      adminId: session.user_id,
      adminName: user?.name || 'Vendor',
      adminEmail: user?.email || '',
      adminRole: session.user_role,
      targetId: id,
      targetType: 'order_item',
      targetName: `Order Item ${itemId}`,
      details: JSON.stringify({ orderId: id, itemId }),
    });

    const updatedOrder = await getOrderById(id);
    const orderItems = await getVendorItemsForOrder(id, session.user_id);

    return NextResponse.json({
      success: true,
      message: 'Item fulfilled successfully',
      order: {
        id: updatedOrder?.id,
        status: updatedOrder?.status,
      },
      items: orderItems.map(item => ({
        id: item.id,
        productName: item.product_name,
        fulfillmentStatus: item.fulfillment_status,
        fulfilledAt: item.fulfilled_at,
      })),
    });
  } catch (error) {
    console.error('Fulfill item error:', error);
    return NextResponse.json({ error: 'Failed to fulfill item' }, { status: 500 });
  }
}

/**
 * DELETE /api/orders/[id] (cancel order - admin only)
 * Phase 2: Only admins can cancel orders, with inventory restoration
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
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

    const isAdmin = session.user_role === 'admin' || session.user_role === 'master_admin';

    if (!isAdmin) {
      return NextResponse.json({ error: 'Only admins can cancel orders' }, { status: 403 });
    }

    const result = await cancelOrderWithInventoryRestore(id);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const user = await getUserById(session.user_id);
    await createAuditLog({
      action: 'ORDER_CANCELLED',
      category: 'order',
      adminId: session.user_id,
      adminName: user?.name || 'Admin',
      adminEmail: user?.email || '',
      adminRole: session.user_role,
      targetId: id,
      targetType: 'order',
      targetName: `Order ${id}`,
      details: JSON.stringify({
        restoredItems: result.restoredItems,
      }),
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Order cancelled and inventory restored',
      restoredItems: result.restoredItems,
    });
  } catch (error) {
    console.error('Cancel order error:', error);
    return NextResponse.json({ error: 'Failed to cancel order' }, { status: 500 });
  }
}
