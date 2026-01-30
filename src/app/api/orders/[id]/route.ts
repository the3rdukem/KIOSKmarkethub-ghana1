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
  packOrderItem,
  handItemToCourier,
  parseOrderItems,
  parseShippingAddress,
  transitionOrderStatus,
  normalizeOrderStatus,
  markVendorItemsReadyForPickup,
  bookVendorCourier,
  markVendorItemsDelivered,
  getVendorDeliveryStatus,
  type DbOrder,
  type UpdateOrderInput,
} from '@/lib/db/dal/orders';
import { createAuditLog } from '@/lib/db/dal/audit';
import { getUserById } from '@/lib/db/dal/users';
import { createNotification } from '@/lib/db/dal/notifications';
import { sendOrderStatusSMS, sendVendorNewOrderSMS } from '@/lib/services/arkesel-sms';

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
    // If no order_items exist in DB, derive fulfillment status from order status
    const deriveFulfillmentStatus = (orderStatus: string) => {
      if (['delivered', 'completed', 'fulfilled'].includes(orderStatus)) return 'fulfilled';
      if (['shipped', 'handed_to_courier', 'in_transit'].includes(orderStatus)) return 'shipped';
      if (orderStatus === 'packed') return 'packed';
      return 'pending';
    };
    
    const hasOrderItemsInDb = vendorItems.length > 0;
    const normalizedLegacyItems = items.map((item: any) => ({
      ...item,
      unitPrice: item.unitPrice ?? item.price ?? 0,
      finalPrice: item.finalPrice ?? (item.price ? item.price * item.quantity : null),
      fulfillmentStatus: item.fulfillmentStatus ?? (hasOrderItemsInDb ? 'pending' : deriveFulfillmentStatus(order.status)),
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
          vendorCourierProvider: item.vendor_courier_provider,
          vendorCourierReference: item.vendor_courier_reference,
          vendorReadyForPickupAt: item.vendor_ready_for_pickup_at,
          vendorDeliveredAt: item.vendor_delivered_at,
          commissionRate: item.commission_rate,
          commissionAmount: item.commission_amount,
          vendorEarnings: item.vendor_earnings,
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
        deliveredAt: order.delivered_at,
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
    
    // PHASE 3B: Admin cannot manually mark orders as 'paid'
    // Payment confirmation MUST come from webhook only to ensure payment integrity
    if (body.paymentStatus !== undefined) {
      if (body.paymentStatus === 'paid') {
        return NextResponse.json({ 
          error: 'Payment status cannot be manually set to paid. Payment confirmation must come from the payment gateway.' 
        }, { status: 403 });
      }
      updates.paymentStatus = body.paymentStatus;
    }

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
 * Vendor: Fulfill order items or perform order-level delivery actions
 * 
 * Phase 7D: Added order-level actions:
 * - readyForPickup: Mark order ready for courier pickup (requires all items packed)
 * - bookCourier: Book courier and mark order out for delivery
 * - markOrderDelivered: Mark entire order as delivered
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
    const { action, itemId, courierProvider, courierReference } = body;

    const validActions = [
      'pack', 'handToCourier', 'markDelivered', 'ship', 'fulfill', 
      'readyForPickup', 'bookCourier', 'markOrderDelivered',
      // Phase 7D Multi-Vendor: Per-vendor delivery actions
      'vendorReadyForPickup', 'vendorBookCourier', 'vendorMarkDelivered'
    ];
    if (!validActions.includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const user = await getUserById(session.user_id);
    const vendorName = user?.business_name || user?.name || 'A vendor';

    // Phase 7D Multi-Vendor: Per-vendor delivery actions (no itemId required)
    if (action === 'vendorReadyForPickup' || action === 'vendorBookCourier' || action === 'vendorMarkDelivered') {
      return handleVendorDeliveryAction(id, action, session, user, order, courierProvider, courierReference);
    }

    // Phase 7D: Order-level actions (no itemId required) - kept for backward compatibility
    if (action === 'readyForPickup' || action === 'bookCourier' || action === 'markOrderDelivered') {
      return handleOrderLevelAction(id, action, session, user, order, courierProvider, courierReference);
    }

    // Item-level actions require itemId
    if (!itemId) {
      return NextResponse.json({ error: 'Item ID required' }, { status: 400 });
    }

    if (action === 'pack') {
      // Phase 7B: Pack action - transitions item from 'pending' to 'packed'
      const success = await packOrderItem(itemId, session.user_id);

      if (!success) {
        return NextResponse.json({ 
          error: 'Failed to pack item. Item may not exist, may belong to another vendor, or may not be in pending status.' 
        }, { status: 400 });
      }

      await createAuditLog({
        action: 'ORDER_ITEM_PACKED',
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

      // Notify buyer about packing
      createNotification({
        userId: order.buyer_id,
        role: 'buyer',
        type: 'order_fulfilled',
        title: 'Order Being Prepared',
        message: `${vendorName} is preparing your order for shipping!`,
        payload: { orderId: id, itemId, vendorName },
      }).catch(err => console.error('[NOTIFICATION] Failed to notify buyer:', err));

    } else if (action === 'handToCourier' || action === 'ship') {
      // Phase 7B: Hand to courier action - transitions item from 'packed' to 'handed_to_courier'
      // 'ship' is legacy action that now maps to handItemToCourier (packed/shipped -> handed_to_courier)
      const success = await handItemToCourier(itemId, session.user_id);

      if (!success) {
        return NextResponse.json({ 
          error: 'Failed to hand item to courier. Item may not exist, may belong to another vendor, or may not be in the correct status.' 
        }, { status: 400 });
      }

      await createAuditLog({
        action: 'ORDER_ITEM_HANDED_TO_COURIER',
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

      // Notify buyer about shipment
      createNotification({
        userId: order.buyer_id,
        role: 'buyer',
        type: 'order_fulfilled',
        title: 'Order Out for Delivery',
        message: `${vendorName} has handed your order to the courier. It's on its way!`,
        payload: { orderId: id, itemId, vendorName },
      }).catch(err => console.error('[NOTIFICATION] Failed to notify buyer:', err));

    } else if (action === 'markDelivered' || action === 'fulfill') {
      // Phase 7B: Mark delivered action - transitions item from 'handed_to_courier' to 'delivered'
      // 'fulfill' is legacy action that now does the same thing
      const success = await fulfillOrderItem(itemId, session.user_id);

      if (!success) {
        return NextResponse.json({ 
          error: 'Failed to mark item as delivered. Item may not exist, may belong to another vendor, or may not be with courier.' 
        }, { status: 400 });
      }

      await createAuditLog({
        action: 'ORDER_ITEM_DELIVERED',
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

      // Notify buyer about delivery
      createNotification({
        userId: order.buyer_id,
        role: 'buyer',
        type: 'order_fulfilled',
        title: 'Order Delivered',
        message: `Your order from ${vendorName} has been delivered! You have 48 hours to raise any issues.`,
        payload: { orderId: id, itemId, vendorName },
      }).catch(err => console.error('[NOTIFICATION] Failed to notify buyer:', err));
    }

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

    // Fetch order details before cancellation for notification
    const order = await getOrderById(id);
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
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

    // Notify buyer about order cancellation (fire-and-forget)
    createNotification({
      userId: order.buyer_id,
      role: 'buyer',
      type: 'order_cancelled',
      title: 'Order Cancelled',
      message: `Your order #${id} has been cancelled by the admin. If you made a payment, a refund will be processed.`,
      payload: { orderId: id },
    }).catch(err => console.error('[NOTIFICATION] Failed to notify buyer of cancellation:', err));

    // Notify vendors whose items were in the order (fire-and-forget)
    const orderItems = parseOrderItems(order);
    const vendorIds = [...new Set(orderItems.map(item => item.vendorId))];
    vendorIds.forEach(vendorId => {
      if (vendorId) {
        createNotification({
          userId: vendorId,
          role: 'vendor',
          type: 'order_cancelled',
          title: 'Order Cancelled',
          message: `Order #${id} has been cancelled by the admin.`,
          payload: { orderId: id },
        }).catch(err => console.error('[NOTIFICATION] Failed to notify vendor of cancellation:', err));
      }
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

/**
 * Phase 7D: Handle order-level delivery actions
 * These actions affect the entire order status, not individual items
 */
async function handleOrderLevelAction(
  orderId: string,
  action: string,
  session: { user_id: string; user_role: string },
  user: { name?: string; email?: string; business_name?: string } | null,
  order: DbOrder,
  courierProvider?: string,
  courierReference?: string
): Promise<NextResponse> {
  const vendorName = user?.business_name || user?.name || 'Vendor';
  const normalizedStatus = normalizeOrderStatus(order.status);

  if (action === 'readyForPickup') {
    // Phase 7D: Mark order ready for courier pickup
    // Preconditions: Order must be in 'preparing' status, all items must be packed
    if (normalizedStatus !== 'preparing') {
      return NextResponse.json({ 
        error: `Cannot mark as ready for pickup. Order must be in 'preparing' status. Current: ${order.status}` 
      }, { status: 409 });
    }

    // Check all items are packed
    const orderItems = await getOrderItemsByOrderId(orderId);
    const unpacked = orderItems.filter(item => 
      item.fulfillment_status === 'pending'
    );
    if (unpacked.length > 0) {
      return NextResponse.json({ 
        error: `Cannot mark as ready for pickup. ${unpacked.length} item(s) still pending packing.` 
      }, { status: 400 });
    }

    const result = await transitionOrderStatus(
      orderId,
      'ready_for_pickup',
      { id: session.user_id, role: 'vendor', name: user?.name, email: user?.email }
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: result.statusCode || 500 });
    }

    await createAuditLog({
      action: 'ORDER_READY_FOR_PICKUP',
      category: 'order',
      adminId: session.user_id,
      adminName: user?.name || 'Vendor',
      adminEmail: user?.email || '',
      adminRole: session.user_role,
      targetId: orderId,
      targetType: 'order',
      targetName: `Order ${orderId}`,
      details: JSON.stringify({ previousStatus: order.status }),
    });

    createNotification({
      userId: order.buyer_id,
      role: 'buyer',
      type: 'order_fulfilled',
      title: 'Order Ready for Pickup',
      message: `${vendorName} has your order ready and is arranging delivery!`,
      payload: { orderId },
    }).catch(err => console.error('[NOTIFICATION] Failed:', err));

    // Send SMS notification (fire-and-forget)
    if (order.buyer_phone) {
      sendOrderStatusSMS(
        order.buyer_phone,
        order.buyer_name || 'Customer',
        order.buyer_id,
        orderId,
        'ready_for_pickup'
      ).catch(err => console.error('[SMS] Failed to send ready_for_pickup SMS:', err));
    }

    return NextResponse.json({
      success: true,
      message: 'Order marked as ready for pickup',
      order: result.order,
    });

  } else if (action === 'bookCourier') {
    // Phase 7D: Book courier and mark order out for delivery
    // Preconditions: Order must be in 'ready_for_pickup' status
    if (normalizedStatus !== 'ready_for_pickup') {
      return NextResponse.json({ 
        error: `Cannot book courier. Order must be in 'ready_for_pickup' status. Current: ${order.status}` 
      }, { status: 409 });
    }

    if (!courierProvider) {
      return NextResponse.json({ error: 'Courier provider is required' }, { status: 400 });
    }

    // Update all items to handed_to_courier
    const orderItems = await getOrderItemsByOrderId(orderId);
    for (const item of orderItems) {
      if (item.fulfillment_status === 'packed') {
        await handItemToCourier(item.id, item.vendor_id);
      }
    }

    const result = await transitionOrderStatus(
      orderId,
      'out_for_delivery',
      { id: session.user_id, role: 'vendor', name: user?.name, email: user?.email },
      { courierProvider, courierReference }
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: result.statusCode || 500 });
    }

    await createAuditLog({
      action: 'ORDER_COURIER_BOOKED',
      category: 'order',
      adminId: session.user_id,
      adminName: user?.name || 'Vendor',
      adminEmail: user?.email || '',
      adminRole: session.user_role,
      targetId: orderId,
      targetType: 'order',
      targetName: `Order ${orderId}`,
      details: JSON.stringify({ courierProvider, courierReference }),
    });

    createNotification({
      userId: order.buyer_id,
      role: 'buyer',
      type: 'order_fulfilled',
      title: 'Order Out for Delivery',
      message: `${vendorName} has dispatched your order via ${courierProvider}. It's on the way!`,
      payload: { orderId, courierProvider, courierReference },
    }).catch(err => console.error('[NOTIFICATION] Failed:', err));

    return NextResponse.json({
      success: true,
      message: 'Courier booked, order out for delivery',
      order: result.order,
      courierProvider,
      courierReference,
    });

  } else if (action === 'markOrderDelivered') {
    // Phase 7D: Mark entire order as delivered (vendor declaration)
    // Preconditions: Order must be in 'out_for_delivery' status
    if (normalizedStatus !== 'out_for_delivery') {
      return NextResponse.json({ 
        error: `Cannot mark as delivered. Order must be 'out_for_delivery'. Current: ${order.status}` 
      }, { status: 409 });
    }

    // Mark all items as delivered
    const orderItems = await getOrderItemsByOrderId(orderId);
    for (const item of orderItems) {
      if (item.fulfillment_status === 'handed_to_courier') {
        await fulfillOrderItem(item.id, item.vendor_id);
      }
    }

    const result = await transitionOrderStatus(
      orderId,
      'delivered',
      { id: session.user_id, role: 'vendor', name: user?.name, email: user?.email }
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: result.statusCode || 500 });
    }

    await createAuditLog({
      action: 'ORDER_MARKED_DELIVERED',
      category: 'order',
      adminId: session.user_id,
      adminName: user?.name || 'Vendor',
      adminEmail: user?.email || '',
      adminRole: session.user_role,
      targetId: orderId,
      targetType: 'order',
      targetName: `Order ${orderId}`,
      details: JSON.stringify({ deliveredAt: new Date().toISOString() }),
    });

    createNotification({
      userId: order.buyer_id,
      role: 'buyer',
      type: 'order_fulfilled',
      title: 'Order Delivered',
      message: `Your order from ${vendorName} has been delivered! You have 48 hours to raise any issues.`,
      payload: { orderId },
    }).catch(err => console.error('[NOTIFICATION] Failed:', err));

    // Send SMS notification (fire-and-forget)
    if (order.buyer_phone) {
      sendOrderStatusSMS(
        order.buyer_phone,
        order.buyer_name || 'Customer',
        order.buyer_id,
        orderId,
        'delivered'
      ).catch(err => console.error('[SMS] Failed to send delivered SMS:', err));
    }

    return NextResponse.json({
      success: true,
      message: 'Order marked as delivered. 48-hour dispute window started.',
      order: result.order,
    });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

/**
 * Phase 7D Multi-Vendor: Handle per-vendor delivery actions
 * Each vendor manages their own items' delivery independently
 */
async function handleVendorDeliveryAction(
  orderId: string,
  action: string,
  session: { user_id: string; user_role: string },
  user: { name?: string; email?: string; business_name?: string } | null,
  order: DbOrder,
  courierProvider?: string,
  courierReference?: string
): Promise<NextResponse> {
  const vendorName = user?.business_name || user?.name || 'Vendor';
  const vendorId = session.user_id;

  if (action === 'vendorReadyForPickup') {
    // Mark vendor's items as ready for pickup
    const result = await markVendorItemsReadyForPickup(orderId, vendorId);
    
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    await createAuditLog({
      action: 'VENDOR_ITEMS_READY_FOR_PICKUP',
      category: 'order',
      adminId: vendorId,
      adminName: user?.name || 'Vendor',
      adminEmail: user?.email || '',
      adminRole: session.user_role,
      targetId: orderId,
      targetType: 'order',
      targetName: `Order ${orderId}`,
      details: JSON.stringify({ vendorId, itemsUpdated: result.itemsUpdated }),
    });

    createNotification({
      userId: order.buyer_id,
      role: 'buyer',
      type: 'order_fulfilled',
      title: 'Items Ready for Pickup',
      message: `${vendorName}'s items are ready for courier pickup!`,
      payload: { orderId, vendorId, vendorName },
    }).catch(err => console.error('[NOTIFICATION] Failed:', err));

    return NextResponse.json({
      success: true,
      message: 'Your items are marked as ready for pickup',
      itemsUpdated: result.itemsUpdated,
    });
  }

  if (action === 'vendorBookCourier') {
    if (!courierProvider) {
      return NextResponse.json({ error: 'Courier provider is required' }, { status: 400 });
    }

    const result = await bookVendorCourier(orderId, vendorId, courierProvider, courierReference);
    
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    await createAuditLog({
      action: 'VENDOR_COURIER_BOOKED',
      category: 'order',
      adminId: vendorId,
      adminName: user?.name || 'Vendor',
      adminEmail: user?.email || '',
      adminRole: session.user_role,
      targetId: orderId,
      targetType: 'order',
      targetName: `Order ${orderId}`,
      details: JSON.stringify({ vendorId, courierProvider, courierReference, itemsUpdated: result.itemsUpdated }),
    });

    createNotification({
      userId: order.buyer_id,
      role: 'buyer',
      type: 'order_fulfilled',
      title: 'Items Out for Delivery',
      message: `${vendorName} has dispatched your items via ${courierProvider}!`,
      payload: { orderId, vendorId, vendorName, courierProvider },
    }).catch(err => console.error('[NOTIFICATION] Failed:', err));

    return NextResponse.json({
      success: true,
      message: `Courier booked via ${courierProvider}. Items out for delivery!`,
      itemsUpdated: result.itemsUpdated,
      courierProvider,
    });
  }

  if (action === 'vendorMarkDelivered') {
    const result = await markVendorItemsDelivered(orderId, vendorId);
    
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    await createAuditLog({
      action: 'VENDOR_ITEMS_DELIVERED',
      category: 'order',
      adminId: vendorId,
      adminName: user?.name || 'Vendor',
      adminEmail: user?.email || '',
      adminRole: session.user_role,
      targetId: orderId,
      targetType: 'order',
      targetName: `Order ${orderId}`,
      details: JSON.stringify({ vendorId, itemsUpdated: result.itemsUpdated }),
    });

    createNotification({
      userId: order.buyer_id,
      role: 'buyer',
      type: 'order_fulfilled',
      title: 'Items Delivered',
      message: `${vendorName}'s items have been delivered! You have 48 hours to raise any issues.`,
      payload: { orderId, vendorId, vendorName },
    }).catch(err => console.error('[NOTIFICATION] Failed:', err));

    // Send SMS notification (fire-and-forget)
    if (order.buyer_phone) {
      sendOrderStatusSMS(
        order.buyer_phone,
        order.buyer_name || 'Customer',
        order.buyer_id,
        orderId,
        'delivered'
      ).catch(err => console.error('[SMS] Failed to send delivered SMS:', err));
    }

    return NextResponse.json({
      success: true,
      message: 'Your items are marked as delivered. 48-hour dispute window started.',
      itemsUpdated: result.itemsUpdated,
    });
  }

  return NextResponse.json({ error: 'Unknown vendor action' }, { status: 400 });
}
