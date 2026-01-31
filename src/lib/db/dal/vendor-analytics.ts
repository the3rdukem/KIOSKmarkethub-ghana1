/**
 * Vendor Analytics Data Access Layer
 * 
 * Provides aggregated analytics for vendor dashboards:
 * - Sales trends over time
 * - Product performance metrics
 * - Order analytics with date filtering
 * - Revenue breakdowns
 * - Review analytics
 */

import { query } from '../index';

export type DateRange = '7d' | '30d' | '90d' | '1y' | 'all';
export type TimeBucket = 'day' | 'week' | 'month';

interface TrendDataPoint {
  date: string;
  value: number;
  count?: number;
}

export interface SalesTrend {
  date: string;
  revenue: number;
  orders: number;
  itemsSold: number;
}

export interface ProductPerformance {
  productId: string;
  productName: string;
  totalSold: number;
  totalRevenue: number;
  orderCount: number;
  avgRating: number | null;
  reviewCount: number;
}

export interface VendorSalesMetrics {
  totalRevenue: number;
  totalOrders: number;
  totalItemsSold: number;
  avgOrderValue: number;
  grossSales: number;
  totalCommission: number;
  netEarnings: number;
  refundedAmount: number;
  salesTrends: SalesTrend[];
}

export interface VendorOrderMetrics {
  total: number;
  byStatus: Record<string, number>;
  byPaymentStatus: Record<string, number>;
  pendingFulfillment: number;
  completedOrders: number;
  cancelledOrders: number;
  fulfillmentRate: number;
}

export interface VendorReviewMetrics {
  totalReviews: number;
  avgRating: number;
  ratingDistribution: Record<number, number>;
  recentReviews: Array<{
    id: string;
    productName: string;
    rating: number;
    comment: string;
    buyerName: string;
    createdAt: string;
  }>;
}

export interface VendorAnalytics {
  sales: VendorSalesMetrics;
  orders: VendorOrderMetrics;
  products: {
    total: number;
    active: number;
    topPerformers: ProductPerformance[];
    lowStock: number;
  };
  reviews: VendorReviewMetrics;
  generatedAt: string;
}

function getDateRangeFilter(range: DateRange, columnAlias: string = 'created_at'): string {
  switch (range) {
    case '7d':
      return `${columnAlias}::timestamp >= NOW() - INTERVAL '7 days'`;
    case '30d':
      return `${columnAlias}::timestamp >= NOW() - INTERVAL '30 days'`;
    case '90d':
      return `${columnAlias}::timestamp >= NOW() - INTERVAL '90 days'`;
    case '1y':
      return `${columnAlias}::timestamp >= NOW() - INTERVAL '1 year'`;
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

export async function getVendorSalesMetrics(
  vendorId: string,
  range: DateRange = '30d',
  bucket: TimeBucket = 'day'
): Promise<VendorSalesMetrics> {
  const dateFilter = getDateRangeFilter(range, 'o.created_at');
  const truncFormat = getDateTruncFormat(bucket);

  const summaryResult = await query<{
    total_revenue: string;
    order_count: string;
    items_sold: string;
    total_commission: string;
    refunded_amount: string;
  }>(
    `SELECT 
      COALESCE(SUM(CASE WHEN o.payment_status = 'paid' THEN oi.final_price * oi.quantity ELSE 0 END), 0) as total_revenue,
      COUNT(DISTINCT CASE WHEN o.payment_status = 'paid' THEN o.id END) as order_count,
      COALESCE(SUM(CASE WHEN o.payment_status = 'paid' THEN oi.quantity ELSE 0 END), 0) as items_sold,
      COALESCE(SUM(CASE WHEN o.payment_status = 'paid' THEN oi.commission_amount ELSE 0 END), 0) as total_commission,
      COALESCE(SUM(CASE WHEN o.payment_status = 'refunded' THEN oi.final_price * oi.quantity ELSE 0 END), 0) as refunded_amount
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    WHERE oi.vendor_id = $1 AND ${dateFilter}`,
    [vendorId]
  );

  const trendsResult = await query<{
    bucket_date: string;
    revenue: string;
    order_count: string;
    items_sold: string;
  }>(
    `SELECT 
      DATE_TRUNC('${truncFormat}', o.created_at::timestamp) as bucket_date,
      COALESCE(SUM(CASE WHEN o.payment_status = 'paid' THEN oi.final_price * oi.quantity ELSE 0 END), 0) as revenue,
      COUNT(DISTINCT CASE WHEN o.payment_status = 'paid' THEN o.id END) as order_count,
      COALESCE(SUM(CASE WHEN o.payment_status = 'paid' THEN oi.quantity ELSE 0 END), 0) as items_sold
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    WHERE oi.vendor_id = $1 AND ${dateFilter}
    GROUP BY DATE_TRUNC('${truncFormat}', o.created_at::timestamp)
    ORDER BY bucket_date ASC`,
    [vendorId]
  );

  const summary = summaryResult.rows[0];
  const totalRevenue = parseFloat(summary?.total_revenue || '0');
  const orderCount = parseInt(summary?.order_count || '0');
  const totalCommission = parseFloat(summary?.total_commission || '0');

  return {
    totalRevenue,
    totalOrders: orderCount,
    totalItemsSold: parseInt(summary?.items_sold || '0'),
    avgOrderValue: orderCount > 0 ? totalRevenue / orderCount : 0,
    grossSales: totalRevenue,
    totalCommission,
    netEarnings: totalRevenue - totalCommission,
    refundedAmount: parseFloat(summary?.refunded_amount || '0'),
    salesTrends: trendsResult.rows.map(row => ({
      date: row.bucket_date,
      revenue: parseFloat(row.revenue),
      orders: parseInt(row.order_count),
      itemsSold: parseInt(row.items_sold),
    })),
  };
}

export async function getVendorOrderMetrics(
  vendorId: string,
  range: DateRange = '30d'
): Promise<VendorOrderMetrics> {
  const dateFilter = getDateRangeFilter(range, 'o.created_at');

  const statusResult = await query<{ status: string; count: string }>(
    `SELECT o.status, COUNT(DISTINCT o.id) as count
     FROM order_items oi
     JOIN orders o ON oi.order_id = o.id
     WHERE oi.vendor_id = $1 AND ${dateFilter}
     GROUP BY o.status`,
    [vendorId]
  );

  const paymentStatusResult = await query<{ payment_status: string; count: string }>(
    `SELECT o.payment_status, COUNT(DISTINCT o.id) as count
     FROM order_items oi
     JOIN orders o ON oi.order_id = o.id
     WHERE oi.vendor_id = $1 AND ${dateFilter}
     GROUP BY o.payment_status`,
    [vendorId]
  );

  const fulfillmentResult = await query<{ status: string; count: string }>(
    `SELECT oi.fulfillment_status as status, COUNT(*) as count
     FROM order_items oi
     JOIN orders o ON oi.order_id = o.id
     WHERE oi.vendor_id = $1 AND o.payment_status = 'paid' AND ${dateFilter}
     GROUP BY oi.fulfillment_status`,
    [vendorId]
  );

  const byStatus: Record<string, number> = {};
  let total = 0;
  for (const row of statusResult.rows) {
    const count = parseInt(row.count);
    byStatus[row.status] = count;
    total += count;
  }

  const byPaymentStatus: Record<string, number> = {};
  for (const row of paymentStatusResult.rows) {
    byPaymentStatus[row.payment_status] = parseInt(row.count);
  }

  const fulfillmentCounts: Record<string, number> = {};
  for (const row of fulfillmentResult.rows) {
    fulfillmentCounts[row.status] = parseInt(row.count);
  }

  const pendingFulfillment = fulfillmentCounts['pending'] || 0;
  const deliveredItems = (fulfillmentCounts['delivered'] || 0) + (fulfillmentCounts['fulfilled'] || 0);
  const totalPaidItems = Object.values(fulfillmentCounts).reduce((a, b) => a + b, 0);

  return {
    total,
    byStatus,
    byPaymentStatus,
    pendingFulfillment,
    completedOrders: (byStatus['delivered'] || 0) + (byStatus['completed'] || 0) + (byStatus['fulfilled'] || 0),
    cancelledOrders: byStatus['cancelled'] || 0,
    fulfillmentRate: totalPaidItems > 0 ? (deliveredItems / totalPaidItems) * 100 : 0,
  };
}

export async function getVendorProductPerformance(
  vendorId: string,
  range: DateRange = '30d',
  limit: number = 5
): Promise<ProductPerformance[]> {
  const dateFilter = getDateRangeFilter(range, 'o.created_at');

  const result = await query<{
    product_id: string;
    product_name: string;
    total_sold: string;
    total_revenue: string;
    order_count: string;
    avg_rating: string;
    review_count: string;
  }>(
    `SELECT 
      oi.product_id,
      oi.product_name,
      COALESCE(SUM(CASE WHEN o.payment_status = 'paid' THEN oi.quantity ELSE 0 END), 0) as total_sold,
      COALESCE(SUM(CASE WHEN o.payment_status = 'paid' THEN oi.final_price * oi.quantity ELSE 0 END), 0) as total_revenue,
      COUNT(DISTINCT CASE WHEN o.payment_status = 'paid' THEN o.id END) as order_count,
      (SELECT AVG(r.rating) FROM reviews r WHERE r.product_id = oi.product_id AND r.status = 'approved') as avg_rating,
      (SELECT COUNT(*) FROM reviews r WHERE r.product_id = oi.product_id AND r.status = 'approved') as review_count
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    WHERE oi.vendor_id = $1 AND ${dateFilter}
    GROUP BY oi.product_id, oi.product_name
    ORDER BY total_revenue DESC
    LIMIT $2`,
    [vendorId, limit]
  );

  return result.rows.map(row => ({
    productId: row.product_id,
    productName: row.product_name,
    totalSold: parseInt(row.total_sold),
    totalRevenue: parseFloat(row.total_revenue),
    orderCount: parseInt(row.order_count),
    avgRating: row.avg_rating ? parseFloat(row.avg_rating) : null,
    reviewCount: parseInt(row.review_count || '0'),
  }));
}

export async function getVendorProductStats(vendorId: string): Promise<{
  total: number;
  active: number;
  draft: number;
  pending: number;
  lowStock: number;
}> {
  const statusResult = await query<{ status: string; count: string }>(
    `SELECT status, COUNT(*) as count FROM products WHERE vendor_id = $1 GROUP BY status`,
    [vendorId]
  );

  const lowStockResult = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM products WHERE vendor_id = $1 AND status = 'active' AND quantity <= 5`,
    [vendorId]
  );

  const statusCounts: Record<string, number> = {};
  let total = 0;
  for (const row of statusResult.rows) {
    const count = parseInt(row.count);
    statusCounts[row.status] = count;
    total += count;
  }

  return {
    total,
    active: statusCounts['active'] || 0,
    draft: statusCounts['draft'] || 0,
    pending: statusCounts['pending_approval'] || statusCounts['pending'] || 0,
    lowStock: parseInt(lowStockResult.rows[0]?.count || '0'),
  };
}

export async function getVendorReviewMetrics(
  vendorId: string,
  range: DateRange = '30d'
): Promise<VendorReviewMetrics> {
  const dateFilter = getDateRangeFilter(range, 'r.created_at');

  const summaryResult = await query<{ total: string; avg_rating: string }>(
    `SELECT 
      COUNT(*) as total,
      AVG(r.rating) as avg_rating
    FROM reviews r
    JOIN products p ON r.product_id = p.id
    WHERE p.vendor_id = $1 AND r.status = 'approved' AND ${dateFilter}`,
    [vendorId]
  );

  const distributionResult = await query<{ rating: string; count: string }>(
    `SELECT 
      r.rating,
      COUNT(*) as count
    FROM reviews r
    JOIN products p ON r.product_id = p.id
    WHERE p.vendor_id = $1 AND r.status = 'approved' AND ${dateFilter}
    GROUP BY r.rating
    ORDER BY r.rating DESC`,
    [vendorId]
  );

  const recentResult = await query<{
    id: string;
    product_name: string;
    rating: string;
    comment: string;
    buyer_name: string;
    created_at: string;
  }>(
    `SELECT 
      r.id,
      p.name as product_name,
      r.rating,
      r.comment,
      COALESCE(u.name, 'Anonymous') as buyer_name,
      r.created_at
    FROM reviews r
    JOIN products p ON r.product_id = p.id
    LEFT JOIN users u ON r.buyer_id = u.id
    WHERE p.vendor_id = $1 AND r.status = 'approved' AND ${dateFilter}
    ORDER BY r.created_at DESC
    LIMIT 5`,
    [vendorId]
  );

  const summary = summaryResult.rows[0];
  const ratingDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const row of distributionResult.rows) {
    ratingDistribution[parseInt(row.rating)] = parseInt(row.count);
  }

  return {
    totalReviews: parseInt(summary?.total || '0'),
    avgRating: summary?.avg_rating ? parseFloat(summary.avg_rating) : 0,
    ratingDistribution,
    recentReviews: recentResult.rows.map(row => ({
      id: row.id,
      productName: row.product_name,
      rating: parseInt(row.rating),
      comment: row.comment,
      buyerName: row.buyer_name,
      createdAt: row.created_at,
    })),
  };
}

export async function getVendorAnalytics(
  vendorId: string,
  range: DateRange = '30d',
  bucket: TimeBucket = 'day'
): Promise<VendorAnalytics> {
  const [sales, orders, productStats, topProducts, reviews] = await Promise.all([
    getVendorSalesMetrics(vendorId, range, bucket),
    getVendorOrderMetrics(vendorId, range),
    getVendorProductStats(vendorId),
    getVendorProductPerformance(vendorId, range, 5),
    getVendorReviewMetrics(vendorId, range),
  ]);

  return {
    sales,
    orders,
    products: {
      total: productStats.total,
      active: productStats.active,
      topPerformers: topProducts,
      lowStock: productStats.lowStock,
    },
    reviews,
    generatedAt: new Date().toISOString(),
  };
}
