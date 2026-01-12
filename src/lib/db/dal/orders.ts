/**
 * Orders Data Access Layer
 *
 * PHASE 2: Checkout & Order Pipeline
 * Server-side only - provides CRUD operations for orders.
 * 
 * Status transitions:
 * - pending_payment → cancelled (admin only)
 * - pending_payment → fulfilled (when all items fulfilled by vendors)
 */

import { query } from '../index';
import { v4 as uuidv4 } from 'uuid';

// Phase 2 status types - simplified for checkout flow
export type OrderStatus = 'pending_payment' | 'cancelled' | 'fulfilled';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';
export type FulfillmentStatus = 'pending' | 'fulfilled';

export interface OrderItem {
  productId: string;
  productName: string;
  vendorId: string;
  vendorName: string;
  quantity: number;
  price: number;
  appliedDiscount?: number;
  finalPrice?: number;
  image?: string;
  variations?: Record<string, string>;
}

export interface ShippingAddress {
  fullName: string;
  phone: string;
  address: string;
  city: string;
  region: string;
  digitalAddress?: string;
}

export interface DbOrder {
  id: string;
  buyer_id: string;
  buyer_name: string;
  buyer_email: string;
  items: string; // JSON (legacy, kept for backwards compatibility)
  subtotal: number;
  discount_total: number;
  shipping_fee: number;
  tax: number;
  total: number;
  currency: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  payment_method: string | null;
  payment_reference: string | null;
  payment_provider: string | null;
  paid_at: string | null;
  shipping_address: string; // JSON
  tracking_number: string | null;
  notes: string | null;
  coupon_code: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbOrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  vendor_id: string;
  vendor_name: string;
  quantity: number;
  unit_price: number;
  applied_discount: number;
  final_price: number;
  fulfillment_status: FulfillmentStatus;
  fulfilled_at: string | null;
  image: string | null;
  variations: string | null; // JSON
  created_at: string;
  updated_at: string;
}

export interface CreateOrderInput {
  buyerId: string;
  buyerName: string;
  buyerEmail: string;
  items: OrderItem[];
  subtotal: number;
  discountTotal?: number;
  shippingFee?: number;
  tax?: number;
  total: number;
  currency?: string;
  paymentMethod?: string;
  shippingAddress: ShippingAddress;
  couponCode?: string;
  notes?: string;
}

export interface UpdateOrderInput {
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  trackingNumber?: string;
  notes?: string;
}

export interface UpdatePaymentStatusInput {
  paymentStatus: PaymentStatus;
  paymentReference?: string;
  paymentProvider?: string;
  paymentMethod?: string;
  paidAt?: string;
}

/**
 * Create a new order with order items
 * Phase 2: Creates order in pending_payment status and inserts order_items
 */
export async function createOrder(input: CreateOrderInput): Promise<DbOrder> {
  const orderId = `order_${uuidv4().replace(/-/g, '').substring(0, 16)}`;
  const now = new Date().toISOString();

  // Create the order record with currency for payment tracking
  await query(`
    INSERT INTO orders (
      id, buyer_id, buyer_name, buyer_email, items, subtotal,
      discount_total, shipping_fee, tax, total, currency, status, payment_status, 
      payment_method, shipping_address, coupon_code, notes, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
  `, [
    orderId,
    input.buyerId,
    input.buyerName,
    input.buyerEmail,
    JSON.stringify(input.items), // Legacy JSON storage for backwards compatibility
    input.subtotal,
    input.discountTotal || 0,
    input.shippingFee || 0,
    input.tax || 0,
    input.total,
    input.currency || 'GHS', // Default to Ghana Cedis
    'pending_payment', // Phase 2: All orders start as pending_payment
    'pending',
    input.paymentMethod || null,
    JSON.stringify(input.shippingAddress),
    input.couponCode || null,
    input.notes || null,
    now,
    now
  ]);

  // Create order_items entries for vendor-scoped tracking
  for (const item of input.items) {
    const itemId = `oi_${uuidv4().replace(/-/g, '').substring(0, 20)}`;
    const unitPrice = item.price;
    const appliedDiscount = item.appliedDiscount || 0;
    const finalPrice = item.finalPrice || (unitPrice * item.quantity - appliedDiscount);

    await query(`
      INSERT INTO order_items (
        id, order_id, product_id, product_name, vendor_id, vendor_name,
        quantity, unit_price, applied_discount, final_price, fulfillment_status,
        image, variations, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    `, [
      itemId,
      orderId,
      item.productId,
      item.productName,
      item.vendorId,
      item.vendorName,
      item.quantity,
      unitPrice,
      appliedDiscount,
      finalPrice,
      'pending', // All items start as pending
      item.image || null,
      item.variations ? JSON.stringify(item.variations) : null,
      now,
      now
    ]);
  }

  const result = await getOrderById(orderId);
  return result!;
}

/**
 * Get order by ID
 */
export async function getOrderById(id: string): Promise<DbOrder | null> {
  const result = await query<DbOrder>('SELECT * FROM orders WHERE id = $1', [id]);
  return result.rows[0] || null;
}

/**
 * Get all orders
 */
export async function getOrders(options?: {
  buyerId?: string;
  vendorId?: string;
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  limit?: number;
  offset?: number;
}): Promise<DbOrder[]> {
  let sql = 'SELECT * FROM orders WHERE 1=1';
  const params: unknown[] = [];
  let paramIndex = 1;

  if (options?.buyerId) {
    sql += ` AND buyer_id = $${paramIndex++}`;
    params.push(options.buyerId);
  }

  if (options?.status) {
    sql += ` AND status = $${paramIndex++}`;
    params.push(options.status);
  }

  if (options?.paymentStatus) {
    sql += ` AND payment_status = $${paramIndex++}`;
    params.push(options.paymentStatus);
  }

  sql += ' ORDER BY created_at DESC';

  if (options?.limit) {
    sql += ` LIMIT $${paramIndex++}`;
    params.push(options.limit);
  }

  if (options?.offset) {
    sql += ` OFFSET $${paramIndex++}`;
    params.push(options.offset);
  }

  const result = await query<DbOrder>(sql, params);
  let orders = result.rows;

  // Filter by vendorId if provided (requires parsing items JSON)
  if (options?.vendorId) {
    orders = orders.filter(order => {
      const items = JSON.parse(order.items) as OrderItem[];
      return items.some(item => item.vendorId === options.vendorId);
    });
  }

  return orders;
}

/**
 * Get orders by buyer
 */
export async function getOrdersByBuyer(buyerId: string): Promise<DbOrder[]> {
  return getOrders({ buyerId });
}

/**
 * Get orders by vendor
 */
export async function getOrdersByVendor(vendorId: string): Promise<DbOrder[]> {
  return getOrders({ vendorId });
}

/**
 * Update order
 */
export async function updateOrder(id: string, updates: UpdateOrderInput): Promise<DbOrder | null> {
  const now = new Date().toISOString();

  const fields: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  fields.push(`updated_at = $${paramIndex++}`);
  values.push(now);

  if (updates.status !== undefined) {
    fields.push(`status = $${paramIndex++}`);
    values.push(updates.status);
  }
  if (updates.paymentStatus !== undefined) {
    fields.push(`payment_status = $${paramIndex++}`);
    values.push(updates.paymentStatus);
  }
  if (updates.trackingNumber !== undefined) {
    fields.push(`tracking_number = $${paramIndex++}`);
    values.push(updates.trackingNumber);
  }
  if (updates.notes !== undefined) {
    fields.push(`notes = $${paramIndex++}`);
    values.push(updates.notes);
  }

  values.push(id);

  const result = await query(
    `UPDATE orders SET ${fields.join(', ')} WHERE id = $${paramIndex}`,
    values
  );

  if ((result.rowCount ?? 0) === 0) return null;
  return getOrderById(id);
}

/**
 * Update order payment status (for Paystack webhook integration)
 * This function updates payment-specific fields after payment confirmation.
 * Only updates fields that have actual values (not null/undefined).
 */
export async function updateOrderPaymentStatus(
  id: string,
  updates: UpdatePaymentStatusInput
): Promise<DbOrder | null> {
  const now = new Date().toISOString();

  const fields: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  fields.push(`updated_at = $${paramIndex++}`);
  values.push(now);

  fields.push(`payment_status = $${paramIndex++}`);
  values.push(updates.paymentStatus);

  if (updates.paymentReference !== undefined && updates.paymentReference !== null) {
    fields.push(`payment_reference = $${paramIndex++}`);
    values.push(updates.paymentReference);
  }

  if (updates.paymentProvider !== undefined && updates.paymentProvider !== null) {
    fields.push(`payment_provider = $${paramIndex++}`);
    values.push(updates.paymentProvider);
  }

  if (updates.paymentMethod !== undefined && updates.paymentMethod !== null) {
    fields.push(`payment_method = $${paramIndex++}`);
    values.push(updates.paymentMethod);
  }

  if (updates.paidAt !== undefined && updates.paidAt !== null) {
    fields.push(`paid_at = $${paramIndex++}`);
    values.push(updates.paidAt);
  }

  values.push(id);

  const result = await query(
    `UPDATE orders SET ${fields.join(', ')} WHERE id = $${paramIndex}`,
    values
  );

  if ((result.rowCount ?? 0) === 0) return null;
  return getOrderById(id);
}

/**
 * Cancel order
 */
export async function cancelOrder(id: string): Promise<boolean> {
  const result = await updateOrder(id, { status: 'cancelled' });
  return result !== null;
}

/**
 * Delete order (use with caution)
 */
export async function deleteOrder(id: string): Promise<boolean> {
  const result = await query('DELETE FROM orders WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
}

/**
 * Get order stats (Phase 2 status values)
 */
export async function getOrderStats(vendorId?: string): Promise<{
  totalOrders: number;
  pendingOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  totalRevenue: number;
}> {
  if (vendorId) {
    // For vendor, use order_items table for accurate stats
    const vendorItems = await getOrderItemsByVendor(vendorId);
    const orderIds = new Set(vendorItems.map(item => item.order_id));
    
    let totalRevenue = 0;
    let pendingOrders = 0;
    let completedOrders = 0;
    let cancelledOrders = 0;

    for (const orderId of orderIds) {
      const order = await getOrderById(orderId);
      if (!order) continue;
      
      const vendorItemsForOrder = vendorItems.filter(item => item.order_id === orderId);
      const vendorTotal = vendorItemsForOrder.reduce((sum, item) => sum + item.final_price, 0);
      totalRevenue += vendorTotal;

      if (order.status === 'pending_payment') {
        pendingOrders++;
      } else if (order.status === 'fulfilled') {
        completedOrders++;
      } else if (order.status === 'cancelled') {
        cancelledOrders++;
      }
    }

    return {
      totalOrders: orderIds.size,
      pendingOrders,
      completedOrders,
      cancelledOrders,
      totalRevenue,
    };
  }

  const statsResult = await query<{
    totalorders: string;
    pendingorders: string;
    completedorders: string;
    cancelledorders: string;
    totalrevenue: string | null;
  }>(`
    SELECT
      COUNT(*) as totalOrders,
      SUM(CASE WHEN status = 'pending_payment' THEN 1 ELSE 0 END) as pendingOrders,
      SUM(CASE WHEN status = 'fulfilled' THEN 1 ELSE 0 END) as completedOrders,
      SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelledOrders,
      SUM(CASE WHEN payment_status = 'paid' THEN total ELSE 0 END) as totalRevenue
    FROM orders
  `);

  const result = statsResult.rows[0];

  return {
    totalOrders: parseInt(result?.totalorders || '0'),
    pendingOrders: parseInt(result?.pendingorders || '0'),
    completedOrders: parseInt(result?.completedorders || '0'),
    cancelledOrders: parseInt(result?.cancelledorders || '0'),
    totalRevenue: parseFloat(result?.totalrevenue || '0'),
  };
}

/**
 * Parse order items from JSON string
 */
export function parseOrderItems(order: DbOrder): OrderItem[] {
  return JSON.parse(order.items) as OrderItem[];
}

/**
 * Parse shipping address from JSON string
 */
export function parseShippingAddress(order: DbOrder): ShippingAddress {
  return JSON.parse(order.shipping_address) as ShippingAddress;
}

// ============================================
// PHASE 2: Order Items Functions
// ============================================

/**
 * Get all order items for an order
 */
export async function getOrderItemsByOrderId(orderId: string): Promise<DbOrderItem[]> {
  const result = await query<DbOrderItem>(
    'SELECT * FROM order_items WHERE order_id = $1 ORDER BY created_at ASC',
    [orderId]
  );
  return result.rows;
}

/**
 * Get all order items for a vendor (across all orders)
 */
export async function getOrderItemsByVendor(vendorId: string): Promise<DbOrderItem[]> {
  const result = await query<DbOrderItem>(
    'SELECT * FROM order_items WHERE vendor_id = $1 ORDER BY created_at DESC',
    [vendorId]
  );
  return result.rows;
}

/**
 * Get orders containing items for a specific vendor (using order_items table)
 */
export async function getOrdersForVendor(vendorId: string): Promise<DbOrder[]> {
  const result = await query<DbOrder>(`
    SELECT DISTINCT o.* FROM orders o
    INNER JOIN order_items oi ON o.id = oi.order_id
    WHERE oi.vendor_id = $1
    ORDER BY o.created_at DESC
  `, [vendorId]);
  return result.rows;
}

/**
 * Get vendor's items for a specific order
 */
export async function getVendorItemsForOrder(orderId: string, vendorId: string): Promise<DbOrderItem[]> {
  const result = await query<DbOrderItem>(
    'SELECT * FROM order_items WHERE order_id = $1 AND vendor_id = $2',
    [orderId, vendorId]
  );
  return result.rows;
}

/**
 * Fulfill an order item (vendor action)
 * Returns true if successful, false if item not found or already fulfilled
 */
export async function fulfillOrderItem(itemId: string, vendorId: string): Promise<boolean> {
  const now = new Date().toISOString();
  
  const result = await query(
    `UPDATE order_items 
     SET fulfillment_status = 'fulfilled', fulfilled_at = $1, updated_at = $1
     WHERE id = $2 AND vendor_id = $3 AND fulfillment_status = 'pending'`,
    [now, itemId, vendorId]
  );
  
  if ((result.rowCount ?? 0) === 0) return false;
  
  // Check if all items in the order are now fulfilled
  const item = await query<DbOrderItem>('SELECT order_id FROM order_items WHERE id = $1', [itemId]);
  if (item.rows.length > 0) {
    await checkAndUpdateOrderFulfillment(item.rows[0].order_id);
  }
  
  return true;
}

/**
 * Check if all items in an order are fulfilled and update order status
 */
export async function checkAndUpdateOrderFulfillment(orderId: string): Promise<boolean> {
  const pendingItems = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM order_items WHERE order_id = $1 AND fulfillment_status = 'pending'`,
    [orderId]
  );
  
  const pendingCount = parseInt(pendingItems.rows[0]?.count || '0', 10);
  
  if (pendingCount === 0) {
    // All items fulfilled - update order status
    await updateOrder(orderId, { status: 'fulfilled' });
    return true;
  }
  
  return false;
}

/**
 * Cancel order with inventory restoration (admin action)
 * This restores inventory for all items in the order
 */
export async function cancelOrderWithInventoryRestore(orderId: string): Promise<{
  success: boolean;
  error?: string;
  restoredItems?: Array<{ productId: string; quantity: number }>;
}> {
  // Get the order first
  const order = await getOrderById(orderId);
  if (!order) {
    return { success: false, error: 'Order not found' };
  }
  
  // Only pending_payment orders can be cancelled
  if (order.status !== 'pending_payment') {
    return { success: false, error: `Cannot cancel order with status: ${order.status}` };
  }
  
  // Get all order items
  const orderItems = await getOrderItemsByOrderId(orderId);
  const restoredItems: Array<{ productId: string; quantity: number }> = [];
  
  // Restore inventory for each item
  for (const item of orderItems) {
    await query(
      `UPDATE products SET quantity = quantity + $1, updated_at = $2 WHERE id = $3`,
      [item.quantity, new Date().toISOString(), item.product_id]
    );
    restoredItems.push({ productId: item.product_id, quantity: item.quantity });
  }
  
  // Update order status to cancelled
  await updateOrder(orderId, { status: 'cancelled' });
  
  return { success: true, restoredItems };
}

/**
 * Get order with its items
 */
export async function getOrderWithItems(orderId: string): Promise<{
  order: DbOrder;
  items: DbOrderItem[];
} | null> {
  const order = await getOrderById(orderId);
  if (!order) return null;
  
  const items = await getOrderItemsByOrderId(orderId);
  return { order, items };
}
