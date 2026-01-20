/**
 * Email Service
 * 
 * Single entry point for sending emails.
 * Respects admin kill-switch and dry-run mode.
 * Never throws - always returns a result.
 */

import { getEmailProviderConfig } from '../db/dal/email';
import { getEmailProvider } from './index';
import type { SendEmailParams, SendEmailResult } from './email-provider';

export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  try {
    const config = await getEmailProviderConfig();

    if (!config || config.provider === 'none') {
      console.log('[EMAIL_SERVICE] Email disabled - no provider configured');
      return { success: true, messageId: 'disabled' };
    }

    if (config.dryRun) {
      console.log('[EMAIL_SERVICE] Dry-run mode - email not sent:', {
        to: params.to,
        subject: params.subject,
      });
      return { success: true, messageId: 'dry_run' };
    }

    const provider = await getEmailProvider();
    const result = await provider.send(params);

    if (result.success) {
      console.log('[EMAIL_SERVICE] Email sent successfully:', {
        to: params.to,
        subject: params.subject,
        messageId: result.messageId,
      });
    } else {
      console.error('[EMAIL_SERVICE] Email send failed:', {
        to: params.to,
        subject: params.subject,
        error: result.error,
      });
    }

    return result;
  } catch (error) {
    console.error('[EMAIL_SERVICE] Unexpected error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
