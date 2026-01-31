/**
 * Admin Analytics Data Access Layer
 * 
 * Provides aggregated metrics for the admin dashboard:
 * - Revenue metrics (total, orders, AOV, trends)
 * - User metrics (counts by role, registrations)
 * - Product metrics (counts by status)
 * - Vendor metrics (verified vs pending, top performers)
 * - Order metrics (by status, fulfillment rates)
 * - Financial metrics (commissions, payouts)
 */

import { query } from '../index';

export type DateRange = '7d' | '30d' | '90d' | '1y' | 'all';
export type TimeBucket = 'day' | 'week' | 'month';

interface TrendDataPoint {
  date: string;
  value: number;
  count?: number;
}

export interface RevenueMetrics {
  totalRevenue: number;
  orderCount: number;
  avgOrderValue: number;
  paidOrderCount: number;
  refundedAmount: number;
  trends: TrendDataPoint[];
}

export interface UserMetrics {
  totalUsers: number;
  buyers: number;
  vendors: number;
  admins: number;
  newUsersThisPeriod: number;
  registrationTrends: TrendDataPoint[];
}

export interface ProductMetrics {
  total: number;
  active: number;
  draft: number;
  pendingApproval: number;
  rejected: number;
  archived: number;
  suspended: number;
  outOfStock: number;
}

export interface VendorMetrics {
  total: number;
  verified: number;
  pending: number;
  underReview: number;
  rejected: number;
  suspended: number;
  topPerformers: Array<{
    vendorId: string;
    businessName: string;
    totalSales: number;
    orderCount: number;
  }>;
}

export interface OrderMetrics {
  total: number;
  byStatus: Record<string, number>;
  byPaymentStatus: Record<string, number>;
  fulfillmentRate: number;
  avgDeliveryTimeHours: number | null;
  cancelledCount: number;
  disputedCount: number;
}

export interface FinancialMetrics {
  totalCommissions: number;
  pendingPayouts: number;
  processedPayouts: number;
  failedPayouts: number;
  payoutTrends: TrendDataPoint[];
}

export interface AdminAnalytics {
  revenue: RevenueMetrics;
  users: UserMetrics;
  products: ProductMetrics;
  vendors: VendorMetrics;
  orders: OrderMetrics;
  financials: FinancialMetrics;
  generatedAt: string;
}

function getDateRangeFilter(range: DateRange): string {
  switch (range) {
    case '7d':
      return `created_at >= NOW() - INTERVAL '7 days'`;
    case '30d':
      return `created_at >= NOW() - INTERVAL '30 days'`;
    case '90d':
      return `created_at >= NOW() - INTERVAL '90 days'`;
    case '1y':
      return `created_at >= NOW() - INTERVAL '1 year'`;
    case 'all':
    default:
      return '1=1';
  }
}

function getDateTruncFormat(bucket: TimeBucket): string {
  switch (bucket) {
    case 'day':
      return 'day';
    case 'week':
      return 'week';
    case 'month':
      return 'month';
    default:
      return 'day';
  }
}

export async function getRevenueMetrics(
  range: DateRange = '30d',
  bucket: TimeBucket = 'day'
): Promise<RevenueMetrics> {
  const dateFilter = getDateRangeFilter(range);
  const truncFormat = getDateTruncFormat(bucket);

  const summaryResult = await query<{
    total_revenue: string;
    order_count: string;
    paid_count: string;
    refunded_amount: string;
  }>(
    `SELECT 
      COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN total ELSE 0 END), 0) as total_revenue,
      COUNT(*) as order_count,
      COUNT(CASE WHEN payment_status = 'paid' THEN 1 END) as paid_count,
      COALESCE(SUM(CASE WHEN payment_status = 'refunded' THEN total ELSE 0 END), 0) as refunded_amount
    FROM orders WHERE ${dateFilter}`
  );

  const trendsResult = await query<{
    bucket_date: string;
    revenue: string;
    order_count: string;
  }>(
    `SELECT 
      DATE_TRUNC('${truncFormat}', created_at::timestamp) as bucket_date,
      COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN total ELSE 0 END), 0) as revenue,
      COUNT(CASE WHEN payment_status = 'paid' THEN 1 END) as order_count
    FROM orders 
    WHERE ${dateFilter}
    GROUP BY DATE_TRUNC('${truncFormat}', created_at::timestamp)
    ORDER BY bucket_date ASC`
  );

  const summary = summaryResult.rows[0];
  const totalRevenue = parseFloat(summary?.total_revenue || '0');
  const orderCount = parseInt(summary?.order_count || '0');
  const paidOrderCount = parseInt(summary?.paid_count || '0');

  return {
    totalRevenue,
    orderCount,
    avgOrderValue: paidOrderCount > 0 ? totalRevenue / paidOrderCount : 0,
    paidOrderCount,
    refundedAmount: parseFloat(summary?.refunded_amount || '0'),
    trends: trendsResult.rows.map(row => ({
      date: row.bucket_date,
      value: parseFloat(row.revenue),
      count: parseInt(row.order_count),
    })),
  };
}

export async function getUserMetrics(
  range: DateRange = '30d',
  bucket: TimeBucket = 'day'
): Promise<UserMetrics> {
  const dateFilter = getDateRangeFilter(range);
  const truncFormat = getDateTruncFormat(bucket);

  const countResult = await query<{
    role: string;
    count: string;
  }>(
    `SELECT role, COUNT(*) as count FROM users WHERE is_deleted = 0 GROUP BY role`
  );

  const newUsersResult = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM users WHERE is_deleted = 0 AND ${dateFilter}`
  );

  const trendsResult = await query<{
    bucket_date: string;
    count: string;
  }>(
    `SELECT 
      DATE_TRUNC('${truncFormat}', created_at::timestamp) as bucket_date,
      COUNT(*) as count
    FROM users 
    WHERE is_deleted = 0 AND ${dateFilter}
    GROUP BY DATE_TRUNC('${truncFormat}', created_at::timestamp)
    ORDER BY bucket_date ASC`
  );

  const roleCounts: Record<string, number> = {};
  let total = 0;
  for (const row of countResult.rows) {
    const count = parseInt(row.count);
    roleCounts[row.role] = count;
    total += count;
  }

  const adminCountResult = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM admin_users WHERE is_active = true`
  );

  return {
    totalUsers: total,
    buyers: roleCounts['buyer'] || 0,
    vendors: roleCounts['vendor'] || 0,
    admins: parseInt(adminCountResult.rows[0]?.count || '0'),
    newUsersThisPeriod: parseInt(newUsersResult.rows[0]?.count || '0'),
    registrationTrends: trendsResult.rows.map(row => ({
      date: row.bucket_date,
      value: parseInt(row.count),
    })),
  };
}

export async function getProductMetrics(): Promise<ProductMetrics> {
  const result = await query<{ status: string; count: string }>(
    `SELECT status, COUNT(*) as count FROM products GROUP BY status`
  );

  const outOfStockResult = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM products WHERE stock_quantity = 0 AND status = 'active'`
  );

  const statusCounts: Record<string, number> = {};
  let total = 0;
  for (const row of result.rows) {
    const count = parseInt(row.count);
    statusCounts[row.status] = count;
    total += count;
  }

  return {
    total,
    active: statusCounts['active'] || 0,
    draft: statusCounts['draft'] || 0,
    pendingApproval: statusCounts['pending_approval'] || 0,
    rejected: statusCounts['rejected'] || 0,
    archived: statusCounts['archived'] || 0,
    suspended: statusCounts['suspended'] || 0,
    outOfStock: parseInt(outOfStockResult.rows[0]?.count || '0'),
  };
}

export async function getVendorMetrics(): Promise<VendorMetrics> {
  const statusResult = await query<{ verification_status: string; count: string }>(
    `SELECT verification_status, COUNT(*) as count 
     FROM users 
     WHERE role = 'vendor' AND is_deleted = 0 
     GROUP BY verification_status`
  );

  const statusCounts: Record<string, number> = {};
  let total = 0;
  for (const row of statusResult.rows) {
    const count = parseInt(row.count);
    statusCounts[row.verification_status || 'pending'] = count;
    total += count;
  }

  const topPerformersResult = await query<{
    vendor_id: string;
    business_name: string;
    total_sales: string;
    order_count: string;
  }>(
    `SELECT 
      oi.vendor_id,
      u.business_name,
      COALESCE(SUM(oi.final_price * oi.quantity), 0) as total_sales,
      COUNT(DISTINCT oi.order_id) as order_count
    FROM order_items oi
    JOIN users u ON oi.vendor_id = u.id
    JOIN orders o ON oi.order_id = o.id
    WHERE o.payment_status = 'paid'
    GROUP BY oi.vendor_id, u.business_name
    ORDER BY total_sales DESC
    LIMIT 5`
  );

  return {
    total,
    verified: statusCounts['verified'] || 0,
    pending: statusCounts['pending'] || 0,
    underReview: statusCounts['under_review'] || 0,
    rejected: statusCounts['rejected'] || 0,
    suspended: statusCounts['suspended'] || 0,
    topPerformers: topPerformersResult.rows.map(row => ({
      vendorId: row.vendor_id,
      businessName: row.business_name || 'Unknown',
      totalSales: parseFloat(row.total_sales),
      orderCount: parseInt(row.order_count),
    })),
  };
}

export async function getOrderMetrics(range: DateRange = '30d'): Promise<OrderMetrics> {
  const dateFilter = getDateRangeFilter(range);

  const statusResult = await query<{ status: string; count: string }>(
    `SELECT status, COUNT(*) as count FROM orders WHERE ${dateFilter} GROUP BY status`
  );

  const paymentStatusResult = await query<{ payment_status: string; count: string }>(
    `SELECT payment_status, COUNT(*) as count FROM orders WHERE ${dateFilter} GROUP BY payment_status`
  );

  const totalResult = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM orders WHERE ${dateFilter}`
  );

  const deliveredResult = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM orders 
     WHERE ${dateFilter} AND status IN ('delivered', 'completed')`
  );

  const avgDeliveryResult = await query<{ avg_hours: string }>(
    `SELECT AVG(EXTRACT(EPOCH FROM (updated_at::timestamp - created_at::timestamp))/3600) as avg_hours 
     FROM orders 
     WHERE ${dateFilter} AND status IN ('delivered', 'completed')`
  );

  const byStatus: Record<string, number> = {};
  for (const row of statusResult.rows) {
    byStatus[row.status] = parseInt(row.count);
  }

  const byPaymentStatus: Record<string, number> = {};
  for (const row of paymentStatusResult.rows) {
    byPaymentStatus[row.payment_status] = parseInt(row.count);
  }

  const totalOrders = parseInt(totalResult.rows[0]?.count || '0');
  const deliveredOrders = parseInt(deliveredResult.rows[0]?.count || '0');
  const paidOrders = byPaymentStatus['paid'] || 0;

  return {
    total: totalOrders,
    byStatus,
    byPaymentStatus,
    fulfillmentRate: paidOrders > 0 ? (deliveredOrders / paidOrders) * 100 : 0,
    avgDeliveryTimeHours: avgDeliveryResult.rows[0]?.avg_hours
      ? parseFloat(avgDeliveryResult.rows[0].avg_hours)
      : null,
    cancelledCount: byStatus['cancelled'] || 0,
    disputedCount: byStatus['disputed'] || 0,
  };
}

export async function getFinancialMetrics(
  range: DateRange = '30d',
  bucket: TimeBucket = 'day'
): Promise<FinancialMetrics> {
  const dateFilter = getDateRangeFilter(range);
  const truncFormat = getDateTruncFormat(bucket);

  const commissionResult = await query<{ total: string }>(
    `SELECT COALESCE(SUM(commission_amount), 0) as total 
     FROM order_items oi
     JOIN orders o ON oi.order_id = o.id
     WHERE o.payment_status = 'paid' AND o.${dateFilter.replace('created_at', 'o.created_at')}`
  );

  const payoutsResult = await query<{ status: string; total: string }>(
    `SELECT status, COALESCE(SUM(amount), 0) as total 
     FROM vendor_payouts 
     WHERE ${dateFilter}
     GROUP BY status`
  );

  const payoutTrendsResult = await query<{
    bucket_date: string;
    amount: string;
  }>(
    `SELECT 
      DATE_TRUNC('${truncFormat}', created_at::timestamp) as bucket_date,
      COALESCE(SUM(CASE WHEN status = 'success' THEN amount ELSE 0 END), 0) as amount
    FROM vendor_payouts 
    WHERE ${dateFilter}
    GROUP BY DATE_TRUNC('${truncFormat}', created_at::timestamp)
    ORDER BY bucket_date ASC`
  );

  const payoutsByStatus: Record<string, number> = {};
  for (const row of payoutsResult.rows) {
    payoutsByStatus[row.status] = parseFloat(row.total);
  }

  return {
    totalCommissions: parseFloat(commissionResult.rows[0]?.total || '0'),
    pendingPayouts: (payoutsByStatus['pending'] || 0) + (payoutsByStatus['processing'] || 0),
    processedPayouts: payoutsByStatus['success'] || 0,
    failedPayouts: payoutsByStatus['failed'] || 0,
    payoutTrends: payoutTrendsResult.rows.map(row => ({
      date: row.bucket_date,
      value: parseFloat(row.amount),
    })),
  };
}

export async function getAdminAnalytics(
  range: DateRange = '30d',
  bucket: TimeBucket = 'day'
): Promise<AdminAnalytics> {
  const [revenue, users, products, vendors, orders, financials] = await Promise.all([
    getRevenueMetrics(range, bucket),
    getUserMetrics(range, bucket),
    getProductMetrics(),
    getVendorMetrics(),
    getOrderMetrics(range),
    getFinancialMetrics(range, bucket),
  ]);

  return {
    revenue,
    users,
    products,
    vendors,
    orders,
    financials,
    generatedAt: new Date().toISOString(),
  };
}
