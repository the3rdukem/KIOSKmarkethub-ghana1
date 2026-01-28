/**
 * Commission Data Access Layer
 * 
 * Handles commission rate management and calculation for the KIOSK marketplace.
 * 
 * Commission Priority:
 * 1. Vendor-specific rate (if set in vendors table)
 * 2. Category rate (if set in categories table)
 * 3. Site default rate (from site_settings)
 */

import { query } from '../index';

export interface CommissionRates {
  defaultRate: number;
  categoryRate: number | null;
  vendorRate: number | null;
  effectiveRate: number;
  source: 'vendor' | 'category' | 'default';
}

export interface CommissionCalculation {
  subtotal: number;
  commissionRate: number;
  commissionAmount: number;
  vendorEarnings: number;
  source: 'vendor' | 'category' | 'default';
}

/**
 * Get the default commission rate from site settings
 */
export async function getDefaultCommissionRate(): Promise<number> {
  try {
    const result = await query(
      `SELECT value FROM site_settings WHERE key = 'default_commission_rate'`
    );
    if (result.rows.length > 0) {
      const rate = parseFloat(String(result.rows[0].value || '0.08'));
      return isNaN(rate) ? 0.08 : rate;
    }
    return 0.08; // Default 8% if not set
  } catch (error) {
    console.error('[Commission] Error getting default rate:', error);
    return 0.08;
  }
}

/**
 * Set the default commission rate in site settings
 */
export async function setDefaultCommissionRate(rate: number, updatedBy?: string): Promise<boolean> {
  try {
    if (rate < 0 || rate > 1) {
      throw new Error('Commission rate must be between 0 and 1 (0% to 100%)');
    }
    
    // Round to 4 decimal places to avoid floating point precision issues
    const roundedRate = Math.round(rate * 10000) / 10000;
    
    await query(
      `INSERT INTO site_settings (key, value, updated_at, updated_by) 
       VALUES ('default_commission_rate', $1, $2, $3)
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = $2, updated_by = $3`,
      [roundedRate.toString(), new Date().toISOString(), updatedBy || null]
    );
    return true;
  } catch (error) {
    console.error('[Commission] Error setting default rate:', error);
    return false;
  }
}

/**
 * Get commission rate for a specific category
 */
export async function getCategoryCommissionRate(categoryId: string): Promise<number | null> {
  try {
    const result = await query(
      `SELECT commission_rate FROM categories WHERE id = $1`,
      [categoryId]
    );
    if (result.rows.length > 0 && result.rows[0].commission_rate !== null) {
      return parseFloat(String(result.rows[0].commission_rate));
    }
    return null;
  } catch (error) {
    console.error('[Commission] Error getting category rate:', error);
    return null;
  }
}

/**
 * Set commission rate for a specific category
 */
export async function setCategoryCommissionRate(
  categoryId: string, 
  rate: number | null
): Promise<boolean> {
  try {
    if (rate !== null && (rate < 0 || rate > 1)) {
      throw new Error('Commission rate must be between 0 and 1 (0% to 100%)');
    }
    
    // Round to 4 decimal places to avoid floating point precision issues
    const roundedRate = rate !== null ? Math.round(rate * 10000) / 10000 : null;
    
    await query(
      `UPDATE categories SET commission_rate = $1, updated_at = $2 WHERE id = $3`,
      [roundedRate, new Date().toISOString(), categoryId]
    );
    return true;
  } catch (error) {
    console.error('[Commission] Error setting category rate:', error);
    return false;
  }
}

/**
 * Get commission rate for a specific vendor
 */
export async function getVendorCommissionRate(vendorId: string): Promise<number | null> {
  try {
    const result = await query(
      `SELECT commission_rate FROM vendors WHERE user_id = $1`,
      [vendorId]
    );
    if (result.rows.length > 0 && result.rows[0].commission_rate !== null) {
      return parseFloat(String(result.rows[0].commission_rate));
    }
    return null;
  } catch (error) {
    console.error('[Commission] Error getting vendor rate:', error);
    return null;
  }
}

/**
 * Set commission rate for a specific vendor
 */
export async function setVendorCommissionRate(
  vendorId: string, 
  rate: number | null
): Promise<boolean> {
  try {
    if (rate !== null && (rate < 0 || rate > 1)) {
      throw new Error('Commission rate must be between 0 and 1 (0% to 100%)');
    }
    
    // Round to 4 decimal places to avoid floating point precision issues
    const roundedRate = rate !== null ? Math.round(rate * 10000) / 10000 : null;
    
    await query(
      `UPDATE vendors SET commission_rate = $1, updated_at = $2 WHERE user_id = $3`,
      [roundedRate, new Date().toISOString(), vendorId]
    );
    return true;
  } catch (error) {
    console.error('[Commission] Error setting vendor rate:', error);
    return false;
  }
}

/**
 * Get all applicable commission rates for a vendor/category combination
 */
export async function getCommissionRates(
  vendorId: string,
  categoryId?: string
): Promise<CommissionRates> {
  const defaultRate = await getDefaultCommissionRate();
  const vendorRate = await getVendorCommissionRate(vendorId);
  const categoryRate = categoryId ? await getCategoryCommissionRate(categoryId) : null;

  // Priority: Vendor > Category > Default
  let effectiveRate = defaultRate;
  let source: 'vendor' | 'category' | 'default' = 'default';

  if (categoryRate !== null) {
    effectiveRate = categoryRate;
    source = 'category';
  }

  if (vendorRate !== null) {
    effectiveRate = vendorRate;
    source = 'vendor';
  }

  return {
    defaultRate,
    categoryRate,
    vendorRate,
    effectiveRate,
    source
  };
}

/**
 * Calculate commission for a given subtotal and vendor/category
 */
export async function calculateCommission(
  subtotal: number,
  vendorId: string,
  categoryId?: string
): Promise<CommissionCalculation> {
  const rates = await getCommissionRates(vendorId, categoryId);
  
  const commissionAmount = Math.round(subtotal * rates.effectiveRate * 100) / 100;
  const vendorEarnings = Math.round((subtotal - commissionAmount) * 100) / 100;

  return {
    subtotal,
    commissionRate: rates.effectiveRate,
    commissionAmount,
    vendorEarnings,
    source: rates.source
  };
}

/**
 * Calculate commission for multiple items (multi-vendor order)
 */
export async function calculateOrderCommission(
  items: Array<{
    vendorId: string;
    categoryId?: string;
    subtotal: number;
  }>
): Promise<{
  items: Array<CommissionCalculation & { vendorId: string; categoryId?: string }>;
  totalSubtotal: number;
  totalCommission: number;
  totalVendorEarnings: number;
}> {
  const calculatedItems = await Promise.all(
    items.map(async (item) => {
      const calc = await calculateCommission(item.subtotal, item.vendorId, item.categoryId);
      return {
        ...calc,
        vendorId: item.vendorId,
        categoryId: item.categoryId
      };
    })
  );

  const totalSubtotal = calculatedItems.reduce((sum, item) => sum + item.subtotal, 0);
  const totalCommission = calculatedItems.reduce((sum, item) => sum + item.commissionAmount, 0);
  const totalVendorEarnings = calculatedItems.reduce((sum, item) => sum + item.vendorEarnings, 0);

  return {
    items: calculatedItems,
    totalSubtotal: Math.round(totalSubtotal * 100) / 100,
    totalCommission: Math.round(totalCommission * 100) / 100,
    totalVendorEarnings: Math.round(totalVendorEarnings * 100) / 100
  };
}

/**
 * Get all categories with their commission rates
 */
export async function getAllCategoryCommissionRates(): Promise<Array<{
  id: string;
  name: string;
  slug: string;
  commissionRate: number | null;
}>> {
  try {
    const result = await query(
      `SELECT id, name, slug, commission_rate FROM categories ORDER BY name`
    );
    return result.rows.map(row => ({
      id: String(row.id || ''),
      name: String(row.name || ''),
      slug: String(row.slug || ''),
      commissionRate: row.commission_rate !== null ? parseFloat(String(row.commission_rate)) : null
    }));
  } catch (error) {
    console.error('[Commission] Error getting all category rates:', error);
    return [];
  }
}

/**
 * Get all vendors with their commission rates
 */
export async function getAllVendorCommissionRates(): Promise<Array<{
  id: string;
  user_id: string;
  business_name: string;
  email: string;
  commission_rate: number | null;
}>> {
  try {
    const result = await query(
      `SELECT v.id, v.user_id, v.business_name, u.email, v.commission_rate 
       FROM vendors v
       LEFT JOIN users u ON v.user_id = u.id
       ORDER BY v.business_name`
    );
    return result.rows.map(row => ({
      id: String(row.id || ''),
      user_id: String(row.user_id || ''),
      business_name: String(row.business_name || ''),
      email: String(row.email || ''),
      commission_rate: row.commission_rate !== null ? parseFloat(String(row.commission_rate)) : null
    }));
  } catch (error) {
    console.error('[Commission] Error getting all vendor rates:', error);
    return [];
  }
}

/**
 * Get commission summary for admin dashboard
 */
export async function getCommissionSummary(
  startDate?: string,
  endDate?: string
): Promise<{
  totalOrders: number;
  totalRevenue: number;
  totalCommission: number;
  totalVendorEarnings: number;
  averageCommissionRate: number;
}> {
  try {
    let dateFilter = '';
    const params: (string | undefined)[] = [];
    
    if (startDate && endDate) {
      dateFilter = `WHERE o.created_at >= $1 AND o.created_at <= $2 AND o.payment_status = 'paid'`;
      params.push(startDate, endDate);
    } else {
      dateFilter = `WHERE o.payment_status = 'paid'`;
    }

    const result = await query(
      `SELECT 
        COUNT(*) as total_orders,
        COALESCE(SUM(o.subtotal), 0) as total_revenue,
        COALESCE(SUM(o.platform_commission), 0) as total_commission,
        COALESCE(SUM(o.vendor_earnings), 0) as total_vendor_earnings,
        COALESCE(AVG(o.commission_rate), 0) as avg_commission_rate
       FROM orders o
       ${dateFilter}`,
      params.filter(Boolean)
    );

    const row = result.rows[0];
    return {
      totalOrders: parseInt(String(row.total_orders || '0')) || 0,
      totalRevenue: parseFloat(String(row.total_revenue || '0')) || 0,
      totalCommission: parseFloat(String(row.total_commission || '0')) || 0,
      totalVendorEarnings: parseFloat(String(row.total_vendor_earnings || '0')) || 0,
      averageCommissionRate: parseFloat(String(row.avg_commission_rate || '0')) || 0
    };
  } catch (error) {
    console.error('[Commission] Error getting commission summary:', error);
    return {
      totalOrders: 0,
      totalRevenue: 0,
      totalCommission: 0,
      totalVendorEarnings: 0,
      averageCommissionRate: 0
    };
  }
}

/**
 * Get vendor earnings summary
 */
export async function getVendorEarningsSummary(vendorId: string): Promise<{
  totalSales: number;
  totalCommissionPaid: number;
  totalEarnings: number;
  pendingEarnings: number;
  paidEarnings: number;
}> {
  try {
    const result = await query(
      `SELECT 
        COALESCE(SUM(CASE WHEN o.payment_status = 'paid' THEN oi.price * oi.quantity ELSE 0 END), 0) as total_sales,
        COALESCE(SUM(CASE WHEN o.payment_status = 'paid' THEN oi.commission_amount ELSE 0 END), 0) as total_commission,
        COALESCE(SUM(CASE WHEN o.payment_status = 'paid' THEN oi.vendor_earnings ELSE 0 END), 0) as total_earnings
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE oi.vendor_id = $1`,
      [vendorId]
    );

    const row = result.rows[0];
    const totalSales = parseFloat(String(row.total_sales || '0')) || 0;
    const totalCommissionPaid = parseFloat(String(row.total_commission || '0')) || 0;
    const totalEarnings = parseFloat(String(row.total_earnings || '0')) || 0;

    return {
      totalSales,
      totalCommissionPaid,
      totalEarnings,
      pendingEarnings: totalEarnings, // TODO: Subtract paid payouts
      paidEarnings: 0 // TODO: Get from payouts table
    };
  } catch (error) {
    console.error('[Commission] Error getting vendor earnings:', error);
    return {
      totalSales: 0,
      totalCommissionPaid: 0,
      totalEarnings: 0,
      pendingEarnings: 0,
      paidEarnings: 0
    };
  }
}
