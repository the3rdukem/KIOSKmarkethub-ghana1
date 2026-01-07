/**
 * Admin Stats API Route
 *
 * Returns platform statistics from PostgreSQL for admin dashboard.
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { validateSession } from '@/lib/db/dal/sessions';
import { getUserStats } from '@/lib/db/dal/users';
import { query } from '@/lib/db';

export async function GET() {
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

    if (session.user_role !== 'admin' && session.user_role !== 'master_admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const userStats = await getUserStats();

    const productsResult = await query<{ count: string }>('SELECT COUNT(*) as count FROM products');
    const totalProducts = parseInt(productsResult.rows[0]?.count || '0');

    const ordersResult = await query<{ count: string }>('SELECT COUNT(*) as count FROM orders');
    const totalOrders = parseInt(ordersResult.rows[0]?.count || '0');

    const revenueResult = await query<{ total: string }>("SELECT COALESCE(SUM(total), 0) as total FROM orders WHERE status != 'cancelled'");
    const totalRevenue = parseFloat(revenueResult.rows[0]?.total || '0');

    return NextResponse.json({
      userStats: {
        totalBuyers: userStats.totalBuyers,
        totalVendors: userStats.totalVendors,
        verifiedVendors: userStats.verifiedVendors,
        pendingVendors: userStats.pendingVendors,
        activeUsers: userStats.activeUsers,
        suspendedUsers: userStats.suspendedUsers,
      },
      totalProducts,
      totalOrders,
      totalRevenue,
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
