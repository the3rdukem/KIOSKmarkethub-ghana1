/**
 * Order Email Notification Service
 * 
 * Sends transactional emails for order lifecycle events.
 * Mirrors SMS notification patterns for consistency.
 * Never throws - always returns result objects.
 */

import { sendEmail } from '@/lib/email/email-service';
import { getUserById } from '@/lib/db/dal/users';
import { query } from '@/lib/db';

interface OrderEmailData {
  orderId: string;
  orderNumber: string;
  buyerId: string;
  buyerName?: string;
  buyerEmail?: string;
  orderTotal: string;
  items?: Array<{
    productName: string;
    quantity: number;
    price: number;
    vendorId: string;
    vendorName: string;
  }>;
  trackingNumber?: string;
  status?: string;
  shippingAddress?: {
    fullName?: string;
    phone?: string;
    address?: string;
    city?: string;
    region?: string;
  };
}

interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

async function getSiteSettings(): Promise<{ siteName: string; supportEmail: string; siteUrl: string }> {
  try {
    const result = await query<{ settings: string }>(
      `SELECT settings FROM site_settings LIMIT 1`
    );
    if (result.rows.length > 0) {
      const settings = JSON.parse(result.rows[0].settings);
      return {
        siteName: settings.siteName || 'KIOSK',
        supportEmail: settings.supportEmail || 'support@kiosk.com',
        siteUrl: settings.siteUrl || process.env.NEXT_PUBLIC_APP_URL || 'https://kiosk.com',
      };
    }
  } catch (error) {
    console.error('[ORDER_EMAILS] Failed to get site settings:', error);
  }
  return {
    siteName: 'KIOSK',
    supportEmail: 'support@kiosk.com',
    siteUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://kiosk.com',
  };
}

/**
 * Send order confirmation email to buyer
 */
export async function sendOrderConfirmationEmail(data: OrderEmailData): Promise<EmailResult> {
  try {
    const buyer = await getUserById(data.buyerId);
    const email = data.buyerEmail || buyer?.email;
    
    if (!email) {
      console.log('[ORDER_EMAILS] No buyer email for order confirmation:', data.orderId);
      return { success: true, messageId: 'no_email' };
    }

    const siteSettings = await getSiteSettings();
    const userName = data.buyerName || buyer?.business_name || buyer?.email?.split('@')[0] || 'Customer';

    const result = await sendEmail({
      to: email,
      templateId: 'order_confirmation',
      templateData: {
        userName,
        orderNumber: data.orderNumber,
        orderTotal: data.orderTotal,
        siteName: siteSettings.siteName,
        siteUrl: siteSettings.siteUrl,
      },
    });

    if (result.success) {
      console.log('[ORDER_EMAILS] Order confirmation sent:', { orderId: data.orderId, email });
    }

    return result;
  } catch (error) {
    console.error('[ORDER_EMAILS] Error sending order confirmation:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Send payment received email to buyer
 */
export async function sendPaymentReceivedEmail(data: OrderEmailData): Promise<EmailResult> {
  try {
    const buyer = await getUserById(data.buyerId);
    const email = data.buyerEmail || buyer?.email;
    
    if (!email) {
      console.log('[ORDER_EMAILS] No buyer email for payment received:', data.orderId);
      return { success: true, messageId: 'no_email' };
    }

    const siteSettings = await getSiteSettings();
    const userName = data.buyerName || buyer?.business_name || buyer?.email?.split('@')[0] || 'Customer';

    const result = await sendEmail({
      to: email,
      templateId: 'payment_received',
      templateData: {
        userName,
        orderNumber: data.orderNumber,
        orderTotal: data.orderTotal,
        siteName: siteSettings.siteName,
      },
    });

    if (result.success) {
      console.log('[ORDER_EMAILS] Payment received email sent:', { orderId: data.orderId, email });
    }

    return result;
  } catch (error) {
    console.error('[ORDER_EMAILS] Error sending payment received email:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Send order shipped email to buyer
 */
export async function sendOrderShippedEmail(data: OrderEmailData): Promise<EmailResult> {
  try {
    const buyer = await getUserById(data.buyerId);
    const email = data.buyerEmail || buyer?.email;
    
    if (!email) {
      console.log('[ORDER_EMAILS] No buyer email for order shipped:', data.orderId);
      return { success: true, messageId: 'no_email' };
    }

    const siteSettings = await getSiteSettings();
    const userName = data.buyerName || buyer?.business_name || buyer?.email?.split('@')[0] || 'Customer';

    const result = await sendEmail({
      to: email,
      templateId: 'order_shipped',
      templateData: {
        userName,
        orderNumber: data.orderNumber,
        trackingNumber: data.trackingNumber || 'N/A',
        siteName: siteSettings.siteName,
      },
    });

    if (result.success) {
      console.log('[ORDER_EMAILS] Order shipped email sent:', { orderId: data.orderId, email });
    }

    return result;
  } catch (error) {
    console.error('[ORDER_EMAILS] Error sending order shipped email:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Send order delivered email to buyer
 */
export async function sendOrderDeliveredEmail(data: OrderEmailData): Promise<EmailResult> {
  try {
    const buyer = await getUserById(data.buyerId);
    const email = data.buyerEmail || buyer?.email;
    
    if (!email) {
      console.log('[ORDER_EMAILS] No buyer email for order delivered:', data.orderId);
      return { success: true, messageId: 'no_email' };
    }

    const siteSettings = await getSiteSettings();
    const userName = data.buyerName || buyer?.business_name || buyer?.email?.split('@')[0] || 'Customer';

    const result = await sendEmail({
      to: email,
      templateId: 'order_delivered',
      templateData: {
        userName,
        orderNumber: data.orderNumber,
        orderTotal: data.orderTotal,
        siteName: siteSettings.siteName,
        siteUrl: siteSettings.siteUrl,
      },
    });

    if (result.success) {
      console.log('[ORDER_EMAILS] Order delivered email sent:', { orderId: data.orderId, email });
    }

    return result;
  } catch (error) {
    console.error('[ORDER_EMAILS] Error sending order delivered email:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Send order cancelled email to buyer
 */
export async function sendOrderCancelledEmail(data: OrderEmailData & { reason?: string }): Promise<EmailResult> {
  try {
    const buyer = await getUserById(data.buyerId);
    const email = data.buyerEmail || buyer?.email;
    
    if (!email) {
      console.log('[ORDER_EMAILS] No buyer email for order cancelled:', data.orderId);
      return { success: true, messageId: 'no_email' };
    }

    const siteSettings = await getSiteSettings();
    const userName = data.buyerName || buyer?.business_name || buyer?.email?.split('@')[0] || 'Customer';

    const result = await sendEmail({
      to: email,
      templateId: 'order_cancelled',
      templateData: {
        userName,
        orderNumber: data.orderNumber,
        orderTotal: data.orderTotal,
        reason: data.reason || 'No reason provided',
        siteName: siteSettings.siteName,
        supportEmail: siteSettings.supportEmail,
      },
    });

    if (result.success) {
      console.log('[ORDER_EMAILS] Order cancelled email sent:', { orderId: data.orderId, email });
    }

    return result;
  } catch (error) {
    console.error('[ORDER_EMAILS] Error sending order cancelled email:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Send new order notification email to vendor
 */
export async function sendVendorNewOrderEmail(
  vendorId: string,
  data: {
    orderId: string;
    orderNumber: string;
    buyerName: string;
    items: Array<{ productName: string; quantity: number; unitPrice: number }>;
    itemsTotal: string;
  }
): Promise<EmailResult> {
  try {
    const vendor = await getUserById(vendorId);
    
    if (!vendor?.email) {
      console.log('[ORDER_EMAILS] No vendor email:', vendorId);
      return { success: true, messageId: 'no_email' };
    }

    const siteSettings = await getSiteSettings();
    const vendorName = vendor.business_name || vendor.email.split('@')[0];

    const itemsList = data.items
      .map(item => `- ${item.productName} x${item.quantity} @ GHS ${item.unitPrice.toFixed(2)}`)
      .join('\n');

    const result = await sendEmail({
      to: vendor.email,
      templateId: 'vendor_new_order',
      templateData: {
        vendorName,
        orderNumber: data.orderNumber,
        buyerName: data.buyerName,
        itemsList,
        itemsTotal: data.itemsTotal,
        itemCount: data.items.length,
        siteName: siteSettings.siteName,
        siteUrl: siteSettings.siteUrl,
      },
    });

    if (result.success) {
      console.log('[ORDER_EMAILS] Vendor new order email sent:', { vendorId, orderId: data.orderId });
    }

    return result;
  } catch (error) {
    console.error('[ORDER_EMAILS] Error sending vendor new order email:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Send generic order status update email to buyer
 */
export async function sendOrderStatusUpdateEmail(
  data: OrderEmailData & { newStatus: string; statusMessage?: string }
): Promise<EmailResult> {
  try {
    const buyer = await getUserById(data.buyerId);
    const email = data.buyerEmail || buyer?.email;
    
    if (!email) {
      console.log('[ORDER_EMAILS] No buyer email for status update:', data.orderId);
      return { success: true, messageId: 'no_email' };
    }

    const siteSettings = await getSiteSettings();
    const userName = data.buyerName || buyer?.business_name || buyer?.email?.split('@')[0] || 'Customer';

    const statusDisplay = formatOrderStatus(data.newStatus);
    const statusMessage = data.statusMessage || getDefaultStatusMessage(data.newStatus);

    const result = await sendEmail({
      to: email,
      templateId: 'order_status_update',
      templateData: {
        userName,
        orderNumber: data.orderNumber,
        newStatus: statusDisplay,
        statusMessage,
        siteName: siteSettings.siteName,
        siteUrl: siteSettings.siteUrl,
      },
    });

    if (result.success) {
      console.log('[ORDER_EMAILS] Order status update email sent:', { orderId: data.orderId, status: data.newStatus });
    }

    return result;
  } catch (error) {
    console.error('[ORDER_EMAILS] Error sending order status update email:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

function formatOrderStatus(status: string): string {
  const statusMap: Record<string, string> = {
    pending_payment: 'Pending Payment',
    paid: 'Paid',
    processing: 'Processing',
    packed: 'Packed',
    shipped: 'Shipped',
    handed_to_courier: 'Handed to Courier',
    in_transit: 'In Transit',
    delivered: 'Delivered',
    completed: 'Completed',
    cancelled: 'Cancelled',
    refunded: 'Refunded',
  };
  return statusMap[status] || status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function getDefaultStatusMessage(status: string): string {
  const messages: Record<string, string> = {
    processing: 'Your order is being prepared by the vendor.',
    packed: 'Your order has been packed and is ready for shipping.',
    shipped: 'Your order is on its way!',
    handed_to_courier: 'Your order has been picked up by the courier.',
    in_transit: 'Your order is in transit and will arrive soon.',
    delivered: 'Your order has been delivered. Thank you for shopping with us!',
    completed: 'Your order has been completed successfully.',
    refunded: 'Your order has been refunded. Please check your payment method for the refund.',
  };
  return messages[status] || 'Your order status has been updated.';
}
