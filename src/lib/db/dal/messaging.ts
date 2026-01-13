/**
 * Messaging Data Access Layer
 *
 * Production-ready database operations for the messaging system.
 * Supports buyer-vendor conversations with admin moderation.
 *
 * Industry standard patterns:
 * - Role-based authorization
 * - Cursor-based pagination
 * - Atomic unread count updates
 * - Soft deletion
 * - Audit logging
 */

import { query, runTransaction } from '../index';
import { PoolClient } from 'pg';
import { v4 as uuidv4 } from 'uuid';

export type MessageType = 'text' | 'image' | 'file' | 'system';
export type ConversationContext = 'product_inquiry' | 'order_support' | 'general' | 'dispute';
export type ConversationStatus = 'active' | 'archived' | 'flagged' | 'closed';

export interface DbConversation {
  id: string;
  buyerId: string;
  buyerName: string;
  buyerAvatar?: string;
  vendorId: string;
  vendorName: string;
  vendorAvatar?: string;
  vendorBusinessName?: string;
  context: ConversationContext;
  productId?: string;
  productName?: string;
  productImage?: string;
  orderId?: string;
  orderNumber?: string;
  disputeId?: string;
  status: ConversationStatus;
  isPinnedBuyer: boolean;
  isPinnedVendor: boolean;
  isMutedBuyer: boolean;
  isMutedVendor: boolean;
  lastMessageId?: string;
  lastMessageContent?: string;
  lastMessageAt?: string;
  lastMessageSenderId?: string;
  unreadCountBuyer: number;
  unreadCountVendor: number;
  archivedAt?: string;
  archivedBy?: string;
  flaggedAt?: string;
  flaggedBy?: string;
  flagReason?: string;
  moderatorNotes?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DbMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderRole: 'buyer' | 'vendor' | 'admin';
  senderAvatar?: string;
  content: string;
  messageType: MessageType;
  attachmentUrl?: string;
  attachmentName?: string;
  isRead: boolean;
  readAt?: string;
  isDeleted: boolean;
  deletedAt?: string;
  deletedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateConversationInput {
  buyerId: string;
  buyerName: string;
  buyerAvatar?: string;
  vendorId: string;
  vendorName: string;
  vendorAvatar?: string;
  vendorBusinessName?: string;
  context: ConversationContext;
  productId?: string;
  productName?: string;
  productImage?: string;
  orderId?: string;
  orderNumber?: string;
}

export interface CreateMessageInput {
  conversationId: string;
  senderId: string;
  senderName: string;
  senderRole: 'buyer' | 'vendor' | 'admin';
  senderAvatar?: string;
  content: string;
  messageType?: MessageType;
  attachmentUrl?: string;
  attachmentName?: string;
}

interface DbRow {
  id: string;
  buyer_id: string;
  buyer_name: string;
  buyer_avatar?: string;
  vendor_id: string;
  vendor_name: string;
  vendor_avatar?: string;
  vendor_business_name?: string;
  context: string;
  product_id?: string;
  product_name?: string;
  product_image?: string;
  order_id?: string;
  order_number?: string;
  dispute_id?: string;
  status: string;
  is_pinned_buyer: number;
  is_pinned_vendor: number;
  is_muted_buyer: number;
  is_muted_vendor: number;
  last_message_id?: string;
  last_message_content?: string;
  last_message_at?: string;
  last_message_sender_id?: string;
  unread_count_buyer: number;
  unread_count_vendor: number;
  archived_at?: string;
  archived_by?: string;
  flagged_at?: string;
  flagged_by?: string;
  flag_reason?: string;
  moderator_notes?: string;
  reviewed_at?: string;
  reviewed_by?: string;
  created_at: string;
  updated_at: string;
}

interface MessageRow {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_name: string;
  sender_role: string;
  sender_avatar?: string;
  content: string;
  message_type: string;
  attachment_url?: string;
  attachment_name?: string;
  is_read: number;
  read_at?: string;
  is_deleted: number;
  deleted_at?: string;
  deleted_by?: string;
  created_at: string;
  updated_at: string;
}

function mapRowToConversation(row: DbRow): DbConversation {
  return {
    id: row.id,
    buyerId: row.buyer_id,
    buyerName: row.buyer_name,
    buyerAvatar: row.buyer_avatar || undefined,
    vendorId: row.vendor_id,
    vendorName: row.vendor_name,
    vendorAvatar: row.vendor_avatar || undefined,
    vendorBusinessName: row.vendor_business_name || undefined,
    context: row.context as ConversationContext,
    productId: row.product_id || undefined,
    productName: row.product_name || undefined,
    productImage: row.product_image || undefined,
    orderId: row.order_id || undefined,
    orderNumber: row.order_number || undefined,
    disputeId: row.dispute_id || undefined,
    status: row.status as ConversationStatus,
    isPinnedBuyer: row.is_pinned_buyer === 1,
    isPinnedVendor: row.is_pinned_vendor === 1,
    isMutedBuyer: row.is_muted_buyer === 1,
    isMutedVendor: row.is_muted_vendor === 1,
    lastMessageId: row.last_message_id || undefined,
    lastMessageContent: row.last_message_content || undefined,
    lastMessageAt: row.last_message_at || undefined,
    lastMessageSenderId: row.last_message_sender_id || undefined,
    unreadCountBuyer: row.unread_count_buyer || 0,
    unreadCountVendor: row.unread_count_vendor || 0,
    archivedAt: row.archived_at || undefined,
    archivedBy: row.archived_by || undefined,
    flaggedAt: row.flagged_at || undefined,
    flaggedBy: row.flagged_by || undefined,
    flagReason: row.flag_reason || undefined,
    moderatorNotes: row.moderator_notes || undefined,
    reviewedAt: row.reviewed_at || undefined,
    reviewedBy: row.reviewed_by || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRowToMessage(row: MessageRow): DbMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    senderName: row.sender_name,
    senderRole: row.sender_role as 'buyer' | 'vendor' | 'admin',
    senderAvatar: row.sender_avatar || undefined,
    content: row.content,
    messageType: row.message_type as MessageType,
    attachmentUrl: row.attachment_url || undefined,
    attachmentName: row.attachment_name || undefined,
    isRead: row.is_read === 1,
    readAt: row.read_at || undefined,
    isDeleted: row.is_deleted === 1,
    deletedAt: row.deleted_at || undefined,
    deletedBy: row.deleted_by || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createConversation(input: CreateConversationInput): Promise<DbConversation> {
  const existing = await findConversation(
    input.buyerId,
    input.vendorId,
    input.context,
    input.productId,
    input.orderId
  );

  if (existing) {
    return existing;
  }

  const id = `conv_${uuidv4().replace(/-/g, '').substring(0, 16)}`;
  const now = new Date().toISOString();

  await query(
    `INSERT INTO conversations (
      id, buyer_id, buyer_name, buyer_avatar, vendor_id, vendor_name, vendor_avatar,
      vendor_business_name, context, product_id, product_name, product_image,
      order_id, order_number, status, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $16)`,
    [
      id,
      input.buyerId,
      input.buyerName,
      input.buyerAvatar || null,
      input.vendorId,
      input.vendorName,
      input.vendorAvatar || null,
      input.vendorBusinessName || null,
      input.context,
      input.productId || null,
      input.productName || null,
      input.productImage || null,
      input.orderId || null,
      input.orderNumber || null,
      'active',
      now,
    ]
  );

  await createMessagingAuditLog({
    action: 'CONVERSATION_CREATED',
    performedBy: input.buyerId,
    performedByRole: 'buyer',
    conversationId: id,
    details: `Conversation created between ${input.buyerName} and ${input.vendorName}`,
  });

  const result = await getConversationById(id);
  if (!result) {
    throw new Error('Failed to create conversation');
  }
  return result;
}

export async function findConversation(
  buyerId: string,
  vendorId: string,
  context?: ConversationContext,
  productId?: string,
  orderId?: string
): Promise<DbConversation | null> {
  let sql = `
    SELECT * FROM conversations
    WHERE buyer_id = $1 AND vendor_id = $2
  `;
  const params: (string | null)[] = [buyerId, vendorId];
  let paramIndex = 3;

  if (context) {
    sql += ` AND context = $${paramIndex}`;
    params.push(context);
    paramIndex++;
  }

  if (productId) {
    sql += ` AND product_id = $${paramIndex}`;
    params.push(productId);
    paramIndex++;
  }

  if (orderId) {
    sql += ` AND order_id = $${paramIndex}`;
    params.push(orderId);
  }

  sql += ' LIMIT 1';

  const result = await query<DbRow>(sql, params);
  return result.rows.length > 0 ? mapRowToConversation(result.rows[0]) : null;
}

export async function getConversationById(id: string): Promise<DbConversation | null> {
  const result = await query<DbRow>(
    'SELECT * FROM conversations WHERE id = $1',
    [id]
  );
  return result.rows.length > 0 ? mapRowToConversation(result.rows[0]) : null;
}

export async function getConversationForUser(
  conversationId: string,
  userId: string,
  userRole: 'buyer' | 'vendor' | 'admin'
): Promise<DbConversation | null> {
  let sql = 'SELECT * FROM conversations WHERE id = $1';
  const params: string[] = [conversationId];

  if (userRole === 'buyer') {
    sql += ' AND buyer_id = $2';
    params.push(userId);
  } else if (userRole === 'vendor') {
    sql += ' AND vendor_id = $2';
    params.push(userId);
  }

  const result = await query<DbRow>(sql, params);
  return result.rows.length > 0 ? mapRowToConversation(result.rows[0]) : null;
}

export async function listConversationsForUser(
  userId: string,
  role: 'buyer' | 'vendor' | 'admin',
  options?: {
    limit?: number;
    cursor?: string;
    status?: ConversationStatus;
  }
): Promise<{ conversations: DbConversation[]; nextCursor?: string }> {
  const limit = options?.limit || 20;
  const params: (string | number)[] = [];
  let paramIndex = 1;

  let sql = 'SELECT * FROM conversations WHERE ';

  if (role === 'buyer') {
    sql += `buyer_id = $${paramIndex}`;
    params.push(userId);
    paramIndex++;
  } else if (role === 'vendor') {
    sql += `vendor_id = $${paramIndex}`;
    params.push(userId);
    paramIndex++;
  } else {
    sql += '1=1';
  }

  if (options?.status) {
    sql += ` AND status = $${paramIndex}`;
    params.push(options.status);
    paramIndex++;
  } else if (role !== 'admin') {
    sql += ` AND status != 'closed'`;
  }

  if (options?.cursor) {
    sql += ` AND updated_at < $${paramIndex}`;
    params.push(options.cursor);
    paramIndex++;
  }

  sql += ` ORDER BY updated_at DESC LIMIT $${paramIndex}`;
  params.push(limit + 1);

  const result = await query<DbRow>(sql, params);
  const conversations = result.rows.slice(0, limit).map(mapRowToConversation);
  const nextCursor = result.rows.length > limit ? result.rows[limit - 1].updated_at : undefined;

  return { conversations, nextCursor };
}

export async function updateConversation(
  id: string,
  updates: Partial<{
    status: ConversationStatus;
    isPinnedBuyer: boolean;
    isPinnedVendor: boolean;
    isMutedBuyer: boolean;
    isMutedVendor: boolean;
    archivedAt: string;
    archivedBy: string;
    flaggedAt: string;
    flaggedBy: string;
    flagReason: string;
    moderatorNotes: string;
    reviewedAt: string;
    reviewedBy: string;
  }>
): Promise<void> {
  const setClauses: string[] = ['updated_at = $2'];
  const params: (string | number | null)[] = [id, new Date().toISOString()];
  let paramIndex = 3;

  if (updates.status !== undefined) {
    setClauses.push(`status = $${paramIndex}`);
    params.push(updates.status);
    paramIndex++;
  }
  if (updates.isPinnedBuyer !== undefined) {
    setClauses.push(`is_pinned_buyer = $${paramIndex}`);
    params.push(updates.isPinnedBuyer ? 1 : 0);
    paramIndex++;
  }
  if (updates.isPinnedVendor !== undefined) {
    setClauses.push(`is_pinned_vendor = $${paramIndex}`);
    params.push(updates.isPinnedVendor ? 1 : 0);
    paramIndex++;
  }
  if (updates.isMutedBuyer !== undefined) {
    setClauses.push(`is_muted_buyer = $${paramIndex}`);
    params.push(updates.isMutedBuyer ? 1 : 0);
    paramIndex++;
  }
  if (updates.isMutedVendor !== undefined) {
    setClauses.push(`is_muted_vendor = $${paramIndex}`);
    params.push(updates.isMutedVendor ? 1 : 0);
    paramIndex++;
  }
  if (updates.archivedAt !== undefined) {
    setClauses.push(`archived_at = $${paramIndex}`);
    params.push(updates.archivedAt);
    paramIndex++;
  }
  if (updates.archivedBy !== undefined) {
    setClauses.push(`archived_by = $${paramIndex}`);
    params.push(updates.archivedBy);
    paramIndex++;
  }
  if (updates.flaggedAt !== undefined) {
    setClauses.push(`flagged_at = $${paramIndex}`);
    params.push(updates.flaggedAt);
    paramIndex++;
  }
  if (updates.flaggedBy !== undefined) {
    setClauses.push(`flagged_by = $${paramIndex}`);
    params.push(updates.flaggedBy);
    paramIndex++;
  }
  if (updates.flagReason !== undefined) {
    setClauses.push(`flag_reason = $${paramIndex}`);
    params.push(updates.flagReason);
    paramIndex++;
  }
  if (updates.moderatorNotes !== undefined) {
    setClauses.push(`moderator_notes = $${paramIndex}`);
    params.push(updates.moderatorNotes);
    paramIndex++;
  }
  if (updates.reviewedAt !== undefined) {
    setClauses.push(`reviewed_at = $${paramIndex}`);
    params.push(updates.reviewedAt);
    paramIndex++;
  }
  if (updates.reviewedBy !== undefined) {
    setClauses.push(`reviewed_by = $${paramIndex}`);
    params.push(updates.reviewedBy);
    paramIndex++;
  }

  await query(
    `UPDATE conversations SET ${setClauses.join(', ')} WHERE id = $1`,
    params
  );
}

export async function createMessage(input: CreateMessageInput): Promise<DbMessage> {
  const id = `msg_${uuidv4().replace(/-/g, '').substring(0, 16)}`;
  const now = new Date().toISOString();
  const messageType = input.messageType || 'text';

  const contentPreview = input.content.length > 100 
    ? input.content.substring(0, 100) + '...' 
    : input.content;

  await runTransaction(async (client: PoolClient) => {
    await client.query(
      `INSERT INTO messages (
        id, conversation_id, sender_id, sender_name, sender_role, sender_avatar,
        content, message_type, attachment_url, attachment_name, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)`,
      [
        id,
        input.conversationId,
        input.senderId,
        input.senderName,
        input.senderRole,
        input.senderAvatar || null,
        input.content,
        messageType,
        input.attachmentUrl || null,
        input.attachmentName || null,
        now,
      ]
    );

    const conversation = await getConversationById(input.conversationId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    const unreadUpdate = input.senderRole === 'buyer'
      ? 'unread_count_vendor = unread_count_vendor + 1'
      : 'unread_count_buyer = unread_count_buyer + 1';

    await client.query(
      `UPDATE conversations SET
        last_message_id = $1,
        last_message_content = $2,
        last_message_at = $3,
        last_message_sender_id = $4,
        ${unreadUpdate},
        updated_at = $3
      WHERE id = $5`,
      [id, contentPreview, now, input.senderId, input.conversationId]
    );
  });

  const result = await getMessageById(id);
  if (!result) {
    throw new Error('Failed to create message');
  }
  return result;
}

export async function getMessageById(id: string): Promise<DbMessage | null> {
  const result = await query<MessageRow>(
    'SELECT * FROM messages WHERE id = $1',
    [id]
  );
  return result.rows.length > 0 ? mapRowToMessage(result.rows[0]) : null;
}

export async function listMessages(
  conversationId: string,
  options?: {
    limit?: number;
    cursor?: string;
    includeDeleted?: boolean;
  }
): Promise<{ messages: DbMessage[]; nextCursor?: string }> {
  const limit = options?.limit || 50;
  const params: (string | number)[] = [conversationId];
  let paramIndex = 2;

  let sql = 'SELECT * FROM messages WHERE conversation_id = $1';

  if (!options?.includeDeleted) {
    sql += ' AND is_deleted = 0';
  }

  if (options?.cursor) {
    sql += ` AND created_at < $${paramIndex}`;
    params.push(options.cursor);
    paramIndex++;
  }

  sql += ` ORDER BY created_at DESC LIMIT $${paramIndex}`;
  params.push(limit + 1);

  const result = await query<MessageRow>(sql, params);
  const messages = result.rows.slice(0, limit).map(mapRowToMessage);
  const nextCursor = result.rows.length > limit ? result.rows[limit - 1].created_at : undefined;

  return { messages, nextCursor };
}

export async function markMessageAsRead(messageId: string, readerId: string): Promise<void> {
  const message = await getMessageById(messageId);
  if (!message || message.senderId === readerId) {
    return;
  }

  const now = new Date().toISOString();
  await query(
    'UPDATE messages SET is_read = 1, read_at = $1, updated_at = $1 WHERE id = $2 AND is_read = 0',
    [now, messageId]
  );
}

export async function markConversationAsRead(
  conversationId: string,
  userId: string,
  role: 'buyer' | 'vendor'
): Promise<void> {
  const now = new Date().toISOString();

  await runTransaction(async (client: PoolClient) => {
    await client.query(
      `UPDATE messages SET is_read = 1, read_at = $1, updated_at = $1
       WHERE conversation_id = $2 AND sender_id != $3 AND is_read = 0`,
      [now, conversationId, userId]
    );

    const unreadReset = role === 'buyer'
      ? 'unread_count_buyer = 0'
      : 'unread_count_vendor = 0';

    await client.query(
      `UPDATE conversations SET ${unreadReset}, updated_at = $1 WHERE id = $2`,
      [now, conversationId]
    );
  });
}

export async function softDeleteMessage(
  messageId: string,
  deletedBy: string
): Promise<void> {
  const now = new Date().toISOString();
  await query(
    `UPDATE messages SET is_deleted = 1, deleted_at = $1, deleted_by = $2, updated_at = $1
     WHERE id = $3`,
    [now, deletedBy, messageId]
  );

  await createMessagingAuditLog({
    action: 'MESSAGE_DELETED',
    performedBy: deletedBy,
    performedByRole: 'admin',
    messageId,
    details: 'Message soft deleted',
  });
}

export async function flagConversation(
  conversationId: string,
  adminId: string,
  reason: string
): Promise<void> {
  const now = new Date().toISOString();
  await updateConversation(conversationId, {
    status: 'flagged',
    flaggedAt: now,
    flaggedBy: adminId,
    flagReason: reason,
  });

  await createMessagingAuditLog({
    action: 'CONVERSATION_FLAGGED',
    performedBy: adminId,
    performedByRole: 'admin',
    conversationId,
    details: `Flagged: ${reason}`,
  });
}

export async function unflagConversation(
  conversationId: string,
  adminId: string,
  notes: string
): Promise<void> {
  const now = new Date().toISOString();
  await updateConversation(conversationId, {
    status: 'active',
    reviewedAt: now,
    reviewedBy: adminId,
    moderatorNotes: notes,
  });

  await createMessagingAuditLog({
    action: 'CONVERSATION_UNFLAGGED',
    performedBy: adminId,
    performedByRole: 'admin',
    conversationId,
    details: `Unflagged with notes: ${notes}`,
  });
}

export async function archiveConversation(
  conversationId: string,
  userId: string,
  userRole: 'buyer' | 'vendor'
): Promise<void> {
  const now = new Date().toISOString();
  await updateConversation(conversationId, {
    status: 'archived',
    archivedAt: now,
    archivedBy: userId,
  });

  await createMessagingAuditLog({
    action: 'CONVERSATION_ARCHIVED',
    performedBy: userId,
    performedByRole: userRole,
    conversationId,
    details: 'Conversation archived',
  });
}

export async function getUnreadCount(
  userId: string,
  role: 'buyer' | 'vendor'
): Promise<number> {
  const column = role === 'buyer' ? 'unread_count_buyer' : 'unread_count_vendor';
  const userColumn = role === 'buyer' ? 'buyer_id' : 'vendor_id';

  const result = await query<{ total: string }>(
    `SELECT COALESCE(SUM(${column}), 0) as total FROM conversations
     WHERE ${userColumn} = $1 AND status = 'active'`,
    [userId]
  );

  return parseInt(result.rows[0]?.total || '0', 10);
}

export async function getFlaggedConversations(
  options?: { limit?: number; cursor?: string }
): Promise<{ conversations: DbConversation[]; nextCursor?: string }> {
  return listConversationsForUser('admin', 'admin', {
    ...options,
    status: 'flagged',
  });
}

interface AuditLogInput {
  action: string;
  performedBy: string;
  performedByRole: 'buyer' | 'vendor' | 'admin';
  conversationId?: string;
  messageId?: string;
  details?: string;
}

async function createMessagingAuditLog(input: AuditLogInput): Promise<void> {
  const id = `mlog_${uuidv4().replace(/-/g, '').substring(0, 16)}`;
  const now = new Date().toISOString();

  try {
    await query(
      `INSERT INTO messaging_audit_logs (
        id, action, performed_by, performed_by_role, conversation_id, message_id, details, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        id,
        input.action,
        input.performedBy,
        input.performedByRole,
        input.conversationId || null,
        input.messageId || null,
        input.details || null,
        now,
      ]
    );
  } catch (error) {
    console.error('[MESSAGING_DAL] Audit log error:', error);
  }
}

export async function getMessagingAuditLogs(
  conversationId?: string,
  options?: { limit?: number }
): Promise<Array<{
  id: string;
  action: string;
  performedBy: string;
  performedByRole: string;
  conversationId?: string;
  messageId?: string;
  details?: string;
  createdAt: string;
}>> {
  const limit = options?.limit || 100;
  let sql = 'SELECT * FROM messaging_audit_logs';
  const params: (string | number)[] = [];

  if (conversationId) {
    sql += ' WHERE conversation_id = $1';
    params.push(conversationId);
  }

  sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
  params.push(limit);

  interface AuditRow {
    id: string;
    action: string;
    performed_by: string;
    performed_by_role: string;
    conversation_id?: string;
    message_id?: string;
    details?: string;
    created_at: string;
  }

  const result = await query<AuditRow>(sql, params);

  return result.rows.map((row) => ({
    id: row.id,
    action: row.action,
    performedBy: row.performed_by,
    performedByRole: row.performed_by_role,
    conversationId: row.conversation_id || undefined,
    messageId: row.message_id || undefined,
    details: row.details || undefined,
    createdAt: row.created_at,
  }));
}
