/**
 * Payment Alerts API Route
 *
 * Admin endpoint to monitor payment-related issues including:
 * - Amount mismatches
 * - Failed payments
 * - Missing orderId in webhook
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { validateSession } from '@/lib/db/dal/sessions';
import { query } from '@/lib/db';

interface PaymentAlert {
  id: string;
  action: string;
  orderId: string | null;
  orderName: string | null;
  details: Record<string, unknown>;
  severity: string;
  createdAt: string;
}

/**
 * GET /api/admin/payment-alerts
 * 
 * Returns payment-related audit logs for monitoring
 * Query params:
 * - limit: number (default 50)
 * - type: 'mismatch' | 'failed' | 'all' (default 'all')
 */
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const type = searchParams.get('type') || 'all';

    let actionFilter = '';
    if (type === 'mismatch') {
      actionFilter = `AND action = 'PAYMENT_AMOUNT_MISMATCH'`;
    } else if (type === 'failed') {
      actionFilter = `AND action = 'PAYMENT_FAILED'`;
    } else {
      actionFilter = `AND action IN ('PAYMENT_AMOUNT_MISMATCH', 'PAYMENT_FAILED')`;
    }

    const result = await query<{
      id: string;
      action: string;
      target_id: string | null;
      target_name: string | null;
      details: string | null;
      severity: string;
      created_at: string;
    }>(`
      SELECT id, action, target_id, target_name, details, severity, created_at
      FROM audit_logs
      WHERE category = 'order' ${actionFilter}
      ORDER BY created_at DESC
      LIMIT $1
    `, [limit]);

    const alerts: PaymentAlert[] = result.rows.map(row => ({
      id: row.id,
      action: row.action,
      orderId: row.target_id,
      orderName: row.target_name,
      details: row.details ? JSON.parse(row.details) : {},
      severity: row.severity,
      createdAt: row.created_at,
    }));

    const mismatchCount = alerts.filter(a => a.action === 'PAYMENT_AMOUNT_MISMATCH').length;
    const failedCount = alerts.filter(a => a.action === 'PAYMENT_FAILED').length;

    return NextResponse.json({
      alerts,
      summary: {
        total: alerts.length,
        mismatchCount,
        failedCount,
      },
    });
  } catch (error) {
    console.error('Get payment alerts error:', error);
    return NextResponse.json({ error: 'Failed to fetch payment alerts' }, { status: 500 });
  }
}
