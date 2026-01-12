/**
 * Orders API Route
 *
 * PHASE 2: Checkout & Order Pipeline
 * CRUD operations for orders.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { validateSession } from '@/lib/db/dal/sessions';
import {
  getOrders,
  getOrdersForVendor,
  createOrder,
  getOrderStats,
  getOrderItemsByOrderId,
  CreateOrderInput,
  OrderStatus,
  parseOrderItems,
  parseShippingAddress,
} from '@/lib/db/dal/orders';
import { getUserById } from '@/lib/db/dal/users';
import { reserveInventoryAtomic, InventoryReservationItem } from '@/lib/db/dal/products';
import { clearCart, getCart } from '@/lib/db/dal/cart';
import { createAuditLog } from '@/lib/db/dal/audit';
import { getPool } from '@/lib/db';

/**
 * GET /api/orders
 */
export async function GET(request: NextRequest) {
  try {
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

    const { searchParams } = new URL(request.url);
    // Phase 2 statuses: pending_payment, cancelled, fulfilled
    const status = (searchParams.get('status') || undefined) as OrderStatus | undefined;
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');

    let orders;

    if (session.user_role === 'admin' || session.user_role === 'master_admin') {
      // Admins see all orders
      orders = await getOrders({ status, limit: limit ? parseInt(limit, 10) : undefined, offset: offset ? parseInt(offset, 10) : undefined });
    } else if (session.user_role === 'vendor') {
      // Vendors see orders containing their products (use new order_items table)
      orders = await getOrdersForVendor(session.user_id);
    } else {
      // Buyers see their own orders
      orders = await getOrders({ buyerId: session.user_id, status });
    }

    // Transform orders and include order_items for vendor-scoped data
    const transformedOrders = await Promise.all(orders.map(async (order) => {
      const orderItems = await getOrderItemsByOrderId(order.id);
      
      // Normalize orderItems to consistent format
      const normalizedOrderItems = orderItems.map(item => ({
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
      }));

      // Also normalize legacy items to have same fields for backwards compatibility
      const legacyItems = parseOrderItems(order);
      const normalizedLegacyItems = legacyItems.map((item: any) => ({
        ...item,
        unitPrice: item.unitPrice ?? item.price ?? 0,
        finalPrice: item.finalPrice ?? (item.price ? item.price * item.quantity : null),
      }));
      
      return {
        id: order.id,
        buyerId: order.buyer_id,
        buyerName: order.buyer_name,
        buyerEmail: order.buyer_email,
        items: normalizedLegacyItems,
        orderItems: normalizedOrderItems,
        subtotal: order.subtotal,
        discountTotal: order.discount_total || 0,
        shippingFee: order.shipping_fee,
        tax: order.tax,
        total: order.total,
        status: order.status,
        paymentStatus: order.payment_status,
        paymentMethod: order.payment_method,
        paymentReference: order.payment_reference,
        paymentProvider: order.payment_provider,
        paidAt: order.paid_at,
        shippingAddress: parseShippingAddress(order),
        trackingNumber: order.tracking_number,
        couponCode: order.coupon_code,
        notes: order.notes,
        createdAt: order.created_at,
        updatedAt: order.updated_at,
      };
    }));

    return NextResponse.json({
      orders: transformedOrders,
      total: transformedOrders.length,
    });
  } catch (error) {
    console.error('Get orders error:', error);
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }
}

/**
 * POST /api/orders (PHASE 2: Checkout Flow)
 * 
 * Creates order from cart, decrements inventory, clears cart.
 * Order starts in 'pending_payment' status.
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication - must be logged in to checkout
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const session = await validateSession(sessionToken);
    if (!session) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    // Only buyers can place orders
    if (session.user_role !== 'buyer') {
      return NextResponse.json({ error: 'Only buyers can place orders' }, { status: 403 });
    }

    const user = await getUserById(session.user_id);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();

    // Validate required fields
    const validationErrors: Array<{ field: string; message: string }> = [];

    if (!body.shippingAddress) {
      validationErrors.push({ field: 'shippingAddress', message: 'Shipping address is required' });
    } else {
      if (!body.shippingAddress.fullName?.trim()) {
        validationErrors.push({ field: 'shippingAddress.fullName', message: 'Full name is required' });
      }
      if (!body.shippingAddress.phone?.trim()) {
        validationErrors.push({ field: 'shippingAddress.phone', message: 'Phone number is required' });
      }
      if (!body.shippingAddress.address?.trim()) {
        validationErrors.push({ field: 'shippingAddress.address', message: 'Address is required' });
      }
      if (!body.shippingAddress.city?.trim()) {
        validationErrors.push({ field: 'shippingAddress.city', message: 'City is required' });
      }
      if (!body.shippingAddress.region?.trim()) {
        validationErrors.push({ field: 'shippingAddress.region', message: 'Region is required' });
      }
    }

    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      validationErrors.push({ field: 'items', message: 'Cart is empty' });
    }

    if (validationErrors.length > 0) {
      return NextResponse.json({
        error: 'Validation failed',
        validationErrors,
      }, { status: 400 });
    }

    // Calculate totals with discount support
    const subtotal = body.items.reduce(
      (sum: number, item: { price: number; quantity: number }) =>
        sum + item.price * item.quantity,
      0
    );
    const discountTotal = body.discountTotal || 0;
    const shippingFee = body.shippingFee || 0;
    const tax = body.tax || 0;
    const total = subtotal - discountTotal + shippingFee + tax;

    // Build order input
    const orderInput: CreateOrderInput = {
      buyerId: session.user_id,
      buyerName: user.name,
      buyerEmail: user.email,
      items: body.items.map((item: {
        productId: string;
        productName?: string;
        name?: string;
        vendorId: string;
        vendor?: string;
        vendorName?: string;
        quantity: number;
        price: number;
        appliedDiscount?: number;
        finalPrice?: number;
        image?: string;
        variations?: Record<string, string>;
      }) => ({
        productId: item.productId,
        productName: item.productName || item.name,
        vendorId: item.vendorId,
        vendorName: item.vendorName || item.vendor,
        quantity: item.quantity,
        price: item.price,
        appliedDiscount: item.appliedDiscount || 0,
        finalPrice: item.finalPrice || (item.price * item.quantity),
        image: item.image,
        variations: item.variations,
      })),
      subtotal,
      discountTotal,
      shippingFee,
      tax,
      total,
      paymentMethod: body.paymentMethod,
      shippingAddress: body.shippingAddress,
      couponCode: body.couponCode,
      notes: body.notes,
    };

    // Prepare inventory items for atomic reservation
    const inventoryItems: InventoryReservationItem[] = body.items.map((item: {
      productId: string;
      productName?: string;
      name?: string;
      quantity: number;
    }) => ({
      productId: item.productId,
      productName: item.productName || item.name || item.productId,
      quantity: item.quantity,
    }));

    // Use transaction with SELECT FOR UPDATE to prevent race conditions
    // This ensures two concurrent checkouts for the last item cannot both succeed
    const client = await getPool().connect();
    let order;

    try {
      await client.query('BEGIN');

      // Atomically lock rows, verify stock, and decrement inventory
      const reservationResult = await reserveInventoryAtomic(inventoryItems, client);

      if (!reservationResult.success) {
        await client.query('ROLLBACK');
        return NextResponse.json({
          error: reservationResult.error,
          field: 'items',
        }, { status: 400 });
      }

      // Create the order within the same transaction
      order = await createOrder(orderInput, client);

      await client.query('COMMIT');
    } catch (txError) {
      await client.query('ROLLBACK');
      throw txError;
    } finally {
      client.release();
    }

    // Clear the cart after successful order creation (outside transaction)
    await clearCart('user', session.user_id);

    // Create audit log for order creation
    await createAuditLog({
      action: 'ORDER_CREATED',
      category: 'order',
      adminId: session.user_id,
      adminName: user.name,
      adminEmail: user.email,
      adminRole: session.user_role,
      targetId: order.id,
      targetType: 'order',
      targetName: `Order #${order.id}`,
      details: JSON.stringify({
        itemCount: body.items.length,
        subtotal,
        discountTotal,
        total,
        couponCode: body.couponCode,
      }),
    });

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        buyerId: order.buyer_id,
        items: parseOrderItems(order),
        subtotal: order.subtotal,
        discountTotal: order.discount_total,
        shippingFee: order.shipping_fee,
        total: order.total,
        status: order.status,
        paymentStatus: order.payment_status,
        createdAt: order.created_at,
      },
    });
  } catch (error) {
    console.error('Create order error:', error);
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }
}
