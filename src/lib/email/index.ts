/**
 * Email Provider Selector
 * 
 * Returns the appropriate email provider based on admin configuration.
 * Falls back to mock provider when disabled, dry-run, or misconfigured.
 */

import { getEmailProviderConfig } from '../db/dal/email';
import type { EmailProvider } from './email-provider';
import { mockProvider } from './providers/mock.provider';
import { createResendProvider } from './providers/resend.provider';

export async function getEmailProvider(): Promise<EmailProvider> {
  const config = await getEmailProviderConfig();

  if (!config || config.provider === 'none' || config.dryRun) {
    return mockProvider;
  }

  if (config.provider === 'resend') {
    const resendProvider = createResendProvider(
      config.apiKey,
      config.fromEmail,
      config.fromName
    );
    
    if (resendProvider) {
      return resendProvider;
    }
    
    console.warn('[EMAIL] Resend provider misconfigured, falling back to mock');
    return mockProvider;
  }

  return mockProvider;
}

export { type SendEmailParams, type SendEmailResult, type EmailProvider } from './email-provider';
export { sendEmail } from './email-service';
