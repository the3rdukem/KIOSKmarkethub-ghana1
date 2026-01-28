/**
 * Arkesel SMS Notifications Service
 *
 * Sends transactional SMS notifications for order events, welcome messages, etc.
 * Reuses the Arkesel OTP integration credentials.
 *
 * PRODUCTION-READY: Uses the same credential management as OTP service.
 * Demo mode logs to console instead of sending real SMS.
 */

import { useIntegrationsStore } from '../integrations-store';
import { executeAPI, isIntegrationReady } from '../api-execution-layer';
import * as smsDal from '../db/dal/sms';
import type { SMSEventType, SMSStatus } from '../db/dal/sms';

const INTEGRATION_ID = 'arkesel_otp';
const ARKESEL_API_BASE = 'https://sms.arkesel.com/api/v2';

export interface SMSSendRequest {
  phone: string;
  eventType: SMSEventType;
  variables?: Record<string, string>;
  recipientName?: string;
  recipientId?: string;
  recipientRole?: 'buyer' | 'vendor' | 'admin';
  orderId?: string;
}

export interface SMSSendResponse {
  success: boolean;
  message: string;
  logId?: string;
  isDemoMode?: boolean;
  disabled?: boolean;
}

/**
 * Get Arkesel configuration from integrations store
 */
function getArkeselConfig(): {
  apiKey: string;
  senderId: string;
  isDemoMode: boolean;
} | null {
  const store = useIntegrationsStore.getState();
  const integration = store.getIntegration(INTEGRATION_ID);

  if (!integration?.isEnabled || !integration?.isConfigured || integration?.status !== 'connected') {
    return null;
  }

  const apiKey = store.getCredentialValue(INTEGRATION_ID, 'ARKESEL_API_KEY');
  const senderId = store.getCredentialValue(INTEGRATION_ID, 'ARKESEL_SENDER_ID');

  if (!apiKey || !senderId) {
    return null;
  }

  return {
    apiKey,
    senderId,
    isDemoMode: integration.environment === 'demo',
  };
}

/**
 * Format phone number to E.164 format for Ghana
 */
function formatPhoneNumber(phone: string): string {
  let cleaned = phone.replace(/\s/g, '').replace(/-/g, '');

  if (cleaned.startsWith('0')) {
    cleaned = '233' + cleaned.substring(1);
  }

  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }

  if (!cleaned.startsWith('233')) {
    cleaned = '233' + cleaned;
  }

  return cleaned;
}

/**
 * Validate phone number format
 */
function validatePhoneNumber(phone: string): { valid: boolean; error?: string } {
  const formatted = formatPhoneNumber(phone);

  if (!formatted.match(/^233[0-9]{9}$/)) {
    return {
      valid: false,
      error: 'Invalid phone number format. Use format: 0XX XXX XXXX',
    };
  }

  return { valid: true };
}

/**
 * Check if SMS notifications are enabled
 */
export async function isSMSEnabled(): Promise<boolean> {
  const isIntegrationConfigured = isIntegrationReady(INTEGRATION_ID);
  if (!isIntegrationConfigured) return false;

  const isFeatureEnabled = await smsDal.isSMSNotificationsEnabled();
  return isFeatureEnabled;
}

/**
 * Get SMS service status
 */
export async function getSMSServiceStatus(): Promise<{
  enabled: boolean;
  integrationConfigured: boolean;
  featureEnabled: boolean;
  mode: 'live' | 'demo' | 'disabled';
}> {
  const integrationConfigured = isIntegrationReady(INTEGRATION_ID);
  const featureEnabled = await smsDal.isSMSNotificationsEnabled();
  const config = getArkeselConfig();

  let mode: 'live' | 'demo' | 'disabled' = 'disabled';
  if (integrationConfigured && featureEnabled) {
    mode = config?.isDemoMode ? 'demo' : 'live';
  }

  return {
    enabled: integrationConfigured && featureEnabled,
    integrationConfigured,
    featureEnabled,
    mode,
  };
}

/**
 * Send SMS notification
 */
export async function sendSMS(request: SMSSendRequest): Promise<SMSSendResponse> {
  const isEnabled = await isSMSEnabled();
  
  if (!isEnabled) {
    console.log('[SMS] Notifications disabled, skipping:', request.eventType);
    return {
      success: false,
      message: 'SMS notifications are disabled',
      disabled: true,
    };
  }

  const config = getArkeselConfig();
  if (!config) {
    console.log('[SMS] Arkesel not configured');
    return {
      success: false,
      message: 'SMS service not configured',
      disabled: true,
    };
  }

  const validation = validatePhoneNumber(request.phone);
  if (!validation.valid) {
    console.log('[SMS] Invalid phone number:', request.phone);
    return {
      success: false,
      message: validation.error || 'Invalid phone number',
    };
  }

  const template = await smsDal.getTemplateByEventType(request.eventType);
  if (!template) {
    console.log('[SMS] No active template for event:', request.eventType);
    return {
      success: false,
      message: `No active SMS template for event: ${request.eventType}`,
    };
  }

  const messageContent = smsDal.compileTemplate(template.messageTemplate, request.variables || {});
  const formattedPhone = formatPhoneNumber(request.phone);

  const log = await smsDal.createSMSLog({
    recipientPhone: formattedPhone,
    recipientName: request.recipientName,
    recipientId: request.recipientId,
    recipientRole: request.recipientRole,
    eventType: request.eventType,
    templateId: template.id,
    messageContent,
    status: 'pending',
    orderId: request.orderId,
  });

  if (config.isDemoMode) {
    console.log(`[SMS DEMO] To: ${formattedPhone}`);
    console.log(`[SMS DEMO] Message: ${messageContent}`);

    await smsDal.updateSMSLogStatus(log.id, 'sent', {
      providerResponse: 'Demo mode - message logged',
      sentAt: new Date().toISOString(),
    });

    return {
      success: true,
      message: 'SMS sent successfully (Demo Mode)',
      logId: log.id,
      isDemoMode: true,
    };
  }

  try {
    const result = await executeAPI<{
      code: string;
      message: string;
      balance?: number;
    }>(
      INTEGRATION_ID,
      'send_sms',
      async () => {
        const response = await fetch(`${ARKESEL_API_BASE}/sms/send`, {
          method: 'POST',
          headers: {
            'api-key': config.apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sender: config.senderId,
            message: messageContent,
            recipients: [formattedPhone],
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || `SMS sending failed: ${response.status}`);
        }

        return response.json();
      },
      { timeout: 30000, maxRetries: 2 }
    );

    if (!result.success) {
      await smsDal.updateSMSLogStatus(log.id, 'failed', {
        errorMessage: result.error?.message || 'Unknown error',
      });

      return {
        success: false,
        message: result.error?.message || 'Failed to send SMS',
        logId: log.id,
      };
    }

    await smsDal.updateSMSLogStatus(log.id, 'sent', {
      providerResponse: JSON.stringify(result.data),
      sentAt: new Date().toISOString(),
    });

    return {
      success: true,
      message: 'SMS sent successfully',
      logId: log.id,
      isDemoMode: false,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    await smsDal.updateSMSLogStatus(log.id, 'failed', {
      errorMessage,
    });

    console.error('[SMS] Send error:', errorMessage);

    return {
      success: false,
      message: errorMessage,
      logId: log.id,
    };
  }
}

/**
 * Send order confirmation SMS to buyer
 */
export async function sendOrderConfirmationSMS(
  buyerPhone: string,
  buyerName: string,
  buyerId: string,
  orderId: string,
  totalAmount: number
): Promise<SMSSendResponse> {
  return sendSMS({
    phone: buyerPhone,
    eventType: 'order_confirmed',
    variables: {
      buyer_name: buyerName,
      order_id: orderId.substring(0, 8).toUpperCase(),
      total: totalAmount.toFixed(2),
    },
    recipientName: buyerName,
    recipientId: buyerId,
    recipientRole: 'buyer',
    orderId,
  });
}

/**
 * Send order status update SMS to buyer
 */
export async function sendOrderStatusSMS(
  buyerPhone: string,
  buyerName: string,
  buyerId: string,
  orderId: string,
  status: 'preparing' | 'ready_for_pickup' | 'out_for_delivery' | 'delivered' | 'cancelled'
): Promise<SMSSendResponse> {
  const eventTypeMap: Record<string, SMSEventType> = {
    preparing: 'order_preparing',
    ready_for_pickup: 'order_ready_for_pickup',
    out_for_delivery: 'order_out_for_delivery',
    delivered: 'order_delivered',
    cancelled: 'order_cancelled',
  };

  const eventType = eventTypeMap[status];
  if (!eventType) {
    return {
      success: false,
      message: `Unknown order status: ${status}`,
    };
  }

  return sendSMS({
    phone: buyerPhone,
    eventType,
    variables: {
      order_id: orderId.substring(0, 8).toUpperCase(),
      buyer_name: buyerName,
    },
    recipientName: buyerName,
    recipientId: buyerId,
    recipientRole: 'buyer',
    orderId,
  });
}

/**
 * Send new order notification to vendor
 */
export async function sendVendorNewOrderSMS(
  vendorPhone: string,
  vendorName: string,
  vendorId: string,
  orderId: string,
  amount: number
): Promise<SMSSendResponse> {
  return sendSMS({
    phone: vendorPhone,
    eventType: 'vendor_new_order',
    variables: {
      order_id: orderId.substring(0, 8).toUpperCase(),
      amount: amount.toFixed(2),
    },
    recipientName: vendorName,
    recipientId: vendorId,
    recipientRole: 'vendor',
    orderId,
  });
}

/**
 * Send dispute notification
 */
export async function sendDisputeOpenedSMS(
  phone: string,
  name: string,
  userId: string,
  role: 'buyer' | 'vendor',
  orderId: string
): Promise<SMSSendResponse> {
  return sendSMS({
    phone,
    eventType: 'dispute_opened',
    variables: {
      order_id: orderId.substring(0, 8).toUpperCase(),
    },
    recipientName: name,
    recipientId: userId,
    recipientRole: role,
    orderId,
  });
}

/**
 * Send welcome SMS to new buyer
 */
export async function sendWelcomeBuyerSMS(
  phone: string,
  name: string,
  userId: string
): Promise<SMSSendResponse> {
  return sendSMS({
    phone,
    eventType: 'welcome_buyer',
    variables: {
      name,
    },
    recipientName: name,
    recipientId: userId,
    recipientRole: 'buyer',
  });
}

/**
 * Send welcome SMS to new vendor
 */
export async function sendWelcomeVendorSMS(
  phone: string,
  businessName: string,
  vendorId: string
): Promise<SMSSendResponse> {
  return sendSMS({
    phone,
    eventType: 'welcome_vendor',
    variables: {
      business_name: businessName,
    },
    recipientName: businessName,
    recipientId: vendorId,
    recipientRole: 'vendor',
  });
}

/**
 * Bulk send SMS (for admin use)
 */
export async function sendBulkSMS(
  recipients: Array<{ phone: string; name?: string }>,
  message: string,
  eventType: SMSEventType = 'order_confirmed'
): Promise<{ success: number; failed: number; errors: string[] }> {
  const results = {
    success: 0,
    failed: 0,
    errors: [] as string[],
  };

  for (const recipient of recipients) {
    try {
      const response = await sendSMS({
        phone: recipient.phone,
        eventType,
        recipientName: recipient.name,
      });

      if (response.success) {
        results.success++;
      } else {
        results.failed++;
        results.errors.push(`${recipient.phone}: ${response.message}`);
      }
    } catch (error) {
      results.failed++;
      results.errors.push(`${recipient.phone}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return results;
}
