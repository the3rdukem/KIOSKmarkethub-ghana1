/**
 * Email Provider Contract
 * 
 * Provider-agnostic interface for email sending.
 * No implementation logic - types and interfaces only.
 */

export interface SendEmailParams {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  templateId?: string;
  templateData?: Record<string, unknown>;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface EmailProvider {
  send(params: SendEmailParams): Promise<SendEmailResult>;
}
