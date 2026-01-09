import { query, getPool } from '../index';
import crypto from 'crypto';

export interface Coupon {
  id: string;
  vendor_user_id: string;
  code: string;
  name: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  min_order_amount: number;
  usage_limit: number | null;
  usage_count: number;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Sale {
  id: string;
  vendor_user_id: string;
  name: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  product_ids?: string[];
  product_names?: string[];
}

export interface CreateCouponInput {
  vendor_user_id: string;
  code: string;
  name: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  min_order_amount?: number;
  usage_limit?: number;
  starts_at: string;
  ends_at: string;
}

export interface UpdateCouponInput {
  name?: string;
  discount_type?: 'percentage' | 'fixed';
  discount_value?: number;
  min_order_amount?: number;
  usage_limit?: number;
  starts_at?: string;
  ends_at?: string;
  is_active?: boolean;
}

export interface CreateSaleInput {
  vendor_user_id: string;
  product_ids: string[];
  name: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  starts_at: string;
  ends_at: string;
}

export interface UpdateSaleInput {
  name?: string;
  product_ids?: string[];
  discount_type?: 'percentage' | 'fixed';
  discount_value?: number;
  starts_at?: string;
  ends_at?: string;
  is_active?: boolean;
}

function generateId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '').substring(0, 16)}`;
}

export async function getCouponsByVendor(vendorUserId: string): Promise<Coupon[]> {
  const result = await query<Coupon>(
    `SELECT * FROM coupons WHERE vendor_user_id = $1 ORDER BY created_at DESC`,
    [vendorUserId]
  );
  return result.rows.map(row => ({
    ...row,
    is_active: Boolean(row.is_active),
  }));
}

export async function getCouponById(id: string): Promise<Coupon | null> {
  const result = await query<Coupon>(
    `SELECT * FROM coupons WHERE id = $1`,
    [id]
  );
  if (result.rows.length === 0) return null;
  return { ...result.rows[0], is_active: Boolean(result.rows[0].is_active) };
}

export async function getCouponByCode(code: string, vendorUserId?: string): Promise<Coupon | null> {
  let sql = `SELECT * FROM coupons WHERE UPPER(code) = UPPER($1) AND is_active = 1`;
  const params: (string | undefined)[] = [code];
  
  if (vendorUserId) {
    sql += ` AND vendor_user_id = $2`;
    params.push(vendorUserId);
  }
  
  const result = await query<Coupon>(sql, params);
  if (result.rows.length === 0) return null;
  return { ...result.rows[0], is_active: Boolean(result.rows[0].is_active) };
}

export async function getAllCoupons(): Promise<(Coupon & { vendor_name?: string })[]> {
  const result = await query<Coupon & { vendor_name?: string }>(
    `SELECT c.*, u.business_name as vendor_name 
     FROM coupons c 
     LEFT JOIN users u ON c.vendor_user_id = u.id 
     ORDER BY c.created_at DESC`
  );
  return result.rows.map(row => ({
    ...row,
    is_active: Boolean(row.is_active),
  }));
}

export async function createCoupon(input: CreateCouponInput): Promise<Coupon> {
  const id = generateId('coupon');
  const now = new Date().toISOString();
  
  const result = await query<Coupon>(
    `INSERT INTO coupons (id, vendor_user_id, code, name, discount_type, discount_value, 
     min_order_amount, usage_limit, usage_count, starts_at, ends_at, is_active, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, $9, $10, 1, $11, $12)
     RETURNING *`,
    [
      id,
      input.vendor_user_id,
      input.code.toUpperCase(),
      input.name,
      input.discount_type,
      input.discount_value,
      input.min_order_amount || 0,
      input.usage_limit || null,
      input.starts_at,
      input.ends_at,
      now,
      now,
    ]
  );
  
  return { ...result.rows[0], is_active: Boolean(result.rows[0].is_active) };
}

export async function updateCoupon(id: string, vendorUserId: string, input: UpdateCouponInput): Promise<Coupon | null> {
  const updates: string[] = [];
  const values: (string | number | boolean | null)[] = [];
  let paramIndex = 1;

  if (input.name !== undefined) {
    updates.push(`name = $${paramIndex++}`);
    values.push(input.name);
  }
  if (input.discount_type !== undefined) {
    updates.push(`discount_type = $${paramIndex++}`);
    values.push(input.discount_type);
  }
  if (input.discount_value !== undefined) {
    updates.push(`discount_value = $${paramIndex++}`);
    values.push(input.discount_value);
  }
  if (input.min_order_amount !== undefined) {
    updates.push(`min_order_amount = $${paramIndex++}`);
    values.push(input.min_order_amount);
  }
  if (input.usage_limit !== undefined) {
    updates.push(`usage_limit = $${paramIndex++}`);
    values.push(input.usage_limit);
  }
  if (input.starts_at !== undefined) {
    updates.push(`starts_at = $${paramIndex++}`);
    values.push(input.starts_at);
  }
  if (input.ends_at !== undefined) {
    updates.push(`ends_at = $${paramIndex++}`);
    values.push(input.ends_at);
  }
  if (input.is_active !== undefined) {
    updates.push(`is_active = $${paramIndex++}`);
    values.push(input.is_active ? 1 : 0);
  }

  if (updates.length === 0) return null;

  updates.push(`updated_at = $${paramIndex++}`);
  values.push(new Date().toISOString());
  values.push(id);
  values.push(vendorUserId);

  const result = await query<Coupon>(
    `UPDATE coupons SET ${updates.join(', ')} WHERE id = $${paramIndex++} AND vendor_user_id = $${paramIndex} RETURNING *`,
    values
  );

  if (result.rows.length === 0) return null;
  return { ...result.rows[0], is_active: Boolean(result.rows[0].is_active) };
}

export async function deleteCoupon(id: string, vendorUserId: string): Promise<boolean> {
  const result = await query(
    `DELETE FROM coupons WHERE id = $1 AND vendor_user_id = $2`,
    [id, vendorUserId]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function incrementCouponUsage(couponId: string): Promise<void> {
  await query(
    `UPDATE coupons SET usage_count = usage_count + 1, updated_at = $1 WHERE id = $2`,
    [new Date().toISOString(), couponId]
  );
}

export async function validateCoupon(
  code: string,
  orderAmount: number
): Promise<{ valid: boolean; coupon?: Coupon; error?: string; discount?: number }> {
  const now = new Date().toISOString();
  
  const result = await query<Coupon>(
    `SELECT * FROM coupons 
     WHERE UPPER(code) = UPPER($1) 
     AND is_active = 1 
     AND starts_at <= $2 
     AND ends_at >= $2`,
    [code, now]
  );

  if (result.rows.length === 0) {
    return { valid: false, error: 'Invalid or expired coupon code' };
  }

  const coupon = { ...result.rows[0], is_active: Boolean(result.rows[0].is_active) };

  if (coupon.usage_limit && coupon.usage_count >= coupon.usage_limit) {
    return { valid: false, error: 'Coupon usage limit exceeded' };
  }

  if (coupon.min_order_amount && orderAmount < coupon.min_order_amount) {
    return { valid: false, error: `Minimum order amount of GHS ${coupon.min_order_amount} required` };
  }

  let discount = 0;
  if (coupon.discount_type === 'percentage') {
    discount = (orderAmount * coupon.discount_value) / 100;
  } else {
    discount = Math.min(coupon.discount_value, orderAmount);
  }

  return { valid: true, coupon, discount };
}

export async function getSalesByVendor(vendorUserId: string): Promise<Sale[]> {
  const result = await query<Sale & { product_ids_agg?: string; product_names_agg?: string }>(
    `SELECT s.*, 
            COALESCE(STRING_AGG(sp.product_id, ','), '') as product_ids_agg,
            COALESCE(STRING_AGG(p.name, ','), '') as product_names_agg
     FROM sales s 
     LEFT JOIN sale_products sp ON s.id = sp.sale_id
     LEFT JOIN products p ON sp.product_id = p.id 
     WHERE s.vendor_user_id = $1 
     GROUP BY s.id
     ORDER BY s.created_at DESC`,
    [vendorUserId]
  );
  return result.rows.map(row => ({
    ...row,
    is_active: Boolean(row.is_active),
    product_ids: row.product_ids_agg ? row.product_ids_agg.split(',').filter(Boolean) : [],
    product_names: row.product_names_agg ? row.product_names_agg.split(',').filter(Boolean) : [],
  }));
}

export async function getSaleById(id: string): Promise<Sale | null> {
  const result = await query<Sale & { product_ids_agg?: string; product_names_agg?: string }>(
    `SELECT s.*,
            COALESCE(STRING_AGG(sp.product_id, ','), '') as product_ids_agg,
            COALESCE(STRING_AGG(p.name, ','), '') as product_names_agg
     FROM sales s 
     LEFT JOIN sale_products sp ON s.id = sp.sale_id
     LEFT JOIN products p ON sp.product_id = p.id 
     WHERE s.id = $1
     GROUP BY s.id`,
    [id]
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return { 
    ...row, 
    is_active: Boolean(row.is_active),
    product_ids: row.product_ids_agg ? row.product_ids_agg.split(',').filter(Boolean) : [],
    product_names: row.product_names_agg ? row.product_names_agg.split(',').filter(Boolean) : [],
  };
}

export async function getAllSales(): Promise<(Sale & { vendor_name?: string })[]> {
  const result = await query<Sale & { vendor_name?: string; product_ids_agg?: string; product_names_agg?: string }>(
    `SELECT s.*, u.business_name as vendor_name,
            COALESCE(STRING_AGG(sp.product_id, ','), '') as product_ids_agg,
            COALESCE(STRING_AGG(p.name, ','), '') as product_names_agg
     FROM sales s 
     LEFT JOIN users u ON s.vendor_user_id = u.id 
     LEFT JOIN sale_products sp ON s.id = sp.sale_id
     LEFT JOIN products p ON sp.product_id = p.id 
     GROUP BY s.id, u.business_name
     ORDER BY s.created_at DESC`
  );
  return result.rows.map(row => ({
    ...row,
    is_active: Boolean(row.is_active),
    product_ids: row.product_ids_agg ? row.product_ids_agg.split(',').filter(Boolean) : [],
    product_names: row.product_names_agg ? row.product_names_agg.split(',').filter(Boolean) : [],
  }));
}

export async function getActiveSaleByProduct(productId: string): Promise<Sale | null> {
  const now = new Date().toISOString();
  const result = await query<Sale>(
    `SELECT s.* FROM sales s
     INNER JOIN sale_products sp ON s.id = sp.sale_id
     WHERE sp.product_id = $1 
     AND s.is_active = 1 
     AND s.starts_at <= $2 
     AND s.ends_at >= $2
     LIMIT 1`,
    [productId, now]
  );
  if (result.rows.length === 0) return null;
  return { ...result.rows[0], is_active: Boolean(result.rows[0].is_active) };
}

export async function getActiveSalesForProducts(productIds: string[]): Promise<Map<string, Sale>> {
  if (productIds.length === 0) return new Map();
  
  const now = new Date().toISOString();
  const placeholders = productIds.map((_, i) => `$${i + 1}`).join(',');
  
  const result = await query<Sale & { linked_product_id: string }>(
    `SELECT s.*, sp.product_id as linked_product_id 
     FROM sales s
     INNER JOIN sale_products sp ON s.id = sp.sale_id
     WHERE sp.product_id IN (${placeholders})
     AND s.is_active = 1 
     AND s.starts_at <= $${productIds.length + 1}
     AND s.ends_at >= $${productIds.length + 1}`,
    [...productIds, now]
  );
  
  const salesMap = new Map<string, Sale>();
  for (const row of result.rows) {
    salesMap.set(row.linked_product_id, { ...row, is_active: Boolean(row.is_active) });
  }
  return salesMap;
}

export async function createSale(input: CreateSaleInput): Promise<Sale> {
  const pool = getPool();
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const id = generateId('sale');
    const now = new Date().toISOString();
    
    const result = await client.query<Sale>(
      `INSERT INTO sales (id, vendor_user_id, name, discount_type, discount_value, 
       starts_at, ends_at, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 1, $8, $9)
       RETURNING *`,
      [
        id,
        input.vendor_user_id,
        input.name,
        input.discount_type,
        input.discount_value,
        input.starts_at,
        input.ends_at,
        now,
        now,
      ]
    );
    
    for (const productId of input.product_ids) {
      const spId = generateId('sp');
      await client.query(
        `INSERT INTO sale_products (id, sale_id, product_id, created_at) VALUES ($1, $2, $3, $4)`,
        [spId, id, productId, now]
      );
    }
    
    await client.query('COMMIT');
    
    return { 
      ...result.rows[0], 
      is_active: Boolean(result.rows[0].is_active),
      product_ids: input.product_ids,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function updateSale(id: string, vendorUserId: string, input: UpdateSaleInput): Promise<Sale | null> {
  const pool = getPool();
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const updates: string[] = [];
    const values: (string | number | boolean | null)[] = [];
    let paramIndex = 1;

    if (input.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(input.name);
    }
    if (input.discount_type !== undefined) {
      updates.push(`discount_type = $${paramIndex++}`);
      values.push(input.discount_type);
    }
    if (input.discount_value !== undefined) {
      updates.push(`discount_value = $${paramIndex++}`);
      values.push(input.discount_value);
    }
    if (input.starts_at !== undefined) {
      updates.push(`starts_at = $${paramIndex++}`);
      values.push(input.starts_at);
    }
    if (input.ends_at !== undefined) {
      updates.push(`ends_at = $${paramIndex++}`);
      values.push(input.ends_at);
    }
    if (input.is_active !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      values.push(input.is_active ? 1 : 0);
    }

    if (updates.length > 0) {
      updates.push(`updated_at = $${paramIndex++}`);
      values.push(new Date().toISOString());
      values.push(id);
      values.push(vendorUserId);

      const result = await client.query<Sale>(
        `UPDATE sales SET ${updates.join(', ')} WHERE id = $${paramIndex++} AND vendor_user_id = $${paramIndex} RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return null;
      }
    }
    
    if (input.product_ids !== undefined) {
      await client.query(`DELETE FROM sale_products WHERE sale_id = $1`, [id]);
      
      const now = new Date().toISOString();
      for (const productId of input.product_ids) {
        const spId = generateId('sp');
        await client.query(
          `INSERT INTO sale_products (id, sale_id, product_id, created_at) VALUES ($1, $2, $3, $4)`,
          [spId, id, productId, now]
        );
      }
    }
    
    await client.query('COMMIT');
    
    return await getSaleById(id);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteSale(id: string, vendorUserId: string): Promise<boolean> {
  const result = await query(
    `DELETE FROM sales WHERE id = $1 AND vendor_user_id = $2`,
    [id, vendorUserId]
  );
  return (result.rowCount ?? 0) > 0;
}
