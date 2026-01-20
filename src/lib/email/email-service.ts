/**
 * Email Service
 * 
 * Single entry point for sending emails.
 * Supports template resolution from database.
 * Respects admin kill-switch and dry-run mode.
 * Never throws - always returns a result.
 */

import { getEmailProviderConfig, getEmailTemplateByName } from '../db/dal/email';
import { getEmailProvider } from './index';
import type { SendEmailParams, SendEmailResult } from './email-provider';

function extractVariables(text: string): string[] {
  const regex = /\{\{(\w+)\}\}/g;
  const variables: string[] = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (!variables.includes(match[1])) {
      variables.push(match[1]);
    }
  }
  return variables;
}

function compileTemplate(
  template: string,
  data: Record<string, unknown>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const value = data[key];
    return value !== undefined ? String(value) : `{{${key}}}`;
  });
}

function validateVariables(
  requiredVars: string[],
  providedData: Record<string, unknown>
): { valid: boolean; missing: string[] } {
  const missing = requiredVars.filter(
    (v) => providedData[v] === undefined || providedData[v] === null
  );
  return { valid: missing.length === 0, missing };
}

interface ResolvedEmail {
  subject: string;
  html?: string;
  text?: string;
}

async function resolveTemplate(
  templateId: string,
  templateData: Record<string, unknown>,
  fallbackSubject?: string,
  fallbackHtml?: string,
  fallbackText?: string
): Promise<{ resolved: ResolvedEmail | null; error?: string }> {
  const template = await getEmailTemplateByName(templateId);

  if (!template) {
    console.error('[EMAIL_SERVICE] Template not found:', templateId);
    if (fallbackHtml || fallbackText) {
      console.log('[EMAIL_SERVICE] Using inline fallback content');
      return {
        resolved: {
          subject: fallbackSubject || 'Notification',
          html: fallbackHtml,
          text: fallbackText,
        },
      };
    }
    return { resolved: null, error: `Template '${templateId}' not found` };
  }

  if (!template.isActive) {
    console.error('[EMAIL_SERVICE] Template is inactive:', templateId);
    return { resolved: null, error: `Template '${templateId}' is inactive` };
  }

  const subjectVars = extractVariables(template.subject);
  const htmlVars = template.bodyHtml ? extractVariables(template.bodyHtml) : [];
  const textVars = template.bodyText ? extractVariables(template.bodyText) : [];

  const allRequiredVars = [...new Set([...subjectVars, ...htmlVars, ...textVars])];
  const validation = validateVariables(allRequiredVars, templateData);

  if (!validation.valid) {
    console.error('[EMAIL_SERVICE] Missing template variables:', {
      templateId,
      missing: validation.missing,
      provided: Object.keys(templateData),
    });
    return {
      resolved: null,
      error: `Missing required variables for template '${templateId}': ${validation.missing.join(', ')}`,
    };
  }

  const resolved: ResolvedEmail = {
    subject: compileTemplate(template.subject, templateData),
    html: template.bodyHtml ? compileTemplate(template.bodyHtml, templateData) : undefined,
    text: template.bodyText ? compileTemplate(template.bodyText, templateData) : undefined,
  };

  console.log('[EMAIL_SERVICE] Template resolved:', {
    templateId,
    variablesUsed: allRequiredVars.length,
  });

  return { resolved };
}

export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  try {
    const config = await getEmailProviderConfig();

    if (!config || config.provider === 'none') {
      console.log('[EMAIL_SERVICE] Email disabled - no provider configured');
      return { success: true, messageId: 'disabled' };
    }

    let finalSubject = params.subject;
    let finalHtml = params.html;
    let finalText = params.text;

    if (params.templateId) {
      const { resolved, error } = await resolveTemplate(
        params.templateId,
        params.templateData || {},
        params.subject,
        params.html,
        params.text
      );

      if (!resolved) {
        console.error('[EMAIL_SERVICE] Template resolution failed:', {
          templateId: params.templateId,
          to: params.to,
          error,
        });
        return { success: false, error };
      }

      finalSubject = resolved.subject;
      finalHtml = resolved.html;
      finalText = resolved.text;
    }

    if (!finalHtml && !finalText) {
      console.error('[EMAIL_SERVICE] No content to send:', {
        to: params.to,
        templateId: params.templateId,
      });
      return { success: false, error: 'Email has no content (html or text required)' };
    }

    if (config.dryRun) {
      console.log('[EMAIL_SERVICE] Dry-run mode - email not sent:', {
        to: params.to,
        subject: finalSubject,
        templateId: params.templateId,
        hasHtml: !!finalHtml,
        hasText: !!finalText,
      });
      return { success: true, messageId: 'dry_run' };
    }

    const provider = await getEmailProvider();
    const result = await provider.send({
      to: params.to,
      subject: finalSubject,
      html: finalHtml,
      text: finalText,
    });

    if (result.success) {
      console.log('[EMAIL_SERVICE] Email sent successfully:', {
        to: params.to,
        subject: finalSubject,
        templateId: params.templateId,
        messageId: result.messageId,
      });
    } else {
      console.error('[EMAIL_SERVICE] Email send failed:', {
        to: params.to,
        subject: finalSubject,
        templateId: params.templateId,
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
