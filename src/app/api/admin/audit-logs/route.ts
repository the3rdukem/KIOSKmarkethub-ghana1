/**
 * Audit Logs API Route
 *
 * Admin-only endpoint for viewing audit logs.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { validateSession } from '@/lib/db/dal/sessions';
import {
  getAuditLogs,
  getAuditLogStats,
  type AuditCategory,
  type AuditSeverity,
} from '@/lib/db/dal/audit';

/**
 * GET /api/admin/audit-logs
 *
 * Get audit logs with optional filters (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    // Verify admin authentication
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const session = await validateSession(sessionToken);
    if (!session) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    // Only admins can access audit logs
    if (session.user_role !== 'admin' && session.user_role !== 'master_admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') as AuditCategory | null;
    const severity = searchParams.get('severity') as AuditSeverity | null;
    const adminId = searchParams.get('adminId');
    const targetId = searchParams.get('targetId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');
    const stats = searchParams.get('stats');

    // Return stats if requested
    if (stats === 'true') {
      const auditStats = await getAuditLogStats();
      return NextResponse.json({ stats: auditStats });
    }

    // Fetch audit logs with filters
    const logs = await getAuditLogs({
      category: category || undefined,
      severity: severity || undefined,
      adminId: adminId || undefined,
      targetId: targetId || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      limit: limit ? parseInt(limit, 10) : 100,
      offset: offset ? parseInt(offset, 10) : undefined,
    });

    // Transform for client
    const transformedLogs = logs.map((log) => ({
      id: log.id,
      action: log.action,
      category: log.category,
      adminId: log.admin_id,
      adminName: log.admin_name,
      adminEmail: log.admin_email,
      adminRole: log.admin_role,
      targetId: log.target_id,
      targetType: log.target_type,
      targetName: log.target_name,
      details: log.details,
      previousValue: log.previous_value,
      newValue: log.new_value,
      ipAddress: log.ip_address,
      severity: log.severity,
      timestamp: log.created_at,
    }));

    return NextResponse.json({
      logs: transformedLogs,
      total: transformedLogs.length,
    });
  } catch (error) {
    console.error('Get audit logs error:', error);
    return NextResponse.json({ error: 'Failed to fetch audit logs' }, { status: 500 });
  }
}
