/**
 * Orders Data Access Layer
 *
 * Server-side only - provides CRUD operations for orders.
 */

import { query } from '../index';
import { v4 as uuidv4 } from 'uuid';

export type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

export interface OrderItem {
  productId: string;
  productName: string;
  vendorId: string;
  vendorName: string;
  quantity: number;
  price: number;
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
  items: string; // JSON
  subtotal: number;
  shipping_fee: number;
  tax: number;
  total: number;
  status: OrderStatus;
  payment_status: PaymentStatus;
  payment_method: string | null;
  shipping_address: string; // JSON
  tracking_number: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateOrderInput {
  buyerId: string;
  buyerName: string;
  buyerEmail: string;
  items: OrderItem[];
  subtotal: number;
  shippingFee?: number;
  tax?: number;
  total: number;
  paymentMethod?: string;
  shippingAddress: ShippingAddress;
  notes?: string;
}

export interface UpdateOrderInput {
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  trackingNumber?: string;
  notes?: string;
}

/**
 * Create a new order
 */
export async function createOrder(input: CreateOrderInput): Promise<DbOrder> {
  const id = `order_${uuidv4().replace(/-/g, '').substring(0, 16)}`;
  const now = new Date().toISOString();

  await query(`
    INSERT INTO orders (
      id, buyer_id, buyer_name, buyer_email, items, subtotal,
      shipping_fee, tax, total, status, payment_status, payment_method,
      shipping_address, notes, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
  `, [
    id,
    input.buyerId,
    input.buyerName,
    input.buyerEmail,
    JSON.stringify(input.items),
    input.subtotal,
    input.shippingFee || 0,
    input.tax || 0,
    input.total,
    'pending',
    'pending',
    input.paymentMethod || null,
    JSON.stringify(input.shippingAddress),
    input.notes || null,
    now,
    now
  ]);

  const result = await getOrderById(id);
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
 * Get order stats
 */
export async function getOrderStats(vendorId?: string): Promise<{
  totalOrders: number;
  pendingOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  totalRevenue: number;
}> {
  if (vendorId) {
    // For vendor, we need to sum up only their items
    const orders = await getOrdersByVendor(vendorId);
    let totalRevenue = 0;
    let pendingOrders = 0;
    let completedOrders = 0;
    let cancelledOrders = 0;

    for (const order of orders) {
      const items = JSON.parse(order.items) as OrderItem[];
      const vendorItems = items.filter(item => item.vendorId === vendorId);
      const vendorTotal = vendorItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
      totalRevenue += vendorTotal;

      if (['pending', 'confirmed', 'processing'].includes(order.status)) {
        pendingOrders++;
      } else if (order.status === 'delivered') {
        completedOrders++;
      } else if (order.status === 'cancelled') {
        cancelledOrders++;
      }
    }

    return {
      totalOrders: orders.length,
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
      SUM(CASE WHEN status IN ('pending', 'confirmed', 'processing') THEN 1 ELSE 0 END) as pendingOrders,
      SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as completedOrders,
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
