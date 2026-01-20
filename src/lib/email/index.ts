/**
 * Email Provider Selector
 * 
 * Returns the appropriate email provider based on admin configuration.
 * Currently always returns mock provider (no real providers implemented yet).
 */

import { getEmailProviderConfig } from '../db/dal/email';
import type { EmailProvider } from './email-provider';
import { mockProvider } from './providers/mock.provider';

export async function getEmailProvider(): Promise<EmailProvider> {
  const config = await getEmailProviderConfig();

  if (!config || config.provider === 'none' || config.dryRun) {
    return mockProvider;
  }

  return mockProvider;
}

export { type SendEmailParams, type SendEmailResult, type EmailProvider } from './email-provider';
export { sendEmail } from './email-service';
