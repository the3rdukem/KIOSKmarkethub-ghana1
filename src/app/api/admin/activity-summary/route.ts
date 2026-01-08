import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { validateSessionToken } from '@/lib/db/dal/auth-service';
import { cookies } from 'next/headers';

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
    if (!['admin', 'master_admin'].includes(session.userRole)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use last_activity_checkpoint_at - a stable timestamp set ONCE per login
    // This eliminates race conditions since it doesn't rotate during the session
    // Fallback chain: checkpoint -> previous_login -> created_at -> epoch
    let checkpointAt: string | null = null;

    const legacyAdmin = await query<{ last_activity_checkpoint_at: string | null; previous_login_at: string | null; created_at: string | null }>(
      'SELECT last_activity_checkpoint_at, previous_login_at, created_at FROM admin_users WHERE id = $1',
      [session.userId]
    );
    if (legacyAdmin.rows.length > 0) {
      const row = legacyAdmin.rows[0];
      checkpointAt = row.last_activity_checkpoint_at || row.previous_login_at || row.created_at;
    } else {
      const userAdmin = await query<{ last_activity_checkpoint_at: string | null; previous_login_at: string | null; created_at: string | null }>(
        'SELECT last_activity_checkpoint_at, previous_login_at, created_at FROM users WHERE id = $1',
        [session.userId]
      );
      if (userAdmin.rows.length > 0) {
        const row = userAdmin.rows[0];
        checkpointAt = row.last_activity_checkpoint_at || row.previous_login_at || row.created_at;
      }
    }

    const sinceDate = checkpointAt || '1970-01-01T00:00:00.000Z';

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

    const response = NextResponse.json({
      checkpointAt,
      previousLoginAt: checkpointAt, // Backwards compatibility
      counts: {
        users: parseInt(newUsers.rows[0]?.count || '0', 10),
        vendors: parseInt(newVendors.rows[0]?.count || '0', 10),
        products: parseInt(newProducts.rows[0]?.count || '0', 10),
        orders: parseInt(newOrders.rows[0]?.count || '0', 10),
        disputes: parseInt(newDisputes.rows[0]?.count || '0', 10),
      }
    });
    
    // Prevent any caching - always read fresh from DB
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    
    return response;
  } catch (error) {
    console.error('[ACTIVITY_SUMMARY] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
