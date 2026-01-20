/**
 * Resend Email Provider
 * 
 * Production email provider using Resend's official SDK.
 * Only used when provider is 'resend', is_enabled is true, and dryRun is false.
 */

import { Resend } from 'resend';
import type { EmailProvider, SendEmailParams, SendEmailResult } from '../email-provider';

export class ResendEmailProvider implements EmailProvider {
  private client: Resend;
  private fromEmail: string;
  private fromName: string;

  constructor(apiKey: string, fromEmail: string, fromName?: string) {
    this.client = new Resend(apiKey);
    this.fromEmail = fromEmail;
    this.fromName = fromName || 'MarketHub';
  }

  async send(params: SendEmailParams): Promise<SendEmailResult> {
    try {
      const from = this.fromName 
        ? `${this.fromName} <${this.fromEmail}>` 
        : this.fromEmail;

      const emailOptions: {
        from: string;
        to: string;
        subject: string;
        html?: string;
        text?: string;
      } = {
        from,
        to: params.to,
        subject: params.subject,
      };

      if (params.html) {
        emailOptions.html = params.html;
      }
      if (params.text) {
        emailOptions.text = params.text;
      }

      if (!emailOptions.html && !emailOptions.text) {
        return {
          success: false,
          error: 'Email must have either html or text content',
        };
      }

      const { data, error } = await this.client.emails.send(emailOptions as Parameters<typeof this.client.emails.send>[0]);

      if (error) {
        console.error('[RESEND_PROVIDER] Send error:', error);
        return {
          success: false,
          error: error.message || 'Failed to send email via Resend',
        };
      }

      return {
        success: true,
        messageId: data?.id,
      };
    } catch (error) {
      console.error('[RESEND_PROVIDER] Exception:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown Resend error',
      };
    }
  }
}

export function createResendProvider(
  apiKey: string | undefined,
  fromEmail: string | undefined,
  fromName?: string
): EmailProvider | null {
  if (!apiKey) {
    console.error('[RESEND_PROVIDER] Missing API key');
    return null;
  }

  if (!fromEmail) {
    console.error('[RESEND_PROVIDER] Missing from email');
    return null;
  }

  return new ResendEmailProvider(apiKey, fromEmail, fromName);
}
