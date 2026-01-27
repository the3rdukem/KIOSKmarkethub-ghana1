/**
 * Orders Data Access Layer
 *
 * PHASE 7B: Order Status Refactor
 * Server-side only - provides CRUD operations for orders.
 * 
 * Three-track status model:
 * 1. Payment Status: pending → paid | failed | refunded
 * 2. Order Status: created → confirmed → preparing → ready_for_pickup → out_for_delivery → delivered → completed
 * 3. Item Fulfillment: pending → packed → handed_to_courier → delivered
 * 
 * Dispute window: 48 hours after delivery for buyer to raise issues
 */

import { query } from '../index';
import { v4 as uuidv4 } from 'uuid';
import { createAuditLog } from './audit';

// Phase 7B: New order status model with full lifecycle
// Legacy statuses mapped: pending_payment→created, processing→confirmed, shipped→out_for_delivery, fulfilled→delivered
export type OrderStatus = 
  | 'created'           // Order submitted, awaiting payment (legacy: pending_payment)
  | 'confirmed'         // Payment successful (legacy: processing)
  | 'preparing'         // Vendor is packing
  | 'ready_for_pickup'  // Ready for courier pickup
  | 'out_for_delivery'  // Courier dispatched (legacy: shipped)
  | 'delivered'         // Vendor confirms delivery (legacy: fulfilled)
  | 'completed'         // System: 48h passed, no disputes
  | 'delivery_failed'   // Delivery attempt failed
  | 'cancelled'         // Admin cancelled
  | 'disputed'          // Buyer raised dispute
  // Legacy aliases for backward compatibility
  | 'pending_payment'   // Maps to 'created'
  | 'processing'        // Maps to 'confirmed'
  | 'shipped'           // Maps to 'out_for_delivery'
  | 'fulfilled';        // Maps to 'delivered'

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

// Phase 7B: New fulfillment status with courier handoff
export type FulfillmentStatus = 'pending' | 'packed' | 'handed_to_courier' | 'delivered' 
  // Legacy aliases
  | 'shipped' | 'fulfilled';

/**
 * Normalize legacy status to new status
 */
export function normalizeOrderStatus(status: string): OrderStatus {
  const legacyMap: Record<string, OrderStatus> = {
    'pending_payment': 'created',
    'processing': 'confirmed',
    'shipped': 'out_for_delivery',
    'fulfilled': 'delivered',
  };
  return (legacyMap[status] || status) as OrderStatus;
}

/**
 * Normalize legacy fulfillment status
 */
export function normalizeFulfillmentStatus(status: string): FulfillmentStatus {
  const legacyMap: Record<string, FulfillmentStatus> = {
    'shipped': 'handed_to_courier',
    'fulfilled': 'delivered',
  };
  return (legacyMap[status] || status) as FulfillmentStatus;
}

/**
 * Valid order status transitions (Phase 7B)
 * Returns the allowed next statuses for a given current status
 */
export function getValidOrderTransitions(currentStatus: OrderStatus): OrderStatus[] {
  const normalized = normalizeOrderStatus(currentStatus);
  const transitions: Record<string, OrderStatus[]> = {
    'created': ['confirmed', 'cancelled'],
    'confirmed': ['preparing', 'cancelled'],
    'preparing': ['ready_for_pickup', 'cancelled'],
    'ready_for_pickup': ['out_for_delivery', 'cancelled'],
    'out_for_delivery': ['delivered', 'delivery_failed', 'cancelled'],
    'delivered': ['completed', 'disputed'],
    'delivery_failed': ['out_for_delivery', 'cancelled'], // Can retry or cancel
    'disputed': ['completed', 'cancelled'], // Admin resolution
    'completed': [], // Terminal
    'cancelled': [], // Terminal
  };
  return transitions[normalized] || [];
}

/**
 * Check if a status transition is valid
 */
export function isValidStatusTransition(
  fromStatus: OrderStatus, 
  toStatus: OrderStatus,
  actor: 'system' | 'vendor' | 'buyer' | 'admin'
): { valid: boolean; reason?: string } {
  const normalizedFrom = normalizeOrderStatus(fromStatus);
  const normalizedTo = normalizeOrderStatus(toStatus);
  
  const validTransitions = getValidOrderTransitions(normalizedFrom);
  
  if (!validTransitions.includes(normalizedTo)) {
    return { 
      valid: false, 
      reason: `Invalid transition from '${normalizedFrom}' to '${normalizedTo}'` 
    };
  }
  
  // Actor-specific rules
  const actorRules: Record<string, Record<string, string[]>> = {
    'system': {
      'created': ['confirmed'],
      'delivered': ['completed'],
    },
    'vendor': {
      'confirmed': ['preparing'],
      'preparing': ['ready_for_pickup'],
      'ready_for_pickup': ['out_for_delivery'],
      'out_for_delivery': ['delivered', 'delivery_failed'],
      'delivery_failed': ['out_for_delivery'],
    },
    'buyer': {
      'delivered': ['disputed'],
    },
    'admin': {
      // Admin can do any valid transition
      '*': validTransitions.map(s => s as string),
    },
  };
  
  if (actor === 'admin') {
    return { valid: true };
  }
  
  const allowedForActor = actorRules[actor]?.[normalizedFrom] || [];
  if (!allowedForActor.includes(normalizedTo)) {
    return { 
      valid: false, 
      reason: `Actor '${actor}' cannot transition from '${normalizedFrom}' to '${normalizedTo}'` 
    };
  }
  
  return { valid: true };
}

/**
 * Valid item fulfillment transitions
 */
export function getValidFulfillmentTransitions(currentStatus: FulfillmentStatus): FulfillmentStatus[] {
  const normalized = normalizeFulfillmentStatus(currentStatus);
  const transitions: Record<string, FulfillmentStatus[]> = {
    'pending': ['packed'],
    'packed': ['handed_to_courier'],
    'handed_to_courier': ['delivered'],
    'delivered': [], // Terminal
  };
  return transitions[normalized] || [];
}

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
  courier_provider: string | null;  // Phase 7B: Selected courier (Bolt, Yango, etc.)
  courier_reference: string | null; // Phase 7B: External booking reference
  delivered_at: string | null;      // Phase 7B: When order was marked delivered (for 48h window)
  disputed_at: string | null;       // Phase 7B: When dispute was raised
  dispute_reason: string | null;    // Phase 7B: Reason for dispute
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
  courierProvider?: string;    // Phase 7B: Selected courier
  courierReference?: string;   // Phase 7B: External booking reference
  deliveredAt?: string;        // Phase 7B: When marked delivered
  disputedAt?: string;         // Phase 7B: When dispute raised
  disputeReason?: string;      // Phase 7B: Reason for dispute
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
 * 
 * @param input - Order creation input data
 * @param txClient - Optional PoolClient for transactional operations
 */
export async function createOrder(
  input: CreateOrderInput,
  txClient?: import('pg').PoolClient
): Promise<DbOrder> {
  const orderId = `order_${uuidv4().replace(/-/g, '').substring(0, 16)}`;
  const now = new Date().toISOString();

  const orderParams = [
    orderId,
    input.buyerId,
    input.buyerName,
    input.buyerEmail,
    JSON.stringify(input.items),
    input.subtotal,
    input.discountTotal || 0,
    input.shippingFee || 0,
    input.tax || 0,
    input.total,
    input.currency || 'GHS',
    'created', // Phase 7B: Use 'created' for new orders
    'pending',
    input.paymentMethod || null,
    JSON.stringify(input.shippingAddress),
    input.couponCode || null,
    input.notes || null,
    now,
    now
  ];

  const orderQuery = `
    INSERT INTO orders (
      id, buyer_id, buyer_name, buyer_email, items, subtotal,
      discount_total, shipping_fee, tax, total, currency, status, payment_status, 
      payment_method, shipping_address, coupon_code, notes, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
  `;

  if (txClient) {
    await txClient.query(orderQuery, orderParams);
  } else {
    await query(orderQuery, orderParams);
  }

  for (const item of input.items) {
    const itemId = `oi_${uuidv4().replace(/-/g, '').substring(0, 20)}`;
    const unitPrice = item.price;
    const appliedDiscount = item.appliedDiscount || 0;
    const finalPrice = item.finalPrice || (unitPrice * item.quantity - appliedDiscount);

    const itemParams = [
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
      'pending',
      item.image || null,
      item.variations ? JSON.stringify(item.variations) : null,
      now,
      now
    ];

    const itemQuery = `
      INSERT INTO order_items (
        id, order_id, product_id, product_name, vendor_id, vendor_name,
        quantity, unit_price, applied_discount, final_price, fulfillment_status,
        image, variations, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    `;

    if (txClient) {
      await txClient.query(itemQuery, itemParams);
    } else {
      await query(itemQuery, itemParams);
    }
  }

  // Return the order directly to avoid reading uncommitted data from a different connection
  const order: DbOrder = {
    id: orderId,
    buyer_id: input.buyerId,
    buyer_name: input.buyerName,
    buyer_email: input.buyerEmail,
    items: JSON.stringify(input.items),
    subtotal: input.subtotal,
    discount_total: input.discountTotal || 0,
    shipping_fee: input.shippingFee || 0,
    tax: input.tax || 0,
    total: input.total,
    currency: input.currency || 'GHS',
    status: 'created', // Phase 7B: Use 'created' for new orders
    payment_status: 'pending',
    payment_method: input.paymentMethod || null,
    payment_reference: null,
    payment_provider: null,
    paid_at: null,
    shipping_address: JSON.stringify(input.shippingAddress),
    tracking_number: null,
    courier_provider: null,     // Phase 7B
    courier_reference: null,    // Phase 7B
    delivered_at: null,         // Phase 7B
    disputed_at: null,          // Phase 7B
    dispute_reason: null,       // Phase 7B
    notes: input.notes || null,
    coupon_code: input.couponCode || null,
    created_at: now,
    updated_at: now,
  };

  return order;
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
 * Update order (internal - no transition validation)
 * For validated transitions, use transitionOrderStatus instead
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
  if (updates.courierProvider !== undefined) {
    fields.push(`courier_provider = $${paramIndex++}`);
    values.push(updates.courierProvider);
  }
  if (updates.courierReference !== undefined) {
    fields.push(`courier_reference = $${paramIndex++}`);
    values.push(updates.courierReference);
  }
  if (updates.deliveredAt !== undefined) {
    fields.push(`delivered_at = $${paramIndex++}`);
    values.push(updates.deliveredAt);
  }
  if (updates.disputedAt !== undefined) {
    fields.push(`disputed_at = $${paramIndex++}`);
    values.push(updates.disputedAt);
  }
  if (updates.disputeReason !== undefined) {
    fields.push(`dispute_reason = $${paramIndex++}`);
    values.push(updates.disputeReason);
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
 * Phase 7B: Transition order status with validation and audit logging
 * Returns success or error with appropriate HTTP status code
 */
export async function transitionOrderStatus(
  orderId: string,
  newStatus: OrderStatus,
  actor: { id: string; role: 'system' | 'vendor' | 'buyer' | 'admin'; name?: string; email?: string },
  options?: { 
    courierProvider?: string; 
    courierReference?: string;
    disputeReason?: string;
  }
): Promise<{ success: boolean; error?: string; statusCode?: number; order?: DbOrder }> {
  const order = await getOrderById(orderId);
  if (!order) {
    return { success: false, error: 'Order not found', statusCode: 404 };
  }
  
  const currentStatus = order.status;
  const validation = isValidStatusTransition(currentStatus, newStatus, actor.role);
  
  if (!validation.valid) {
    // Log the invalid transition attempt
    await createAuditLog({
      action: 'ORDER_TRANSITION_REJECTED',
      category: 'order',
      adminId: actor.id,
      adminName: actor.name || actor.role,
      adminEmail: actor.email || '',
      adminRole: actor.role,
      targetId: orderId,
      targetType: 'order',
      targetName: `Order ${orderId}`,
      details: JSON.stringify({
        previousStatus: currentStatus,
        attemptedStatus: newStatus,
        reason: validation.reason,
      }),
      severity: 'warning',
    });
    
    return { success: false, error: validation.reason, statusCode: 409 };
  }
  
  const now = new Date().toISOString();
  const updates: UpdateOrderInput = { status: newStatus };
  
  // Handle special status transitions
  if (newStatus === 'delivered' || normalizeOrderStatus(newStatus) === 'delivered') {
    updates.deliveredAt = now;
  }
  
  if (newStatus === 'disputed') {
    updates.disputedAt = now;
    if (options?.disputeReason) {
      updates.disputeReason = options.disputeReason;
    }
  }
  
  if (newStatus === 'out_for_delivery' && options?.courierProvider) {
    updates.courierProvider = options.courierProvider;
    if (options.courierReference) {
      updates.courierReference = options.courierReference;
    }
  }
  
  const updatedOrder = await updateOrder(orderId, updates);
  
  if (!updatedOrder) {
    return { success: false, error: 'Failed to update order', statusCode: 500 };
  }
  
  // Log successful transition
  await createAuditLog({
    action: 'ORDER_STATUS_CHANGED',
    category: 'order',
    adminId: actor.id,
    adminName: actor.name || actor.role,
    adminEmail: actor.email || '',
    adminRole: actor.role,
    targetId: orderId,
    targetType: 'order',
    targetName: `Order ${orderId}`,
    details: JSON.stringify({
      previousStatus: currentStatus,
      newStatus: newStatus,
      courierProvider: options?.courierProvider,
      courierReference: options?.courierReference,
      disputeReason: options?.disputeReason,
    }),
  });
  
  return { success: true, order: updatedOrder };
}

/**
 * Phase 7B: Check if order is within dispute window (48 hours after delivery)
 */
export function isWithinDisputeWindow(order: DbOrder): boolean {
  if (!order.delivered_at) return false;
  
  const deliveredAt = new Date(order.delivered_at);
  const now = new Date();
  const hoursSinceDelivery = (now.getTime() - deliveredAt.getTime()) / (1000 * 60 * 60);
  
  return hoursSinceDelivery <= 48;
}

/**
 * Phase 7B: Get orders that are eligible for auto-completion
 * (delivered more than 48 hours ago, not disputed, not already completed)
 */
export async function getOrdersEligibleForCompletion(): Promise<DbOrder[]> {
  const cutoffTime = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  
  const result = await query<DbOrder>(`
    SELECT * FROM orders 
    WHERE status = 'delivered' 
      AND delivered_at IS NOT NULL 
      AND delivered_at < $1
    ORDER BY delivered_at ASC
  `, [cutoffTime]);
  
  return result.rows;
}

/**
 * Phase 7B: Auto-complete delivered orders after 48h dispute window
 * Should be called by a scheduled job
 */
export async function autoCompleteDeliveredOrders(): Promise<number> {
  const eligibleOrders = await getOrdersEligibleForCompletion();
  let completedCount = 0;
  
  for (const order of eligibleOrders) {
    const result = await transitionOrderStatus(
      order.id,
      'completed',
      { id: 'system', role: 'system', name: 'System', email: '' }
    );
    
    if (result.success) {
      completedCount++;
    }
  }
  
  return completedCount;
}

/**
 * Update order payment status (for Paystack webhook integration)
 * This function updates payment-specific fields after payment confirmation.
 * Only updates fields that have actual values (not null/undefined).
 * 
 * IMPORTANT: When paymentStatus is 'paid' AND order is still in 'pending_payment',
 * also updates main order status to 'confirmed' to reflect payment confirmation.
 * This conditional check prevents webhook retries from downgrading already-fulfilled orders.
 * 
 * Phase 7B: Uses 'confirmed' status (legacy: 'processing') and handles both 'created' and 'pending_payment'
 */
export async function updateOrderPaymentStatus(
  id: string,
  updates: UpdatePaymentStatusInput
): Promise<DbOrder | null> {
  // First, get the current order status to check if we should update main status
  const currentOrder = await getOrderById(id);
  if (!currentOrder) return null;

  const now = new Date().toISOString();

  const fields: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  fields.push(`updated_at = $${paramIndex++}`);
  values.push(now);

  fields.push(`payment_status = $${paramIndex++}`);
  values.push(updates.paymentStatus);

  // Phase 7B: When payment is confirmed as 'paid' AND order is still awaiting payment,
  // update main order status to 'confirmed'. Handles both legacy 'pending_payment' and new 'created'
  const normalizedStatus = normalizeOrderStatus(currentOrder.status);
  if (updates.paymentStatus === 'paid' && normalizedStatus === 'created') {
    fields.push(`status = $${paramIndex++}`);
    values.push('confirmed');
  }

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
 * Get order stats (Phase 7B status values with legacy support)
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

      const normalizedStatus = normalizeOrderStatus(order.status);
      if (normalizedStatus === 'created') {
        pendingOrders++;
      } else if (normalizedStatus === 'delivered' || normalizedStatus === 'completed') {
        completedOrders++;
      } else if (normalizedStatus === 'cancelled') {
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

  // Phase 7B: Include both legacy and new statuses for backward compatibility
  const statsResult = await query<{
    totalorders: string;
    pendingorders: string;
    completedorders: string;
    cancelledorders: string;
    totalrevenue: string | null;
  }>(`
    SELECT
      COUNT(*) as totalOrders,
      SUM(CASE WHEN status IN ('pending_payment', 'created') THEN 1 ELSE 0 END) as pendingOrders,
      SUM(CASE WHEN status IN ('fulfilled', 'delivered', 'completed') THEN 1 ELSE 0 END) as completedOrders,
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
 * 
 * Phase 7B: Vendors only see PAID orders (confirmed and beyond, or cancelled-after-payment).
 * Orders in 'created' or 'pending_payment' status are NOT visible to vendors since payment is not confirmed.
 * This prevents vendors from seeing orders that may never be paid.
 */
export async function getOrdersForVendor(vendorId: string): Promise<DbOrder[]> {
  const result = await query<DbOrder>(`
    SELECT DISTINCT o.* FROM orders o
    INNER JOIN order_items oi ON o.id = oi.order_id
    WHERE oi.vendor_id = $1
      AND o.status IN ('confirmed', 'preparing', 'ready_for_pickup', 'out_for_delivery', 'delivered', 'completed', 'processing', 'shipped', 'fulfilled', 'cancelled', 'disputed', 'delivery_failed')
      AND o.status NOT IN ('created', 'pending_payment')
      AND (o.status != 'cancelled' OR o.payment_status = 'refunded')
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
 * Phase 7B: Pack an order item (vendor action)
 * Transitions item from 'pending' to 'packed'
 */
export async function packOrderItem(itemId: string, vendorId: string): Promise<boolean> {
  const now = new Date().toISOString();
  
  const result = await query(
    `UPDATE order_items 
     SET fulfillment_status = 'packed', updated_at = $1
     WHERE id = $2 AND vendor_id = $3 AND fulfillment_status = 'pending'`,
    [now, itemId, vendorId]
  );
  
  if ((result.rowCount ?? 0) === 0) return false;
  
  // Check if all items are packed and update order status to 'preparing'
  const item = await query<DbOrderItem>('SELECT order_id FROM order_items WHERE id = $1', [itemId]);
  if (item.rows.length > 0) {
    await checkAndUpdateOrderPreparing(item.rows[0].order_id);
  }
  
  return true;
}

/**
 * Phase 7B: Hand item to courier (vendor action)
 * Transitions item from 'packed' or 'shipped' to 'handed_to_courier'
 * Also accepts 'pending' for legacy compatibility (direct ship without pack step)
 */
export async function handItemToCourier(itemId: string, vendorId: string): Promise<boolean> {
  const now = new Date().toISOString();
  
  // Accept 'pending', 'packed', or legacy 'shipped' - allows legacy "ship" to work
  const result = await query(
    `UPDATE order_items 
     SET fulfillment_status = 'handed_to_courier', updated_at = $1
     WHERE id = $2 AND vendor_id = $3 AND fulfillment_status IN ('pending', 'packed', 'shipped')`,
    [now, itemId, vendorId]
  );
  
  if ((result.rowCount ?? 0) === 0) return false;
  
  // Check if all items are handed to courier and update order status
  const item = await query<DbOrderItem>('SELECT order_id FROM order_items WHERE id = $1', [itemId]);
  if (item.rows.length > 0) {
    await checkAndUpdateOrderOutForDelivery(item.rows[0].order_id);
  }
  
  return true;
}

/**
 * Phase 7B: Check if all items in an order are preparing and update order status
 */
export async function checkAndUpdateOrderPreparing(orderId: string): Promise<boolean> {
  const pendingItems = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM order_items WHERE order_id = $1 AND fulfillment_status = 'pending'`,
    [orderId]
  );
  
  const pendingCount = parseInt(pendingItems.rows[0]?.count || '0', 10);
  
  if (pendingCount === 0) {
    // All items packed or beyond - update order status to 'preparing'
    const order = await getOrderById(orderId);
    if (order && normalizeOrderStatus(order.status) === 'confirmed') {
      await updateOrder(orderId, { status: 'preparing' });
    }
    return true;
  }
  
  return false;
}

/**
 * Phase 7B: Check if all items are out for delivery
 */
export async function checkAndUpdateOrderOutForDelivery(orderId: string): Promise<boolean> {
  const notHandedItems = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM order_items WHERE order_id = $1 AND fulfillment_status NOT IN ('handed_to_courier', 'delivered', 'shipped', 'fulfilled')`,
    [orderId]
  );
  
  const notHandedCount = parseInt(notHandedItems.rows[0]?.count || '0', 10);
  
  if (notHandedCount === 0) {
    // All items out for delivery - update order status
    const order = await getOrderById(orderId);
    const normalized = normalizeOrderStatus(order?.status || '');
    if (normalized !== 'out_for_delivery' && normalized !== 'delivered' && normalized !== 'completed') {
      await updateOrder(orderId, { status: 'out_for_delivery' });
    }
    return true;
  }
  
  return false;
}

/**
 * Check if all items in an order are shipped/handed to courier and update order status
 * LEGACY - calls checkAndUpdateOrderOutForDelivery
 */
export async function checkAndUpdateOrderShipped(orderId: string): Promise<boolean> {
  return checkAndUpdateOrderOutForDelivery(orderId);
}

/**
 * Fulfill/deliver an order item (vendor action)
 * Phase 7B: Transitions item from 'handed_to_courier'/'shipped' to 'delivered' (was 'fulfilled')
 * Returns true if successful, false if item not found or not in correct status
 */
export async function fulfillOrderItem(itemId: string, vendorId: string): Promise<boolean> {
  const now = new Date().toISOString();
  
  // Phase 7B: Accept both 'handed_to_courier' and legacy 'shipped' status
  const result = await query(
    `UPDATE order_items 
     SET fulfillment_status = 'delivered', fulfilled_at = $1, updated_at = $1
     WHERE id = $2 AND vendor_id = $3 AND fulfillment_status IN ('handed_to_courier', 'shipped')`,
    [now, itemId, vendorId]
  );
  
  if ((result.rowCount ?? 0) === 0) return false;
  
  // Check if all items in the order are now delivered
  const item = await query<DbOrderItem>('SELECT order_id FROM order_items WHERE id = $1', [itemId]);
  if (item.rows.length > 0) {
    await checkAndUpdateOrderFulfillment(item.rows[0].order_id);
  }
  
  return true;
}

/**
 * Check if all items in an order are delivered and update order status
 * Phase 7B: Updates to 'delivered' and sets delivered_at timestamp for dispute window
 */
export async function checkAndUpdateOrderFulfillment(orderId: string): Promise<boolean> {
  // Phase 7B: Accept both 'delivered' and legacy 'fulfilled' as completed
  const unfulfilledItems = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM order_items WHERE order_id = $1 AND fulfillment_status NOT IN ('delivered', 'fulfilled')`,
    [orderId]
  );
  
  const unfulfilledCount = parseInt(unfulfilledItems.rows[0]?.count || '0', 10);
  
  if (unfulfilledCount === 0) {
    // All items delivered - update order status and set delivered_at
    const now = new Date().toISOString();
    await updateOrder(orderId, { status: 'delivered', deliveredAt: now });
    return true;
  }
  
  return false;
}

/**
 * Phase 7B: Buyer raises a dispute within the 48-hour window
 */
export async function raiseDispute(
  orderId: string, 
  buyerId: string, 
  reason: string
): Promise<{ success: boolean; error?: string; statusCode?: number }> {
  const order = await getOrderById(orderId);
  if (!order) {
    return { success: false, error: 'Order not found', statusCode: 404 };
  }
  
  // Verify buyer owns this order
  if (order.buyer_id !== buyerId) {
    return { success: false, error: 'Not authorized to dispute this order', statusCode: 403 };
  }
  
  const normalized = normalizeOrderStatus(order.status);
  
  // Can only dispute delivered orders
  if (normalized !== 'delivered') {
    return { success: false, error: 'Can only dispute delivered orders', statusCode: 400 };
  }
  
  // Check 48-hour dispute window
  if (!isWithinDisputeWindow(order)) {
    return { success: false, error: 'Dispute window has expired (48 hours after delivery)', statusCode: 400 };
  }
  
  const result = await transitionOrderStatus(
    orderId,
    'disputed',
    { id: buyerId, role: 'buyer' },
    { disputeReason: reason }
  );
  
  return result;
}

/**
 * Cancel order with inventory restoration (admin action)
 * This restores inventory for all items in the order
 * 
 * Phase 7B: Handles both legacy and new statuses
 * For 'created'/'pending_payment' orders: Simply cancels (no payment was made)
 * For 'confirmed'/'processing' and beyond: Cancels and marks as 'refunded' since payment was already received
 */
export async function cancelOrderWithInventoryRestore(orderId: string): Promise<{
  success: boolean;
  error?: string;
  restoredItems?: Array<{ productId: string; quantity: number }>;
  refundRequired?: boolean;
}> {
  // Get the order first
  const order = await getOrderById(orderId);
  if (!order) {
    return { success: false, error: 'Order not found' };
  }
  
  const normalized = normalizeOrderStatus(order.status);
  
  // Phase 7B: Cancellable statuses (not completed or already cancelled)
  const cancellableStatuses = ['created', 'confirmed', 'preparing', 'ready_for_pickup', 'out_for_delivery', 'delivered', 'disputed', 'delivery_failed'];
  
  if (!cancellableStatuses.includes(normalized)) {
    return { success: false, error: `Cannot cancel order with status: ${order.status}` };
  }
  
  // Check if a refund is required (order was already paid)
  const refundRequired = order.payment_status === 'paid';
  
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
  // If order was paid, mark payment_status as 'refunded' to indicate refund is required
  if (refundRequired) {
    await updateOrder(orderId, { status: 'cancelled', paymentStatus: 'refunded' });
  } else {
    await updateOrder(orderId, { status: 'cancelled' });
  }
  
  return { success: true, restoredItems, refundRequired };
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
