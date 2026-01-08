import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { validateSessionToken } from '@/lib/db/dal/auth-service';
import { cookies } from 'next/headers';

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
    if (!['admin', 'master_admin'].includes(session.userRole)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let previousLoginAt: string | null = null;

    const legacyAdmin = await query<{ previous_login_at: string | null }>(
      'SELECT previous_login_at FROM admin_users WHERE id = $1',
      [session.userId]
    );
    if (legacyAdmin.rows.length > 0) {
      previousLoginAt = legacyAdmin.rows[0].previous_login_at;
    } else {
      const userAdmin = await query<{ previous_login_at: string | null }>(
        'SELECT previous_login_at FROM users WHERE id = $1',
        [session.userId]
      );
      if (userAdmin.rows.length > 0) {
        previousLoginAt = userAdmin.rows[0].previous_login_at;
      }
    }

    const sinceDate = previousLoginAt || '1970-01-01T00:00:00.000Z';

    // Count all new activity since admin's last login
    const [
      newUsers,
      newVendors,
      newProducts,
      newOrders,
      newDisputes
    ] = await Promise.all([
      // New users = buyers + vendors created after last login
      query<{ count: string }>(
        `SELECT COUNT(*) as count FROM users WHERE created_at > $1`,
        [sinceDate]
      ),
      // New vendors = users with role='vendor' created after last login
      query<{ count: string }>(
        `SELECT COUNT(*) as count FROM users WHERE role = 'vendor' AND created_at > $1`,
        [sinceDate]
      ),
      // New products = ALL products (draft, published, pending) created after last login
      query<{ count: string }>(
        'SELECT COUNT(*) as count FROM products WHERE created_at > $1',
        [sinceDate]
      ),
      // New orders = orders created after last login
      query<{ count: string }>(
        'SELECT COUNT(*) as count FROM orders WHERE created_at > $1',
        [sinceDate]
      ),
      // New disputes = disputes created after last login
      query<{ count: string }>(
        'SELECT COUNT(*) as count FROM disputes WHERE created_at > $1',
        [sinceDate]
      )
    ]);

    return NextResponse.json({
      previousLoginAt,
      counts: {
        users: parseInt(newUsers.rows[0]?.count || '0', 10),
        vendors: parseInt(newVendors.rows[0]?.count || '0', 10),
        products: parseInt(newProducts.rows[0]?.count || '0', 10),
        orders: parseInt(newOrders.rows[0]?.count || '0', 10),
        disputes: parseInt(newDisputes.rows[0]?.count || '0', 10),
      }
    });
  } catch (error) {
    console.error('[ACTIVITY_SUMMARY] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
