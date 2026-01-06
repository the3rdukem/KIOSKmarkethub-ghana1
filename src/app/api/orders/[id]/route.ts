/**
 * Order API Route
 *
 * Operations for a specific order.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { validateSession } from '@/lib/db/dal/sessions';
import {
  getOrderById,
  updateOrder,
  cancelOrder,
  parseOrderItems,
  parseShippingAddress,
  type UpdateOrderInput,
} from '@/lib/db/dal/orders';
import { logAdminAction } from '@/lib/db/dal/audit';
import { getAdminById } from '@/lib/db/dal/admin';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/orders/[id]
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

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

    const order = await getOrderById(id);
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Check access
    const isAdmin = session.user_role === 'admin' || session.user_role === 'master_admin';
    const isBuyer = order.buyer_id === session.user_id;
    const items = parseOrderItems(order);
    const isVendor = session.user_role === 'vendor' && items.some(item => item.vendorId === session.user_id);

    if (!isAdmin && !isBuyer && !isVendor) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    return NextResponse.json({
      order: {
        id: order.id,
        buyerId: order.buyer_id,
        buyerName: order.buyer_name,
        buyerEmail: order.buyer_email,
        items,
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
      },
    });
  } catch (error) {
    console.error('Get order error:', error);
    return NextResponse.json({ error: 'Failed to fetch order' }, { status: 500 });
  }
}

/**
 * PUT /api/orders/[id]
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

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

    const order = await getOrderById(id);
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Check access
    const isAdmin = session.user_role === 'admin' || session.user_role === 'master_admin';
    const items = parseOrderItems(order);
    const isVendor = session.user_role === 'vendor' && items.some(item => item.vendorId === session.user_id);

    if (!isAdmin && !isVendor) {
      return NextResponse.json({ error: 'Not authorized to update this order' }, { status: 403 });
    }

    const body = await request.json();
    const updates: UpdateOrderInput = {};

    // Vendors can update status and tracking
    if (body.status !== undefined) updates.status = body.status;
    if (body.trackingNumber !== undefined) updates.trackingNumber = body.trackingNumber;
    if (body.notes !== undefined) updates.notes = body.notes;

    // Admins can also update payment status
    if (isAdmin && body.paymentStatus !== undefined) {
      updates.paymentStatus = body.paymentStatus;
    }

    const updatedOrder = await updateOrder(id, updates);

    if (!updatedOrder) {
      return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
    }

    // Log admin action
    if (isAdmin) {
      const admin = await getAdminById(session.user_id);
      if (admin) {
        await logAdminAction('ORDER_UPDATED', {
          id: admin.id,
          name: admin.name,
          email: admin.email,
          role: admin.role,
        }, {
          category: 'order',
          targetId: id,
          targetType: 'order',
          targetName: `Order ${id}`,
          details: `Updated: ${JSON.stringify(updates)}`,
        });
      }
    }

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
 * DELETE /api/orders/[id] (cancel order)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

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

    const order = await getOrderById(id);
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Check access - buyers can cancel their own orders, admins can cancel any
    const isAdmin = session.user_role === 'admin' || session.user_role === 'master_admin';
    const isBuyer = order.buyer_id === session.user_id;

    if (!isAdmin && !isBuyer) {
      return NextResponse.json({ error: 'Not authorized to cancel this order' }, { status: 403 });
    }

    // Can only cancel pending orders
    if (!['pending', 'confirmed'].includes(order.status)) {
      return NextResponse.json({ error: 'Order cannot be cancelled in its current state' }, { status: 400 });
    }

    const success = await cancelOrder(id);

    if (!success) {
      return NextResponse.json({ error: 'Failed to cancel order' }, { status: 500 });
    }

    // Log admin action
    if (isAdmin) {
      const admin = await getAdminById(session.user_id);
      if (admin) {
        await logAdminAction('ORDER_CANCELLED', {
          id: admin.id,
          name: admin.name,
          email: admin.email,
          role: admin.role,
        }, {
          category: 'order',
          targetId: id,
          targetType: 'order',
          targetName: `Order ${id}`,
          details: 'Order cancelled by admin',
        });
      }
    }

    return NextResponse.json({ success: true, message: 'Order cancelled' });
  } catch (error) {
    console.error('Cancel order error:', error);
    return NextResponse.json({ error: 'Failed to cancel order' }, { status: 500 });
  }
}
