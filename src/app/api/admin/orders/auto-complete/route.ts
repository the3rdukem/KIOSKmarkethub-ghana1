/**
 * Phase 7D: Auto-Complete Delivered Orders API
 * 
 * This endpoint processes orders that have been in 'delivered' status
 * for more than 48 hours without a dispute, transitioning them to 'completed'.
 * 
 * This is an admin-triggered endpoint (no scheduling available).
 * In production, this could be called by a cron job or scheduled task.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { validateAdminSession } from '@/lib/db/dal/admin';
import { autoCompleteDeliveredOrders, getOrdersEligibleForCompletion } from '@/lib/db/dal/orders';
import { createAuditLog } from '@/lib/db/dal/audit';

/**
 * GET /api/admin/orders/auto-complete
 * Preview which orders are eligible for auto-completion
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('admin_session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Admin authentication required' }, { status: 401 });
    }

    const session = await validateAdminSession(sessionToken);
    if (!session) {
      return NextResponse.json({ error: 'Invalid admin session' }, { status: 401 });
    }

    const eligibleOrders = await getOrdersEligibleForCompletion();

    return NextResponse.json({
      success: true,
      eligibleCount: eligibleOrders.length,
      orders: eligibleOrders.map(order => ({
        id: order.id,
        buyerName: order.buyer_name,
        total: order.total,
        deliveredAt: order.delivered_at,
        hoursSinceDelivery: order.delivered_at 
          ? Math.floor((Date.now() - new Date(order.delivered_at).getTime()) / (1000 * 60 * 60))
          : null,
      })),
    });
  } catch (error) {
    console.error('Get eligible orders error:', error);
    return NextResponse.json({ error: 'Failed to get eligible orders' }, { status: 500 });
  }
}

/**
 * POST /api/admin/orders/auto-complete
 * Execute auto-completion for all eligible orders
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('admin_session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Admin authentication required' }, { status: 401 });
    }

    const session = await validateAdminSession(sessionToken);
    if (!session) {
      return NextResponse.json({ error: 'Invalid admin session' }, { status: 401 });
    }

    // Get eligible orders before completion for logging
    const eligibleOrders = await getOrdersEligibleForCompletion();
    const eligibleCount = eligibleOrders.length;

    if (eligibleCount === 0) {
      return NextResponse.json({
        success: true,
        message: 'No orders eligible for auto-completion',
        completedCount: 0,
      });
    }

    // Execute auto-completion
    const completedCount = await autoCompleteDeliveredOrders();

    // Log the action
    await createAuditLog({
      action: 'ORDERS_AUTO_COMPLETED',
      category: 'order',
      adminId: session.id,
      adminName: session.name,
      adminEmail: session.email,
      adminRole: session.role,
      targetId: 'batch',
      targetType: 'orders',
      targetName: 'Auto-Complete Batch',
      details: JSON.stringify({
        eligibleCount,
        completedCount,
        orderIds: eligibleOrders.map(o => o.id),
      }),
    });

    return NextResponse.json({
      success: true,
      message: `Auto-completed ${completedCount} of ${eligibleCount} eligible orders`,
      eligibleCount,
      completedCount,
    });
  } catch (error) {
    console.error('Auto-complete orders error:', error);
    return NextResponse.json({ error: 'Failed to auto-complete orders' }, { status: 500 });
  }
}
