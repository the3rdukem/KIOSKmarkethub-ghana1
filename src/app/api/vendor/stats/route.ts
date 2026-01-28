import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { validateSessionToken } from '@/lib/db/dal/auth-service';
import { cookies } from 'next/headers';
import { getCommissionRates } from '@/lib/db/dal/commission';

// Force dynamic rendering - no caching
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await validateSessionToken(sessionToken);
    if (!result.success || !result.data?.session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { session } = result.data;
    if (session.userRole !== 'vendor') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const vendorId = session.userId;

    // Get vendor products stats - counting by status
    const productStats = await query<{ status: string; count: string }>(
      `SELECT status, COUNT(*) as count 
       FROM products 
       WHERE vendor_id = $1 
       GROUP BY status`,
      [vendorId]
    );

    // Get ALL orders - we'll filter by vendor in the items JSON
    const allOrders = await query<{ id: string; status: string; items: string }>(
      `SELECT id, status, items FROM orders`,
      []
    );

    // Calculate product counts
    let totalProducts = 0;
    let draftProducts = 0;
    let activeProducts = 0;
    let pendingProducts = 0;
    let suspendedProducts = 0;

    for (const row of productStats.rows) {
      const count = parseInt(row.count, 10);
      totalProducts += count;
      if (row.status === 'draft') draftProducts = count;
      if (row.status === 'active') activeProducts = count;
      if (row.status === 'pending') pendingProducts = count;
      if (row.status === 'suspended') suspendedProducts = count;
    }

    // Calculate order counts and revenue by parsing JSON items
    let totalOrders = 0;
    let pendingOrders = 0;
    let completedOrders = 0;
    let cancelledOrders = 0;
    let totalRevenue = 0;
    const vendorOrderIds = new Set<string>();

    for (const order of allOrders.rows) {
      try {
        const items = JSON.parse(order.items || '[]');
        // Filter items that belong to this vendor
        const vendorItems = items.filter((item: { vendorId?: string }) => item.vendorId === vendorId);
        
        if (vendorItems.length > 0) {
          vendorOrderIds.add(order.id);
          totalOrders++;
          
          // Calculate revenue from vendor's items only
          const orderRevenue = vendorItems.reduce((sum: number, item: { price?: number; quantity?: number }) => {
            return sum + ((item.price || 0) * (item.quantity || 1));
          }, 0);
          totalRevenue += orderRevenue;
          
          // Count by status
          if (['pending', 'confirmed', 'processing'].includes(order.status)) {
            pendingOrders++;
          }
          if (order.status === 'delivered') {
            completedOrders++;
          }
          if (['cancelled', 'refunded'].includes(order.status)) {
            cancelledOrders++;
          }
        }
      } catch (e) {
        // Skip orders with invalid JSON
      }
    }

    // Phase 12: Get vendor earnings from order_items table (commission system)
    const earningsQuery = await query<{
      total_earnings: string;
      total_commission: string;
      commission_rate: string;
      pending_earnings: string;
      completed_earnings: string;
    }>(
      `SELECT 
        COALESCE(SUM(oi.vendor_earnings), 0) as total_earnings,
        COALESCE(SUM(oi.commission_amount), 0) as total_commission,
        COALESCE(AVG(oi.commission_rate), 0.08) as commission_rate,
        COALESCE(SUM(CASE WHEN o.status IN ('created', 'confirmed', 'preparing', 'ready_for_pickup', 'out_for_delivery') THEN oi.vendor_earnings ELSE 0 END), 0) as pending_earnings,
        COALESCE(SUM(CASE WHEN o.status IN ('delivered', 'completed') THEN oi.vendor_earnings ELSE 0 END), 0) as completed_earnings
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE oi.vendor_id = $1`,
      [vendorId]
    );

    const earningsData = earningsQuery.rows[0] || {
      total_earnings: '0',
      total_commission: '0',
      commission_rate: '0.08',
      pending_earnings: '0',
      completed_earnings: '0'
    };

    // Get recent orders (last 5) - filter by vendor items in JSON
    const recentOrdersQuery = await query<{
      id: string;
      status: string;
      items: string;
      created_at: string;
      buyer_name: string;
    }>(
      `SELECT o.id, o.status, o.items, o.created_at, u.name as buyer_name
       FROM orders o
       INNER JOIN users u ON o.buyer_id = u.id
       ORDER BY o.created_at DESC
       LIMIT 50`,
      []
    );

    // Filter and map to vendor's orders
    const recentVendorOrders: Array<{ id: string; status: string; total: number; createdAt: string; buyerName: string }> = [];
    for (const order of recentOrdersQuery.rows) {
      if (recentVendorOrders.length >= 5) break;
      try {
        const items = JSON.parse(order.items || '[]');
        const vendorItems = items.filter((item: { vendorId?: string }) => item.vendorId === vendorId);
        if (vendorItems.length > 0) {
          const vendorTotal = vendorItems.reduce((sum: number, item: { price?: number; quantity?: number }) => {
            return sum + ((item.price || 0) * (item.quantity || 1));
          }, 0);
          recentVendorOrders.push({
            id: order.id,
            status: order.status,
            total: vendorTotal,
            createdAt: order.created_at,
            buyerName: order.buyer_name,
          });
        }
      } catch (e) {
        // Skip orders with invalid JSON
      }
    }

    // Get vendor's current configured commission rate (not historical average)
    const commissionRates = await getCommissionRates(vendorId);
    const currentCommissionRate = commissionRates.effectiveRate;
    const commissionSource = commissionRates.source; // 'vendor', 'category', or 'default'

    // Calculate gross sales from earnings + commission
    const totalEarnings = parseFloat(earningsData.total_earnings) || 0;
    const totalCommission = parseFloat(earningsData.total_commission) || 0;
    const grossSales = totalEarnings + totalCommission;

    const response = NextResponse.json({
      products: {
        total: totalProducts,
        draft: draftProducts,
        active: activeProducts,
        pending: pendingProducts,
        suspended: suspendedProducts,
      },
      orders: {
        total: totalOrders,
        pending: pendingOrders,
        completed: completedOrders,
        cancelled: cancelledOrders,
      },
      revenue: totalRevenue,
      recentOrders: recentVendorOrders,
      earnings: {
        grossSales: grossSales,
        total: totalEarnings,
        commission: totalCommission,
        commissionRate: currentCommissionRate,
        commissionSource: commissionSource, // 'vendor' = partner rate, 'category' = category rate, 'default' = standard rate
        pending: parseFloat(earningsData.pending_earnings) || 0,
        completed: parseFloat(earningsData.completed_earnings) || 0,
      },
    });
    
    // Prevent any caching - always read fresh from DB
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    
    return response;
  } catch (error) {
    console.error('[VENDOR_STATS] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
