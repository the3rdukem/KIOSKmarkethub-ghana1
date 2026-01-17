/**
 * Email Infrastructure Data Access Layer
 * 
 * Foundation for transactional emails - Phase 4B
 * Currently in dry-run mode (no emails sent by default)
 */

import { query } from '../index';
import { v4 as uuidv4 } from 'uuid';

export type EmailProvider = 'sendgrid' | 'resend' | 'ses' | 'none';

export interface EmailProviderConfig {
  provider: EmailProvider;
  apiKey?: string;
  fromEmail?: string;
  fromName?: string;
  dryRun: boolean;
  region?: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  bodyHtml: string;
  bodyText?: string;
  variables?: string[];
  category: 'order' | 'payment' | 'auth' | 'notification' | 'system';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface DbTemplateRow {
  id: string;
  name: string;
  subject: string;
  body_html: string;
  body_text: string | null;
  variables: string | null;
  category: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

function mapRowToTemplate(row: DbTemplateRow): EmailTemplate {
  return {
    id: row.id,
    name: row.name,
    subject: row.subject,
    bodyHtml: row.body_html,
    bodyText: row.body_text || undefined,
    variables: row.variables ? JSON.parse(row.variables) : undefined,
    category: row.category as EmailTemplate['category'],
    isActive: row.is_active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getEmailProviderConfig(): Promise<EmailProviderConfig | null> {
  const result = await query<{ credentials: string }>(
    `SELECT credentials FROM integrations WHERE provider = 'email' LIMIT 1`
  );
  
  if (result.rows.length === 0) {
    return null;
  }
  
  try {
    return JSON.parse(result.rows[0].credentials) as EmailProviderConfig;
  } catch {
    return { provider: 'none', dryRun: true };
  }
}

export async function updateEmailProviderConfig(config: EmailProviderConfig): Promise<void> {
  const now = new Date().toISOString();
  const isConfigured = config.provider !== 'none' && !!config.apiKey;
  
  await query(
    `UPDATE integrations 
     SET credentials = $1, 
         is_configured = $2, 
         is_enabled = $3,
         status = $4,
         updated_at = $5
     WHERE provider = 'email'`,
    [
      JSON.stringify(config),
      isConfigured ? 1 : 0,
      isConfigured ? 1 : 0,
      isConfigured ? 'connected' : 'not_configured',
      now
    ]
  );
}

export async function getEmailTemplates(
  category?: EmailTemplate['category']
): Promise<EmailTemplate[]> {
  let sql = 'SELECT * FROM email_templates';
  const params: string[] = [];
  
  if (category) {
    sql += ' WHERE category = $1';
    params.push(category);
  }
  
  sql += ' ORDER BY name ASC';
  
  const result = await query<DbTemplateRow>(sql, params);
  return result.rows.map(mapRowToTemplate);
}

export async function getEmailTemplateByName(name: string): Promise<EmailTemplate | null> {
  const result = await query<DbTemplateRow>(
    'SELECT * FROM email_templates WHERE name = $1',
    [name]
  );
  
  return result.rows.length > 0 ? mapRowToTemplate(result.rows[0]) : null;
}

export async function createEmailTemplate(
  input: Omit<EmailTemplate, 'id' | 'createdAt' | 'updatedAt'>
): Promise<EmailTemplate> {
  const id = `tmpl_${uuidv4().replace(/-/g, '').substring(0, 16)}`;
  const now = new Date().toISOString();
  
  await query(
    `INSERT INTO email_templates (id, name, subject, body_html, body_text, variables, category, is_active, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      id,
      input.name,
      input.subject,
      input.bodyHtml,
      input.bodyText || null,
      input.variables ? JSON.stringify(input.variables) : null,
      input.category,
      input.isActive ? 1 : 0,
      now,
      now
    ]
  );
  
  return {
    ...input,
    id,
    createdAt: now,
    updatedAt: now,
  };
}

export async function updateEmailTemplate(
  id: string,
  updates: Partial<Omit<EmailTemplate, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<boolean> {
  const fields: string[] = [];
  const values: (string | number | null)[] = [];
  let paramIndex = 1;
  
  if (updates.name !== undefined) {
    fields.push(`name = $${paramIndex++}`);
    values.push(updates.name);
  }
  if (updates.subject !== undefined) {
    fields.push(`subject = $${paramIndex++}`);
    values.push(updates.subject);
  }
  if (updates.bodyHtml !== undefined) {
    fields.push(`body_html = $${paramIndex++}`);
    values.push(updates.bodyHtml);
  }
  if (updates.bodyText !== undefined) {
    fields.push(`body_text = $${paramIndex++}`);
    values.push(updates.bodyText || null);
  }
  if (updates.variables !== undefined) {
    fields.push(`variables = $${paramIndex++}`);
    values.push(updates.variables ? JSON.stringify(updates.variables) : null);
  }
  if (updates.category !== undefined) {
    fields.push(`category = $${paramIndex++}`);
    values.push(updates.category);
  }
  if (updates.isActive !== undefined) {
    fields.push(`is_active = $${paramIndex++}`);
    values.push(updates.isActive ? 1 : 0);
  }
  
  if (fields.length === 0) return false;
  
  fields.push(`updated_at = $${paramIndex++}`);
  values.push(new Date().toISOString());
  values.push(id);
  
  const result = await query(
    `UPDATE email_templates SET ${fields.join(', ')} WHERE id = $${paramIndex}`,
    values
  );
  
  return (result.rowCount || 0) > 0;
}

export async function checkEmailProviderHealth(): Promise<{
  status: 'connected' | 'error' | 'not_configured';
  provider: EmailProvider;
  dryRun: boolean;
  message?: string;
}> {
  const config = await getEmailProviderConfig();
  
  if (!config || config.provider === 'none') {
    return {
      status: 'not_configured',
      provider: 'none',
      dryRun: true,
      message: 'No email provider configured'
    };
  }
  
  if (config.dryRun) {
    return {
      status: 'connected',
      provider: config.provider,
      dryRun: true,
      message: 'Dry-run mode enabled - no emails will be sent'
    };
  }
  
  return {
    status: 'connected',
    provider: config.provider,
    dryRun: false,
    message: `Connected to ${config.provider}`
  };
}
