/**
 * Disputes Data Access Layer
 * 
 * Provides CRUD operations for the disputes table
 * Handles dispute creation, updates, resolution, and queries
 */

import { query } from '../index';
import { v4 as uuidv4 } from 'uuid';
import { createAuditLog } from './audit';

export type DisputeType = 'refund' | 'quality' | 'delivery' | 'fraud' | 'other';
export type DisputeStatus = 'open' | 'investigating' | 'resolved' | 'escalated' | 'closed';
export type DisputePriority = 'low' | 'medium' | 'high' | 'urgent';
export type ResolutionType = 'full_refund' | 'partial_refund' | 'replacement' | 'no_action' | 'other';

export interface DisputeMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: 'buyer' | 'vendor' | 'admin';
  message: string;
  timestamp: string;
}

export interface Dispute {
  id: string;
  order_id: string;
  buyer_id: string;
  buyer_name: string;
  buyer_email: string;
  vendor_id: string;
  vendor_name: string;
  product_id: string | null;
  product_name: string | null;
  amount: number | null;
  type: DisputeType;
  status: DisputeStatus;
  priority: DisputePriority;
  description: string | null;
  evidence: string[];
  resolution: string | null;
  resolution_type?: ResolutionType;
  refund_amount?: number;
  assigned_to: string | null;
  messages: DisputeMessage[];
  resolved_at: string | null;
  resolved_by?: string;
  refund_status?: RefundStatus;
  refund_reference?: string;
  refunded_at?: string;
  created_at: string;
  updated_at: string;
}

export type RefundStatus = 'pending' | 'processing' | 'completed' | 'failed';

interface DbDispute {
  id: string;
  order_id: string;
  buyer_id: string;
  buyer_name: string;
  buyer_email: string;
  vendor_id: string;
  vendor_name: string;
  product_id: string | null;
  product_name: string | null;
  amount: number | null;
  type: string;
  status: string;
  priority: string;
  description: string | null;
  evidence: string | null;
  resolution: string | null;
  resolution_type: string | null;
  refund_amount: number | null;
  assigned_to: string | null;
  messages: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  refund_status: string | null;
  refund_reference: string | null;
  refunded_at: string | null;
  created_at: string;
  updated_at: string;
}

function parseDispute(row: DbDispute): Dispute {
  let messages: DisputeMessage[] = [];
  if (row.messages) {
    try {
      messages = JSON.parse(row.messages);
    } catch {
      messages = [];
    }
  }

  let evidence: string[] = [];
  if (row.evidence) {
    try {
      evidence = JSON.parse(row.evidence);
    } catch {
      evidence = [];
    }
  }
  
  return {
    id: row.id,
    order_id: row.order_id,
    buyer_id: row.buyer_id,
    buyer_name: row.buyer_name,
    buyer_email: row.buyer_email,
    vendor_id: row.vendor_id,
    vendor_name: row.vendor_name,
    product_id: row.product_id,
    product_name: row.product_name,
    amount: row.amount,
    type: row.type as DisputeType,
    status: row.status as DisputeStatus,
    priority: row.priority as DisputePriority,
    description: row.description,
    evidence,
    resolution: row.resolution,
    resolution_type: row.resolution_type as ResolutionType | undefined,
    refund_amount: row.refund_amount ?? undefined,
    assigned_to: row.assigned_to,
    messages,
    resolved_at: row.resolved_at,
    resolved_by: row.resolved_by ?? undefined,
    refund_status: row.refund_status as RefundStatus | undefined,
    refund_reference: row.refund_reference ?? undefined,
    refunded_at: row.refunded_at ?? undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export interface CreateDisputeInput {
  orderId: string;
  buyerId: string;
  buyerName: string;
  buyerEmail: string;
  vendorId: string;
  vendorName: string;
  productId?: string;
  productName?: string;
  amount?: number;
  type: DisputeType;
  description: string;
  evidence?: string[];
  priority?: DisputePriority;
}

export async function createDispute(input: CreateDisputeInput): Promise<Dispute> {
  const id = `dsp_${uuidv4().replace(/-/g, '').substring(0, 16)}`;
  const now = new Date().toISOString();
  
  const result = await query<DbDispute>(
    `INSERT INTO disputes (
      id, order_id, buyer_id, buyer_name, buyer_email, 
      vendor_id, vendor_name, product_id, product_name, amount,
      type, status, priority, description, evidence, messages, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
    RETURNING *`,
    [
      id,
      input.orderId,
      input.buyerId,
      input.buyerName,
      input.buyerEmail,
      input.vendorId,
      input.vendorName,
      input.productId || null,
      input.productName || null,
      input.amount || null,
      input.type,
      'open',
      input.priority || 'medium',
      input.description,
      JSON.stringify(input.evidence || []),
      '[]',
      now,
      now
    ]
  );
  
  await createAuditLog({
    action: 'dispute_created',
    category: 'order',
    adminId: input.buyerId,
    adminRole: 'buyer',
    targetId: id,
    targetType: 'dispute',
    details: JSON.stringify({
      orderId: input.orderId,
      type: input.type,
      amount: input.amount,
    }),
  });
  
  return parseDispute(result.rows[0]);
}

export async function getDisputeById(id: string): Promise<Dispute | null> {
  const result = await query<DbDispute>(
    'SELECT * FROM disputes WHERE id = $1',
    [id]
  );
  
  if (result.rows.length === 0) return null;
  return parseDispute(result.rows[0]);
}

export async function getDisputeByOrderId(orderId: string): Promise<Dispute | null> {
  const result = await query<DbDispute>(
    'SELECT * FROM disputes WHERE order_id = $1 ORDER BY created_at DESC LIMIT 1',
    [orderId]
  );
  
  if (result.rows.length === 0) return null;
  return parseDispute(result.rows[0]);
}

export interface GetDisputesOptions {
  status?: DisputeStatus;
  priority?: DisputePriority;
  type?: DisputeType;
  buyerId?: string;
  vendorId?: string;
  assignedTo?: string;
  limit?: number;
  offset?: number;
}

export async function getDisputes(options?: GetDisputesOptions): Promise<{ disputes: Dispute[]; total: number }> {
  const params: (string | number)[] = [];
  let whereClauses: string[] = [];
  
  if (options?.status) {
    params.push(options.status);
    whereClauses.push(`status = $${params.length}`);
  }
  
  if (options?.priority) {
    params.push(options.priority);
    whereClauses.push(`priority = $${params.length}`);
  }
  
  if (options?.type) {
    params.push(options.type);
    whereClauses.push(`type = $${params.length}`);
  }
  
  if (options?.buyerId) {
    params.push(options.buyerId);
    whereClauses.push(`buyer_id = $${params.length}`);
  }
  
  if (options?.vendorId) {
    params.push(options.vendorId);
    whereClauses.push(`vendor_id = $${params.length}`);
  }
  
  if (options?.assignedTo) {
    params.push(options.assignedTo);
    whereClauses.push(`assigned_to = $${params.length}`);
  }
  
  const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  
  const countResult = await query<{ total: string }>(
    `SELECT COUNT(*) as total FROM disputes ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0]?.total || '0');
  
  let sql = `SELECT * FROM disputes ${whereClause} ORDER BY 
    CASE priority 
      WHEN 'urgent' THEN 1 
      WHEN 'high' THEN 2 
      WHEN 'medium' THEN 3 
      WHEN 'low' THEN 4 
    END,
    created_at DESC`;
  
  const queryParams = [...params];
  
  if (options?.limit) {
    queryParams.push(options.limit);
    sql += ` LIMIT $${queryParams.length}`;
  }
  
  if (options?.offset) {
    queryParams.push(options.offset);
    sql += ` OFFSET $${queryParams.length}`;
  }
  
  const result = await query<DbDispute>(sql, queryParams);
  
  return {
    disputes: result.rows.map(parseDispute),
    total,
  };
}

export async function getBuyerDisputes(buyerId: string): Promise<Dispute[]> {
  const result = await query<DbDispute>(
    'SELECT * FROM disputes WHERE buyer_id = $1 ORDER BY created_at DESC',
    [buyerId]
  );
  
  return result.rows.map(parseDispute);
}

export async function getVendorDisputes(vendorId: string): Promise<Dispute[]> {
  const result = await query<DbDispute>(
    'SELECT * FROM disputes WHERE vendor_id = $1 ORDER BY created_at DESC',
    [vendorId]
  );
  
  return result.rows.map(parseDispute);
}

export interface UpdateDisputeInput {
  status?: DisputeStatus;
  priority?: DisputePriority;
  assignedTo?: string;
  description?: string;
}

export async function updateDispute(
  id: string,
  updates: UpdateDisputeInput,
  actorId: string,
  actorRole: 'admin' | 'master_admin'
): Promise<Dispute | null> {
  const dispute = await getDisputeById(id);
  if (!dispute) return null;
  
  const setClauses: string[] = [];
  const params: (string | number)[] = [id];
  
  if (updates.status !== undefined) {
    params.push(updates.status);
    setClauses.push(`status = $${params.length}`);
  }
  
  if (updates.priority !== undefined) {
    params.push(updates.priority);
    setClauses.push(`priority = $${params.length}`);
  }
  
  if (updates.assignedTo !== undefined) {
    params.push(updates.assignedTo);
    setClauses.push(`assigned_to = $${params.length}`);
  }
  
  if (updates.description !== undefined) {
    params.push(updates.description);
    setClauses.push(`description = $${params.length}`);
  }
  
  if (setClauses.length === 0) return dispute;
  
  params.push(new Date().toISOString());
  setClauses.push(`updated_at = $${params.length}`);
  
  const result = await query<DbDispute>(
    `UPDATE disputes SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *`,
    params
  );
  
  await createAuditLog({
    action: 'dispute_updated',
    category: 'order',
    adminId: actorId,
    adminRole: actorRole,
    targetId: id,
    targetType: 'dispute',
    details: JSON.stringify({ updates }),
  });
  
  return result.rows.length > 0 ? parseDispute(result.rows[0]) : null;
}

export interface ResolveDisputeInput {
  resolutionType: ResolutionType;
  resolution: string;
  refundAmount?: number;
}

export async function resolveDispute(
  id: string,
  input: ResolveDisputeInput,
  actorId: string,
  actorRole: 'admin' | 'master_admin'
): Promise<Dispute | null> {
  const dispute = await getDisputeById(id);
  if (!dispute) return null;
  
  if (dispute.status === 'resolved' || dispute.status === 'closed') {
    throw new Error('Dispute is already resolved or closed');
  }
  
  const now = new Date().toISOString();
  
  const result = await query<DbDispute>(
    `UPDATE disputes SET 
      status = 'resolved',
      resolution = $2,
      resolution_type = $3,
      refund_amount = $4,
      resolved_at = $5,
      resolved_by = $6,
      updated_at = $5
    WHERE id = $1 RETURNING *`,
    [id, input.resolution, input.resolutionType, input.refundAmount || null, now, actorId]
  );
  
  await createAuditLog({
    action: 'dispute_resolved',
    category: 'order',
    adminId: actorId,
    adminRole: actorRole,
    targetId: id,
    targetType: 'dispute',
    details: JSON.stringify({
      resolutionType: input.resolutionType,
      refundAmount: input.refundAmount,
    }),
  });
  
  return result.rows.length > 0 ? parseDispute(result.rows[0]) : null;
}

export async function addDisputeMessage(
  disputeId: string,
  senderId: string,
  senderName: string,
  senderRole: 'buyer' | 'vendor' | 'admin',
  message: string
): Promise<Dispute | null> {
  const dispute = await getDisputeById(disputeId);
  if (!dispute) return null;
  
  const newMessage: DisputeMessage = {
    id: uuidv4(),
    senderId,
    senderName,
    senderRole,
    message,
    timestamp: new Date().toISOString(),
  };
  
  const messages = [...dispute.messages, newMessage];
  
  const result = await query<DbDispute>(
    `UPDATE disputes SET messages = $2, updated_at = $3 WHERE id = $1 RETURNING *`,
    [disputeId, JSON.stringify(messages), new Date().toISOString()]
  );
  
  return result.rows.length > 0 ? parseDispute(result.rows[0]) : null;
}

export async function getDisputeStats(): Promise<{
  total: number;
  open: number;
  investigating: number;
  resolved: number;
  escalated: number;
  byPriority: { urgent: number; high: number; medium: number; low: number };
  avgResolutionTimeHours: number | null;
}> {
  const statsResult = await query<{ status: string; count: string }>(
    `SELECT status, COUNT(*) as count FROM disputes GROUP BY status`
  );
  
  const priorityResult = await query<{ priority: string; count: string }>(
    `SELECT priority, COUNT(*) as count FROM disputes WHERE status NOT IN ('resolved', 'closed') GROUP BY priority`
  );
  
  const avgTimeResult = await query<{ avg_hours: string }>(
    `SELECT AVG(EXTRACT(EPOCH FROM (resolved_at::timestamp - created_at::timestamp))/3600) as avg_hours 
     FROM disputes WHERE resolved_at IS NOT NULL`
  );
  
  const statusCounts: Record<string, number> = {};
  for (const row of statsResult.rows) {
    statusCounts[row.status] = parseInt(row.count);
  }
  
  const priorityCounts: Record<string, number> = { urgent: 0, high: 0, medium: 0, low: 0 };
  for (const row of priorityResult.rows) {
    priorityCounts[row.priority] = parseInt(row.count);
  }
  
  const total = Object.values(statusCounts).reduce((a, b) => a + b, 0);
  
  return {
    total,
    open: statusCounts['open'] || 0,
    investigating: statusCounts['investigating'] || 0,
    resolved: statusCounts['resolved'] || 0,
    escalated: statusCounts['escalated'] || 0,
    byPriority: priorityCounts as { urgent: number; high: number; medium: number; low: number },
    avgResolutionTimeHours: avgTimeResult.rows[0]?.avg_hours 
      ? parseFloat(avgTimeResult.rows[0].avg_hours) 
      : null,
  };
}

export async function escalateDispute(
  id: string,
  actorId: string,
  actorRole: 'admin' | 'master_admin',
  reason?: string
): Promise<Dispute | null> {
  const dispute = await getDisputeById(id);
  if (!dispute) return null;
  
  const now = new Date().toISOString();
  
  const result = await query<DbDispute>(
    `UPDATE disputes SET 
      status = 'escalated',
      priority = 'urgent',
      updated_at = $2
    WHERE id = $1 RETURNING *`,
    [id, now]
  );
  
  await createAuditLog({
    action: 'dispute_escalated',
    category: 'order',
    adminId: actorId,
    adminRole: actorRole,
    targetId: id,
    targetType: 'dispute',
    details: JSON.stringify({ reason }),
  });
  
  return result.rows.length > 0 ? parseDispute(result.rows[0]) : null;
}

export async function closeDispute(
  id: string,
  actorId: string,
  actorRole: 'admin' | 'master_admin',
  reason?: string
): Promise<Dispute | null> {
  const now = new Date().toISOString();
  
  const result = await query<DbDispute>(
    `UPDATE disputes SET 
      status = 'closed',
      updated_at = $2
    WHERE id = $1 RETURNING *`,
    [id, now]
  );
  
  await createAuditLog({
    action: 'dispute_closed',
    category: 'order',
    adminId: actorId,
    adminRole: actorRole,
    targetId: id,
    targetType: 'dispute',
    details: JSON.stringify({ reason }),
  });
  
  return result.rows.length > 0 ? parseDispute(result.rows[0]) : null;
}
