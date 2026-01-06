/**
 * Audit Logs Data Access Layer
 *
 * Server-side only - provides audit logging for all system actions.
 */

import { query } from '../index';
import { v4 as uuidv4 } from 'uuid';

export type AuditCategory = 'vendor' | 'user' | 'product' | 'order' | 'api' | 'system' | 'auth' | 'admin' | 'security' | 'category';
export type AuditSeverity = 'info' | 'warning' | 'critical';

export interface DbAuditLog {
  id: string;
  action: string;
  category: AuditCategory;
  admin_id: string | null;
  admin_name: string | null;
  admin_email: string | null;
  admin_role: string | null;
  target_id: string | null;
  target_type: string | null;
  target_name: string | null;
  details: string | null;
  previous_value: string | null;
  new_value: string | null;
  ip_address: string | null;
  user_agent: string | null;
  severity: AuditSeverity;
  created_at: string;
}

export interface CreateAuditLogInput {
  action: string;
  category: AuditCategory;
  adminId?: string;
  adminName?: string;
  adminEmail?: string;
  adminRole?: string;
  targetId?: string;
  targetType?: string;
  targetName?: string;
  details?: string;
  previousValue?: string;
  newValue?: string;
  ipAddress?: string;
  userAgent?: string;
  severity?: AuditSeverity;
}

export interface AuditLogFilters {
  category?: AuditCategory;
  adminId?: string;
  targetId?: string;
  severity?: AuditSeverity;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

/**
 * Create an audit log entry
 */
export async function createAuditLog(input: CreateAuditLogInput): Promise<DbAuditLog> {
  const id = `log_${uuidv4().replace(/-/g, '').substring(0, 20)}`;
  const now = new Date().toISOString();

  await query(`
    INSERT INTO audit_logs (
      id, action, category, admin_id, admin_name, admin_email, admin_role,
      target_id, target_type, target_name, details, previous_value, new_value,
      ip_address, user_agent, severity, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
  `, [
    id,
    input.action,
    input.category,
    input.adminId || null,
    input.adminName || null,
    input.adminEmail || null,
    input.adminRole || null,
    input.targetId || null,
    input.targetType || null,
    input.targetName || null,
    input.details || null,
    input.previousValue || null,
    input.newValue || null,
    input.ipAddress || null,
    input.userAgent || null,
    input.severity || 'info',
    now
  ]);

  const result = await getAuditLogById(id);
  return result!;
}

/**
 * Get audit log by ID
 */
export async function getAuditLogById(id: string): Promise<DbAuditLog | null> {
  const result = await query<DbAuditLog>('SELECT * FROM audit_logs WHERE id = $1', [id]);
  return result.rows[0] || null;
}

/**
 * Get audit logs with filters
 */
export async function getAuditLogs(filters?: AuditLogFilters): Promise<DbAuditLog[]> {
  let sql = 'SELECT * FROM audit_logs WHERE 1=1';
  const params: unknown[] = [];
  let paramIndex = 1;

  if (filters?.category) {
    sql += ` AND category = $${paramIndex++}`;
    params.push(filters.category);
  }

  if (filters?.adminId) {
    sql += ` AND admin_id = $${paramIndex++}`;
    params.push(filters.adminId);
  }

  if (filters?.targetId) {
    sql += ` AND target_id = $${paramIndex++}`;
    params.push(filters.targetId);
  }

  if (filters?.severity) {
    sql += ` AND severity = $${paramIndex++}`;
    params.push(filters.severity);
  }

  if (filters?.startDate) {
    sql += ` AND created_at >= $${paramIndex++}`;
    params.push(filters.startDate);
  }

  if (filters?.endDate) {
    sql += ` AND created_at <= $${paramIndex++}`;
    params.push(filters.endDate);
  }

  sql += ' ORDER BY created_at DESC';

  if (filters?.limit) {
    sql += ` LIMIT $${paramIndex++}`;
    params.push(filters.limit);
  }

  if (filters?.offset) {
    sql += ` OFFSET $${paramIndex++}`;
    params.push(filters.offset);
  }

  const result = await query<DbAuditLog>(sql, params);
  return result.rows;
}

/**
 * Get recent audit logs (last 24 hours)
 */
export async function getRecentAuditLogs(limit: number = 100): Promise<DbAuditLog[]> {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  return getAuditLogs({ startDate: yesterday, limit });
}

/**
 * Get audit logs for a specific target
 */
export async function getTargetAuditLogs(targetId: string, limit?: number): Promise<DbAuditLog[]> {
  return getAuditLogs({ targetId, limit });
}

/**
 * Get audit logs by admin
 */
export async function getAdminAuditLogs(adminId: string, limit?: number): Promise<DbAuditLog[]> {
  return getAuditLogs({ adminId, limit });
}

/**
 * Get critical security logs
 */
export async function getSecurityLogs(limit?: number): Promise<DbAuditLog[]> {
  return getAuditLogs({ severity: 'critical', limit });
}

/**
 * Cleanup old audit logs (keep last N days)
 */
export async function cleanupAuditLogs(daysToKeep: number = 90): Promise<number> {
  const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000).toISOString();
  const result = await query('DELETE FROM audit_logs WHERE created_at < $1', [cutoffDate]);
  return result.rowCount ?? 0;
}

/**
 * Get audit log stats
 */
export async function getAuditLogStats(): Promise<{
  totalLogs: number;
  todayLogs: number;
  criticalLogs: number;
  byCategory: Record<string, number>;
}> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString();

  const totalResult = await query<{ count: string }>('SELECT COUNT(*) as count FROM audit_logs');
  const todayResult = await query<{ count: string }>('SELECT COUNT(*) as count FROM audit_logs WHERE created_at >= $1', [todayStr]);
  const criticalResult = await query<{ count: string }>("SELECT COUNT(*) as count FROM audit_logs WHERE severity = 'critical'");
  const categoryResult = await query<{ category: string; count: string }>('SELECT category, COUNT(*) as count FROM audit_logs GROUP BY category');

  const total = parseInt(totalResult.rows[0]?.count || '0');
  const todayCount = parseInt(todayResult.rows[0]?.count || '0');
  const critical = parseInt(criticalResult.rows[0]?.count || '0');

  const byCategory: Record<string, number> = {};
  for (const cat of categoryResult.rows) {
    byCategory[cat.category] = parseInt(cat.count);
  }

  return {
    totalLogs: total,
    todayLogs: todayCount,
    criticalLogs: critical,
    byCategory,
  };
}

/**
 * Log admin action (convenience function)
 */
export async function logAdminAction(
  action: string,
  admin: { id: string; name: string; email: string; role: string },
  options?: {
    category?: AuditCategory;
    targetId?: string;
    targetType?: string;
    targetName?: string;
    details?: string;
    previousValue?: string;
    newValue?: string;
    severity?: AuditSeverity;
  }
): Promise<DbAuditLog> {
  return createAuditLog({
    action,
    category: options?.category || 'admin',
    adminId: admin.id,
    adminName: admin.name,
    adminEmail: admin.email,
    adminRole: admin.role,
    ...options,
  });
}

/**
 * Log security event (convenience function)
 */
export async function logSecurityEvent(
  action: string,
  details: string,
  options?: {
    adminId?: string;
    adminEmail?: string;
    ipAddress?: string;
    severity?: AuditSeverity;
  }
): Promise<DbAuditLog> {
  return createAuditLog({
    action,
    category: 'security',
    details,
    severity: options?.severity || 'warning',
    ...options,
  });
}

/**
 * Log auth event (convenience function)
 */
export async function logAuthEvent(
  action: string,
  userId: string,
  userEmail: string,
  success: boolean,
  options?: {
    ipAddress?: string;
    userAgent?: string;
    details?: string;
  }
): Promise<DbAuditLog> {
  return createAuditLog({
    action,
    category: 'auth',
    targetId: userId,
    targetType: 'user',
    targetName: userEmail,
    details: options?.details || (success ? 'Success' : 'Failed'),
    severity: success ? 'info' : 'warning',
    ipAddress: options?.ipAddress,
    userAgent: options?.userAgent,
  });
}
