/**
 * SMS Notifications Data Access Layer
 *
 * Manages SMS templates and logging for the notification system.
 * Works with the Arkesel SMS integration.
 */

import { query } from '../index';

export type SMSEventType =
  | 'order_confirmed'
  | 'order_preparing'
  | 'order_ready_for_pickup'
  | 'order_out_for_delivery'
  | 'order_delivered'
  | 'order_cancelled'
  | 'vendor_new_order'
  | 'dispute_opened'
  | 'dispute_resolved'
  | 'welcome_buyer'
  | 'welcome_vendor'
  | 'payout_processing'
  | 'payout_completed'
  | 'payout_failed';

export type SMSStatus = 'pending' | 'sent' | 'failed' | 'delivered';

export interface SMSTemplate {
  id: string;
  name: string;
  eventType: SMSEventType;
  messageTemplate: string;
  variables: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SMSLog {
  id: string;
  recipientPhone: string;
  recipientName: string | null;
  recipientId: string | null;
  recipientRole: string | null;
  eventType: SMSEventType;
  templateId: string | null;
  messageContent: string;
  status: SMSStatus;
  providerResponse: string | null;
  errorMessage: string | null;
  orderId: string | null;
  sentAt: string | null;
  createdAt: string;
}

interface DbSMSTemplate {
  id: string;
  name: string;
  event_type: string;
  message_template: string;
  variables: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

interface DbSMSLog {
  id: string;
  recipient_phone: string;
  recipient_name: string | null;
  recipient_id: string | null;
  recipient_role: string | null;
  event_type: string;
  template_id: string | null;
  message_content: string;
  status: string;
  provider_response: string | null;
  error_message: string | null;
  order_id: string | null;
  sent_at: string | null;
  created_at: string;
}

function mapDbTemplate(row: DbSMSTemplate): SMSTemplate {
  return {
    id: row.id,
    name: row.name,
    eventType: row.event_type as SMSEventType,
    messageTemplate: row.message_template,
    variables: row.variables ? row.variables.split(',').map(v => v.trim()) : [],
    isActive: row.is_active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapDbLog(row: DbSMSLog): SMSLog {
  return {
    id: row.id,
    recipientPhone: row.recipient_phone,
    recipientName: row.recipient_name,
    recipientId: row.recipient_id,
    recipientRole: row.recipient_role,
    eventType: row.event_type as SMSEventType,
    templateId: row.template_id,
    messageContent: row.message_content,
    status: row.status as SMSStatus,
    providerResponse: row.provider_response,
    errorMessage: row.error_message,
    orderId: row.order_id,
    sentAt: row.sent_at,
    createdAt: row.created_at,
  };
}

// ============ Template Functions ============

export async function getAllTemplates(): Promise<SMSTemplate[]> {
  const result = await query<DbSMSTemplate>(
    'SELECT * FROM sms_templates ORDER BY name'
  );
  return result.rows.map(mapDbTemplate);
}

export async function getActiveTemplates(): Promise<SMSTemplate[]> {
  const result = await query<DbSMSTemplate>(
    'SELECT * FROM sms_templates WHERE is_active = 1 ORDER BY name'
  );
  return result.rows.map(mapDbTemplate);
}

export async function getTemplateById(id: string): Promise<SMSTemplate | null> {
  const result = await query<DbSMSTemplate>(
    'SELECT * FROM sms_templates WHERE id = $1',
    [id]
  );
  return result.rows[0] ? mapDbTemplate(result.rows[0]) : null;
}

export async function getTemplateByEventType(eventType: SMSEventType): Promise<SMSTemplate | null> {
  const result = await query<DbSMSTemplate>(
    'SELECT * FROM sms_templates WHERE event_type = $1 AND is_active = 1 LIMIT 1',
    [eventType]
  );
  return result.rows[0] ? mapDbTemplate(result.rows[0]) : null;
}

export async function updateTemplate(
  id: string,
  updates: {
    name?: string;
    messageTemplate?: string;
    variables?: string[];
    isActive?: boolean;
  }
): Promise<SMSTemplate | null> {
  const now = new Date().toISOString();
  const current = await getTemplateById(id);
  if (!current) return null;

  const name = updates.name ?? current.name;
  const messageTemplate = updates.messageTemplate ?? current.messageTemplate;
  const variables = updates.variables ? updates.variables.join(',') : current.variables.join(',');
  const isActive = updates.isActive !== undefined ? (updates.isActive ? 1 : 0) : (current.isActive ? 1 : 0);

  await query(
    `UPDATE sms_templates SET 
      name = $1, 
      message_template = $2, 
      variables = $3, 
      is_active = $4, 
      updated_at = $5 
    WHERE id = $6`,
    [name, messageTemplate, variables, isActive, now, id]
  );

  return getTemplateById(id);
}

export async function toggleTemplate(id: string, isActive: boolean): Promise<SMSTemplate | null> {
  const now = new Date().toISOString();
  await query(
    'UPDATE sms_templates SET is_active = $1, updated_at = $2 WHERE id = $3',
    [isActive ? 1 : 0, now, id]
  );
  return getTemplateById(id);
}

// ============ Log Functions ============

function generateLogId(): string {
  return `sms_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

export async function createSMSLog(log: {
  recipientPhone: string;
  recipientName?: string;
  recipientId?: string;
  recipientRole?: string;
  eventType: SMSEventType;
  templateId?: string;
  messageContent: string;
  status: SMSStatus;
  providerResponse?: string;
  errorMessage?: string;
  orderId?: string;
  sentAt?: string;
}): Promise<SMSLog> {
  const id = generateLogId();
  const now = new Date().toISOString();

  await query(
    `INSERT INTO sms_logs (
      id, recipient_phone, recipient_name, recipient_id, recipient_role,
      event_type, template_id, message_content, status, provider_response,
      error_message, order_id, sent_at, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
    [
      id,
      log.recipientPhone,
      log.recipientName || null,
      log.recipientId || null,
      log.recipientRole || null,
      log.eventType,
      log.templateId || null,
      log.messageContent,
      log.status,
      log.providerResponse || null,
      log.errorMessage || null,
      log.orderId || null,
      log.sentAt || null,
      now,
    ]
  );

  const result = await query<DbSMSLog>('SELECT * FROM sms_logs WHERE id = $1', [id]);
  return mapDbLog(result.rows[0]);
}

export async function updateSMSLogStatus(
  id: string,
  status: SMSStatus,
  updates?: {
    providerResponse?: string;
    errorMessage?: string;
    sentAt?: string;
  }
): Promise<SMSLog | null> {
  const result = await query<DbSMSLog>('SELECT * FROM sms_logs WHERE id = $1', [id]);
  if (!result.rows[0]) return null;

  await query(
    `UPDATE sms_logs SET 
      status = $1,
      provider_response = COALESCE($2, provider_response),
      error_message = COALESCE($3, error_message),
      sent_at = COALESCE($4, sent_at)
    WHERE id = $5`,
    [
      status,
      updates?.providerResponse || null,
      updates?.errorMessage || null,
      updates?.sentAt || null,
      id,
    ]
  );

  const updated = await query<DbSMSLog>('SELECT * FROM sms_logs WHERE id = $1', [id]);
  return mapDbLog(updated.rows[0]);
}

export async function getSMSLogs(options?: {
  limit?: number;
  offset?: number;
  eventType?: SMSEventType;
  status?: SMSStatus;
  orderId?: string;
  recipientPhone?: string;
}): Promise<{ logs: SMSLog[]; total: number }> {
  const conditions: string[] = [];
  const params: (string | number)[] = [];
  let paramIndex = 1;

  if (options?.eventType) {
    conditions.push(`event_type = $${paramIndex++}`);
    params.push(options.eventType);
  }
  if (options?.status) {
    conditions.push(`status = $${paramIndex++}`);
    params.push(options.status);
  }
  if (options?.orderId) {
    conditions.push(`order_id = $${paramIndex++}`);
    params.push(options.orderId);
  }
  if (options?.recipientPhone) {
    conditions.push(`recipient_phone = $${paramIndex++}`);
    params.push(options.recipientPhone);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM sms_logs ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].count);

  const limit = Math.min(options?.limit || 50, 200);
  const offset = options?.offset || 0;

  const result = await query<DbSMSLog>(
    `SELECT * FROM sms_logs ${whereClause} ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
    [...params, limit, offset]
  );

  return {
    logs: result.rows.map(mapDbLog),
    total,
  };
}

export async function getSMSLogsByOrder(orderId: string): Promise<SMSLog[]> {
  const result = await query<DbSMSLog>(
    'SELECT * FROM sms_logs WHERE order_id = $1 ORDER BY created_at DESC',
    [orderId]
  );
  return result.rows.map(mapDbLog);
}

export async function getSMSStats(): Promise<{
  totalSent: number;
  totalFailed: number;
  totalPending: number;
  last24Hours: number;
  last7Days: number;
}> {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const statsResult = await query<{ status: string; count: string }>(
    'SELECT status, COUNT(*) as count FROM sms_logs GROUP BY status'
  );

  const stats: Record<string, number> = {};
  for (const row of statsResult.rows) {
    stats[row.status] = parseInt(row.count);
  }

  const last24HoursResult = await query<{ count: string }>(
    'SELECT COUNT(*) as count FROM sms_logs WHERE created_at >= $1',
    [yesterday]
  );

  const last7DaysResult = await query<{ count: string }>(
    'SELECT COUNT(*) as count FROM sms_logs WHERE created_at >= $1',
    [lastWeek]
  );

  return {
    totalSent: stats['sent'] || 0,
    totalFailed: stats['failed'] || 0,
    totalPending: stats['pending'] || 0,
    last24Hours: parseInt(last24HoursResult.rows[0].count),
    last7Days: parseInt(last7DaysResult.rows[0].count),
  };
}

// ============ Settings Functions ============

export async function isSMSNotificationsEnabled(): Promise<boolean> {
  const result = await query<{ value: string }>(
    "SELECT value FROM site_settings WHERE key = 'sms_notifications_enabled'"
  );
  return result.rows[0]?.value === 'true';
}

export async function setSMSNotificationsEnabled(enabled: boolean): Promise<void> {
  const now = new Date().toISOString();
  await query(
    `UPDATE site_settings SET value = $1, updated_at = $2 WHERE key = 'sms_notifications_enabled'`,
    [enabled ? 'true' : 'false', now]
  );
}

export interface ArkeselConfig {
  apiKey: string;
  senderId: string;
  isDemoMode: boolean;
}

export async function getArkeselConfig(): Promise<ArkeselConfig | null> {
  const result = await query<{ key: string; value: string }>(
    "SELECT key, value FROM site_settings WHERE key IN ('arkesel_api_key', 'arkesel_sender_id', 'arkesel_demo_mode')"
  );
  
  const settings: Record<string, string> = {};
  for (const row of result.rows) {
    settings[row.key] = row.value;
  }
  
  const apiKey = settings['arkesel_api_key'];
  const senderId = settings['arkesel_sender_id'];
  
  if (!apiKey || !senderId) {
    return null;
  }
  
  return {
    apiKey,
    senderId,
    isDemoMode: settings['arkesel_demo_mode'] === 'true',
  };
}

export async function setArkeselConfig(config: Partial<ArkeselConfig>): Promise<void> {
  const now = new Date().toISOString();
  
  if (config.apiKey !== undefined) {
    await query(
      `INSERT INTO site_settings (key, value, updated_at) VALUES ('arkesel_api_key', $1, $2)
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = $2`,
      [config.apiKey, now]
    );
  }
  
  if (config.senderId !== undefined) {
    await query(
      `INSERT INTO site_settings (key, value, updated_at) VALUES ('arkesel_sender_id', $1, $2)
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = $2`,
      [config.senderId, now]
    );
  }
  
  if (config.isDemoMode !== undefined) {
    await query(
      `INSERT INTO site_settings (key, value, updated_at) VALUES ('arkesel_demo_mode', $1, $2)
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = $2`,
      [config.isDemoMode ? 'true' : 'false', now]
    );
  }
}

// ============ Template Compilation ============

export function compileTemplate(template: string, variables: Record<string, string>): string {
  let compiled = template;
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    compiled = compiled.replace(placeholder, value || '');
  }
  return compiled;
}

export function extractTemplateVariables(template: string): string[] {
  const regex = /\{\{(\w+)\}\}/g;
  const variables: string[] = [];
  let match;
  while ((match = regex.exec(template)) !== null) {
    if (!variables.includes(match[1])) {
      variables.push(match[1]);
    }
  }
  return variables;
}
