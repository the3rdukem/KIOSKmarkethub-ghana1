/**
 * Notifications Data Access Layer
 * 
 * Provides database operations for in-app notifications.
 * Notifications are append-only (no edits, no deletes per Phase 4B spec).
 */

import { query } from '../index';
import { v4 as uuidv4 } from 'uuid';

export type NotificationType = 
  | 'order_created'
  | 'order_paid'
  | 'order_cancelled'
  | 'order_fulfilled'
  | 'review_reply'
  | 'moderation_action'
  | 'system'
  | 'dispute_opened'
  | 'dispute_resolved'
  | 'dispute_updated'
  | 'refund_initiated'
  | 'refund_processed';

export type NotificationRole = 'buyer' | 'vendor' | 'admin';

export interface Notification {
  id: string;
  userId: string;
  role: NotificationRole;
  type: NotificationType;
  title: string;
  message: string;
  payload?: Record<string, unknown>;
  isRead: boolean;
  createdAt: string;
}

export interface CreateNotificationInput {
  userId: string;
  role: NotificationRole;
  type: NotificationType;
  title: string;
  message: string;
  payload?: Record<string, unknown>;
}

interface DbNotificationRow {
  id: string;
  user_id: string;
  role: string;
  type: string;
  title: string;
  message: string;
  payload: string | null;
  is_read: number;
  created_at: string;
}

function mapRowToNotification(row: DbNotificationRow): Notification {
  return {
    id: row.id,
    userId: row.user_id,
    role: row.role as NotificationRole,
    type: row.type as NotificationType,
    title: row.title,
    message: row.message,
    payload: row.payload ? JSON.parse(row.payload) : undefined,
    isRead: Boolean(row.is_read),
    createdAt: row.created_at,
  };
}

export async function createNotification(input: CreateNotificationInput): Promise<Notification> {
  const id = `notif_${uuidv4().replace(/-/g, '').substring(0, 16)}`;
  const now = new Date().toISOString();
  const payloadJson = input.payload ? JSON.stringify(input.payload) : null;

  await query(
    `INSERT INTO notifications (id, user_id, role, type, title, message, payload, is_read, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 0, $8)`,
    [id, input.userId, input.role, input.type, input.title, input.message, payloadJson, now]
  );

  return {
    id,
    userId: input.userId,
    role: input.role,
    type: input.type,
    title: input.title,
    message: input.message,
    payload: input.payload,
    isRead: false,
    createdAt: now,
  };
}

export async function getNotificationsForUser(
  userId: string,
  options?: { limit?: number; offset?: number; unreadOnly?: boolean }
): Promise<{ notifications: Notification[]; total: number; unreadCount: number }> {
  const limit = options?.limit || 50;
  const offset = options?.offset || 0;

  let whereClause = 'WHERE user_id = $1';
  const params: (string | number)[] = [userId];

  if (options?.unreadOnly) {
    whereClause += ' AND is_read = 0';
  }

  const countResult = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM notifications ${whereClause}`,
    params
  );

  const unreadResult = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = 0`,
    [userId]
  );

  const result = await query<DbNotificationRow>(
    `SELECT * FROM notifications ${whereClause} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );

  return {
    notifications: result.rows.map(mapRowToNotification),
    total: parseInt(countResult.rows[0].count),
    unreadCount: parseInt(unreadResult.rows[0].count),
  };
}

export async function getUnreadCount(userId: string): Promise<number> {
  const result = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = 0`,
    [userId]
  );
  return parseInt(result.rows[0].count);
}

export async function markAsRead(notificationId: string, userId: string): Promise<boolean> {
  const result = await query(
    `UPDATE notifications SET is_read = 1 WHERE id = $1 AND user_id = $2`,
    [notificationId, userId]
  );
  return (result.rowCount || 0) > 0;
}

export async function markAllAsRead(userId: string): Promise<number> {
  const result = await query(
    `UPDATE notifications SET is_read = 1 WHERE user_id = $1 AND is_read = 0`,
    [userId]
  );
  return result.rowCount || 0;
}

export async function markMessageNotificationsAsRead(userId: string): Promise<number> {
  const result = await query(
    `UPDATE notifications SET is_read = 1 
     WHERE user_id = $1 AND is_read = 0 
     AND title = 'New Message'`,
    [userId]
  );
  return result.rowCount || 0;
}

export async function notifyOrderCreated(
  buyerId: string,
  orderId: string,
  orderNumber: string,
  total: number
): Promise<Notification> {
  return createNotification({
    userId: buyerId,
    role: 'buyer',
    type: 'order_created',
    title: 'Order Placed',
    message: `Your order #${orderNumber} for GHS ${total.toLocaleString()} has been placed.`,
    payload: { orderId, orderNumber, total },
  });
}

export async function notifyOrderPaid(
  vendorId: string,
  orderId: string,
  orderNumber: string,
  buyerName: string,
  total: number
): Promise<Notification> {
  return createNotification({
    userId: vendorId,
    role: 'vendor',
    type: 'order_paid',
    title: 'Payment Received',
    message: `Order #${orderNumber} from ${buyerName} (GHS ${total.toLocaleString()}) has been paid.`,
    payload: { orderId, orderNumber, buyerName, total },
  });
}

export async function notifyOrderCancelled(
  userId: string,
  role: NotificationRole,
  orderId: string,
  orderNumber: string,
  reason?: string
): Promise<Notification> {
  return createNotification({
    userId,
    role,
    type: 'order_cancelled',
    title: 'Order Cancelled',
    message: `Order #${orderNumber} has been cancelled${reason ? `: ${reason}` : '.'}`,
    payload: { orderId, orderNumber, reason },
  });
}

export async function notifyOrderFulfilled(
  buyerId: string,
  orderId: string,
  orderNumber: string,
  vendorName: string
): Promise<Notification> {
  return createNotification({
    userId: buyerId,
    role: 'buyer',
    type: 'order_fulfilled',
    title: 'Order Shipped',
    message: `Your order #${orderNumber} has been shipped by ${vendorName}.`,
    payload: { orderId, orderNumber, vendorName },
  });
}

export async function notifyReviewReply(
  buyerId: string,
  productId: string,
  productName: string,
  vendorName: string
): Promise<Notification> {
  return createNotification({
    userId: buyerId,
    role: 'buyer',
    type: 'review_reply',
    title: 'Vendor Replied to Your Review',
    message: `${vendorName} replied to your review on "${productName}".`,
    payload: { productId, productName, vendorName },
  });
}

export async function notifyModerationAction(
  userId: string,
  role: NotificationRole,
  action: string,
  targetType: string,
  targetName: string,
  reason?: string
): Promise<Notification> {
  return createNotification({
    userId,
    role,
    type: 'moderation_action',
    title: `${targetType} ${action}`,
    message: `Your ${targetType.toLowerCase()} "${targetName}" has been ${action.toLowerCase()}${reason ? `: ${reason}` : '.'}`,
    payload: { action, targetType, targetName, reason },
  });
}
