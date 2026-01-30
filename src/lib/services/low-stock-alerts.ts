/**
 * Low Stock Alerts Service
 *
 * Checks product inventory and sends alerts to vendors when stock falls below threshold.
 * Uses existing SMS and notification infrastructure.
 */

import { createNotification } from '../db/dal/notifications';
import { sendSMS } from './arkesel-sms';
import { query } from '../db';

export interface LowStockCheckResult {
  productId: string;
  productName: string;
  vendorId: string;
  currentQuantity: number;
  threshold: number;
  alertType: 'low_stock' | 'out_of_stock';
  notificationSent: boolean;
  smsSent: boolean;
}

interface VendorSettings {
  lowStockAlerts: boolean;
  lowStockThreshold: number;
  smsNotifications: boolean;
  phone: string | null;
}

const DEFAULT_LOW_STOCK_THRESHOLD = 5;

/**
 * Get vendor notification settings
 */
async function getVendorSettings(vendorId: string): Promise<VendorSettings | null> {
  try {
    const result = await query<{
      store_settings: string | null;
      phone: string | null;
    }>(
      `SELECT store_settings, phone FROM users WHERE id = $1`,
      [vendorId]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    let settings: Record<string, unknown> = {};
    
    if (row.store_settings) {
      try {
        settings = JSON.parse(row.store_settings);
      } catch {
        settings = {};
      }
    }

    return {
      lowStockAlerts: settings.lowStockAlerts !== false,
      lowStockThreshold: typeof settings.lowStockThreshold === 'number' 
        ? settings.lowStockThreshold 
        : DEFAULT_LOW_STOCK_THRESHOLD,
      smsNotifications: settings.smsNotifications !== false,
      phone: row.phone,
    };
  } catch (error) {
    console.error('[LOW_STOCK] Error fetching vendor settings:', error);
    return null;
  }
}

/**
 * Check if alert was already sent recently (within 24 hours)
 */
async function wasAlertSentRecently(
  vendorId: string, 
  productId: string, 
  alertType: 'low_stock_alert' | 'out_of_stock_alert'
): Promise<boolean> {
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const result = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM notifications 
       WHERE user_id = $1 AND type = $2 AND created_at > $3
       AND payload::text LIKE $4`,
      [vendorId, alertType, oneDayAgo, `%"productId":"${productId}"%`]
    );

    return parseInt(result.rows[0]?.count || '0', 10) > 0;
  } catch (error) {
    console.error('[LOW_STOCK] Error checking recent alerts:', error);
    return false;
  }
}

/**
 * Send low stock alert for a single product
 */
export async function sendLowStockAlert(
  productId: string,
  productName: string,
  vendorId: string,
  currentQuantity: number,
  threshold: number
): Promise<LowStockCheckResult> {
  const alertType = currentQuantity === 0 ? 'out_of_stock' : 'low_stock';
  const notificationType = currentQuantity === 0 ? 'out_of_stock_alert' : 'low_stock_alert';
  
  const result: LowStockCheckResult = {
    productId,
    productName,
    vendorId,
    currentQuantity,
    threshold,
    alertType,
    notificationSent: false,
    smsSent: false,
  };

  const settings = await getVendorSettings(vendorId);
  
  if (!settings || !settings.lowStockAlerts) {
    console.log('[LOW_STOCK] Alerts disabled for vendor:', vendorId);
    return result;
  }

  const alreadySent = await wasAlertSentRecently(vendorId, productId, notificationType);
  if (alreadySent) {
    console.log('[LOW_STOCK] Alert already sent recently for product:', productId);
    return result;
  }

  try {
    const title = currentQuantity === 0 
      ? 'Out of Stock Alert' 
      : 'Low Stock Alert';
    
    const message = currentQuantity === 0
      ? `"${productName}" is now out of stock. Update your inventory to continue receiving orders.`
      : `"${productName}" has only ${currentQuantity} units left (threshold: ${threshold}). Consider restocking soon.`;

    await createNotification({
      userId: vendorId,
      role: 'vendor',
      type: notificationType,
      title,
      message,
      payload: {
        productId,
        productName,
        currentQuantity,
        threshold,
      },
    });
    
    result.notificationSent = true;
    console.log('[LOW_STOCK] Notification sent for product:', productId);
  } catch (error) {
    console.error('[LOW_STOCK] Failed to create notification:', error);
  }

  if (settings.smsNotifications && settings.phone) {
    try {
      const smsResult = await sendSMS({
        phone: settings.phone,
        eventType: notificationType,
        variables: {
          product_name: productName,
          quantity: String(currentQuantity),
          threshold: String(threshold),
        },
        recipientId: vendorId,
        recipientRole: 'vendor',
      });
      
      result.smsSent = smsResult.success;
      if (smsResult.success) {
        console.log('[LOW_STOCK] SMS sent for product:', productId);
      }
    } catch (error) {
      console.error('[LOW_STOCK] Failed to send SMS:', error);
    }
  }

  return result;
}

/**
 * Check a product's stock level and send alerts if needed
 */
export async function checkProductStock(
  productId: string,
  productName: string,
  vendorId: string,
  currentQuantity: number,
  trackQuantity: boolean
): Promise<LowStockCheckResult | null> {
  if (!trackQuantity) {
    return null;
  }

  const settings = await getVendorSettings(vendorId);
  const threshold = settings?.lowStockThreshold ?? DEFAULT_LOW_STOCK_THRESHOLD;

  if (currentQuantity > threshold) {
    return null;
  }

  return sendLowStockAlert(productId, productName, vendorId, currentQuantity, threshold);
}

/**
 * Check all products for a vendor and return those with low stock
 */
export async function getVendorLowStockProducts(vendorId: string): Promise<Array<{
  id: string;
  name: string;
  quantity: number;
  threshold: number;
  status: 'low_stock' | 'out_of_stock';
}>> {
  const settings = await getVendorSettings(vendorId);
  const threshold = settings?.lowStockThreshold ?? DEFAULT_LOW_STOCK_THRESHOLD;

  try {
    const result = await query<{
      id: string;
      name: string;
      quantity: number;
    }>(
      `SELECT id, name, quantity FROM products 
       WHERE vendor_id = $1 AND track_quantity = 1 AND quantity <= $2 AND status = 'active'
       ORDER BY quantity ASC`,
      [vendorId, threshold]
    );

    return result.rows.map(row => ({
      id: row.id,
      name: row.name,
      quantity: row.quantity,
      threshold,
      status: row.quantity === 0 ? 'out_of_stock' : 'low_stock',
    }));
  } catch (error) {
    console.error('[LOW_STOCK] Error fetching low stock products:', error);
    return [];
  }
}

/**
 * Batch check and alert for products that have low stock
 * Called periodically or after inventory updates
 */
export async function runLowStockCheck(vendorId?: string): Promise<LowStockCheckResult[]> {
  const results: LowStockCheckResult[] = [];

  try {
    let productsQuery = `
      SELECT p.id, p.name, p.vendor_id, p.quantity, p.track_quantity,
             u.store_settings
      FROM products p
      JOIN users u ON p.vendor_id = u.id
      WHERE p.track_quantity = 1 AND p.status = 'active'
    `;
    const params: string[] = [];

    if (vendorId) {
      productsQuery += ' AND p.vendor_id = $1';
      params.push(vendorId);
    }

    const result = await query<{
      id: string;
      name: string;
      vendor_id: string;
      quantity: number;
      track_quantity: number;
      store_settings: string | null;
    }>(productsQuery, params);

    for (const product of result.rows) {
      let settings: Record<string, unknown> = {};
      if (product.store_settings) {
        try {
          settings = JSON.parse(product.store_settings);
        } catch {
          settings = {};
        }
      }

      const threshold = typeof settings.lowStockThreshold === 'number'
        ? settings.lowStockThreshold
        : DEFAULT_LOW_STOCK_THRESHOLD;

      if (product.quantity <= threshold) {
        const alertResult = await sendLowStockAlert(
          product.id,
          product.name,
          product.vendor_id,
          product.quantity,
          threshold
        );
        results.push(alertResult);
      }
    }
  } catch (error) {
    console.error('[LOW_STOCK] Error running batch check:', error);
  }

  return results;
}
