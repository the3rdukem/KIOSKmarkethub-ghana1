/**
 * Orders API Route
 *
 * CRUD operations for orders.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { validateSession } from '@/lib/db/dal/sessions';
import {
  getOrders,
  createOrder,
  getOrderStats,
  CreateOrderInput,
  parseOrderItems,
  parseShippingAddress,
} from '@/lib/db/dal/orders';
import { getUserById } from '@/lib/db/dal/users';
import { reduceInventory } from '@/lib/db/dal/products';

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
    const status = (searchParams.get('status') || undefined) as 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded' | undefined;
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');

    let orders;

    if (session.user_role === 'admin' || session.user_role === 'master_admin') {
      // Admins see all orders
      orders = await getOrders({ status, limit: limit ? parseInt(limit, 10) : undefined, offset: offset ? parseInt(offset, 10) : undefined });
    } else if (session.user_role === 'vendor') {
      // Vendors see orders containing their products
      orders = await getOrders({ vendorId: session.user_id, status });
    } else {
      // Buyers see their own orders
      orders = await getOrders({ buyerId: session.user_id, status });
    }

    const transformedOrders = orders.map((order) => ({
      id: order.id,
      buyerId: order.buyer_id,
      buyerName: order.buyer_name,
      buyerEmail: order.buyer_email,
      items: parseOrderItems(order),
      subtotal: order.subtotal,
      shippingFee: order.shipping_fee,
      tax: order.tax,
      total: order.total,
      status: order.status,
      paymentStatus: order.payment_status,
      paymentMethod: order.payment_method,
      shippingAddress: parseShippingAddress(order),
      trackingNumber: order.tracking_number,
      notes: order.notes,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
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
 * POST /api/orders
 */
export async function POST(request: NextRequest) {
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

    const user = await getUserById(session.user_id);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();

    // Validate required fields
    if (!body.items || !body.shippingAddress) {
      return NextResponse.json(
        { error: 'Items and shipping address are required' },
        { status: 400 }
      );
    }

    if (!Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: 'At least one item is required' }, { status: 400 });
    }

    // Calculate totals
    const subtotal = body.items.reduce(
      (sum: number, item: { price: number; quantity: number }) =>
        sum + item.price * item.quantity,
      0
    );
    const shippingFee = body.shippingFee || 0;
    const tax = body.tax || 0;
    const total = subtotal + shippingFee + tax;

    const orderInput: CreateOrderInput = {
      buyerId: session.user_id,
      buyerName: user.name,
      buyerEmail: user.email,
      items: body.items,
      subtotal,
      shippingFee,
      tax,
      total,
      paymentMethod: body.paymentMethod,
      shippingAddress: body.shippingAddress,
      notes: body.notes,
    };

    const order = await createOrder(orderInput);

    // Reduce inventory for each item
    for (const item of body.items) {
      await reduceInventory(item.productId, item.quantity);
    }

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        buyerId: order.buyer_id,
        items: parseOrderItems(order),
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
