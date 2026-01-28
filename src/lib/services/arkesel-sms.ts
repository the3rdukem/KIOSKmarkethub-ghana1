/**
 * Arkesel SMS Notifications Service
 *
 * Sends transactional SMS notifications for order events, welcome messages, etc.
 * Uses database-backed configuration for server-side compatibility.
 *
 * PRODUCTION-READY: Credentials stored in integrations table (encrypted), accessible from webhooks and API routes.
 * Demo mode uses Arkesel's native sandbox=true parameter (no delivery, no charges).
 */

import * as smsDal from '../db/dal/sms';
import { getIntegrationById } from '../db/dal/integrations';
import type { SMSEventType, SMSStatus, ArkeselConfig } from '../db/dal/sms';

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
 * Get Arkesel configuration from integrations table (server-side compatible)
 * This reads from the encrypted credentials stored via Admin > API Management
 */
async function getArkeselConfigFromDB(): Promise<ArkeselConfig | null> {
  try {
    const integration = await getIntegrationById('arkesel_otp');
    
    if (!integration) {
      console.log('[SMS] Arkesel integration not found in database');
      return null;
    }
    
    if (!integration.isConfigured || !integration.isEnabled) {
      console.log('[SMS] Arkesel integration not configured or not enabled', {
        isConfigured: integration.isConfigured,
        isEnabled: integration.isEnabled,
      });
      return null;
    }
    
    const apiKey = integration.credentials['apiKey'];
    const senderId = integration.credentials['senderId'];
    
    if (!apiKey || !senderId) {
      console.log('[SMS] Arkesel credentials incomplete - missing apiKey or senderId');
      return null;
    }
    
    // Check if demo mode - 'demo' environment means sandbox mode
    const isDemoMode = integration.environment === 'demo';
    
    console.log('[SMS] Arkesel config loaded from integrations table', {
      hasSenderId: !!senderId,
      environment: integration.environment,
      isDemoMode,
    });
    
    return {
      apiKey,
      senderId,
      isDemoMode,
    };
  } catch (error) {
    console.error('[SMS] Error loading Arkesel config:', error);
    return null;
  }
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
 * Check if SMS notifications are enabled (database-backed, server-side compatible)
 */
export async function isSMSEnabled(): Promise<boolean> {
  const config = await getArkeselConfigFromDB();
  if (!config) return false;

  const isFeatureEnabled = await smsDal.isSMSNotificationsEnabled();
  return isFeatureEnabled;
}

/**
 * Get SMS service status (database-backed, server-side compatible)
 */
export async function getSMSServiceStatus(): Promise<{
  enabled: boolean;
  integrationConfigured: boolean;
  featureEnabled: boolean;
  mode: 'live' | 'demo' | 'disabled';
}> {
  const config = await getArkeselConfigFromDB();
  const integrationConfigured = config !== null;
  const featureEnabled = await smsDal.isSMSNotificationsEnabled();

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
 * Send SMS notification (database-backed, server-side compatible)
 */
export async function sendSMS(request: SMSSendRequest): Promise<SMSSendResponse> {
  // Check feature enabled first
  const featureEnabled = await smsDal.isSMSNotificationsEnabled();
  if (!featureEnabled) {
    console.log('[SMS] Notifications disabled in settings, skipping:', request.eventType);
    return {
      success: false,
      message: 'SMS notifications are disabled',
      disabled: true,
    };
  }

  // Get Arkesel config from integrations table
  const config = await getArkeselConfigFromDB();
  if (!config) {
    console.log('[SMS] Arkesel not configured or not enabled in integrations');
    return {
      success: false,
      message: 'SMS service not configured. Please configure Arkesel OTP in Admin > API Management and ensure it is enabled.',
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

  // Use Arkesel's built-in sandbox mode for testing (no SMS delivery, no charges)
  const useSandbox = config.isDemoMode;
  
  if (useSandbox) {
    console.log(`[SMS SANDBOX] To: ${formattedPhone}`);
    console.log(`[SMS SANDBOX] Message: ${messageContent}`);
    console.log(`[SMS SANDBOX] Using Arkesel sandbox=true (no delivery, no charges)`);
  }

  try {
    console.log(`[SMS] Sending to ${formattedPhone} via Arkesel API${useSandbox ? ' (sandbox)' : ''}`);
    
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
        sandbox: useSandbox, // Arkesel's native sandbox mode - no delivery, no charges
      }),
    });

    const responseData = await response.json().catch(() => ({}));
    
    if (!response.ok) {
      const errorMessage = responseData.message || `SMS sending failed: ${response.status}`;
      console.error('[SMS] API error:', errorMessage);
      
      await smsDal.updateSMSLogStatus(log.id, 'failed', {
        errorMessage,
        providerResponse: JSON.stringify(responseData),
      });

      return {
        success: false,
        message: errorMessage,
        logId: log.id,
      };
    }

    // Arkesel returns code: "ok" on success
    if (responseData.code !== 'ok') {
      const errorMessage = responseData.message || 'Unknown Arkesel error';
      console.error('[SMS] Arkesel error:', errorMessage);
      
      await smsDal.updateSMSLogStatus(log.id, 'failed', {
        errorMessage,
        providerResponse: JSON.stringify(responseData),
      });

      return {
        success: false,
        message: errorMessage,
        logId: log.id,
      };
    }

    console.log(`[SMS] Successfully sent to ${formattedPhone}${useSandbox ? ' (sandbox - not delivered)' : ''}`);
    
    await smsDal.updateSMSLogStatus(log.id, 'sent', {
      providerResponse: JSON.stringify(responseData),
      sentAt: new Date().toISOString(),
    });

    return {
      success: true,
      message: useSandbox ? 'SMS sent successfully (Sandbox Mode - not delivered)' : 'SMS sent successfully',
      logId: log.id,
      isDemoMode: useSandbox,
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
