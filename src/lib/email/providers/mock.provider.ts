/**
 * Mock Email Provider
 * 
 * Logs email intent to console without sending.
 * Used for development, dry-run mode, and when no provider is configured.
 */

import type { EmailProvider, SendEmailParams, SendEmailResult } from '../email-provider';

export class MockEmailProvider implements EmailProvider {
  async send(params: SendEmailParams): Promise<SendEmailResult> {
    console.log('[EMAIL_MOCK] Email would be sent:', {
      to: params.to,
      subject: params.subject,
      templateId: params.templateId || '(inline content)',
      hasHtml: !!params.html,
      hasText: !!params.text,
      templateDataKeys: params.templateData ? Object.keys(params.templateData) : [],
    });

    return {
      success: true,
      messageId: `mock_${Date.now()}`,
    };
  }
}

export const mockProvider = new MockEmailProvider();
