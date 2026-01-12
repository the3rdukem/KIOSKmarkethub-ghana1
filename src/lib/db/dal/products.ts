/**
 * Products Data Access Layer
 *
 * Server-side only - provides CRUD operations for products.
 */

import { query } from '../index';
import { v4 as uuidv4 } from 'uuid';

export type ProductStatus = 'active' | 'draft' | 'archived' | 'pending_approval' | 'rejected' | 'suspended';

export interface DbProduct {
  id: string;
  vendor_id: string;
  vendor_name: string;
  name: string;
  description: string | null;
  category: string | null;
  condition: string | null;
  price: number;
  compare_price: number | null;
  cost_per_item: number | null;
  sku: string | null;
  barcode: string | null;
  quantity: number;
  track_quantity: number;
  images: string | null;
  weight: number | null;
  dimensions: string | null;
  tags: string | null;
  status: ProductStatus;
  category_attributes: string | null;
  approval_status: string | null;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  suspended_by: string | null;
  suspended_at: string | null;
  suspension_reason: string | null;
  is_featured: number;
  featured_at: string | null;
  featured_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateProductInput {
  vendorId: string;
  vendorName: string;
  name: string;
  description?: string;
  category?: string;
  condition?: string;
  price: number;
  comparePrice?: number;
  costPerItem?: number;
  sku?: string;
  barcode?: string;
  quantity?: number;
  trackQuantity?: boolean;
  images?: string[];
  weight?: number;
  dimensions?: { length: number; width: number; height: number };
  tags?: string[];
  status?: ProductStatus;
  categoryAttributes?: Record<string, unknown>;
}

export interface UpdateProductInput {
  name?: string;
  description?: string;
  category?: string;
  condition?: string;
  price?: number;
  comparePrice?: number;
  costPerItem?: number;
  sku?: string;
  barcode?: string;
  quantity?: number;
  trackQuantity?: boolean;
  images?: string[];
  weight?: number;
  dimensions?: { length: number; width: number; height: number };
  tags?: string[];
  status?: ProductStatus;
  categoryAttributes?: Record<string, unknown>;
  isFeatured?: boolean;
  featuredBy?: string;
}

/**
 * Create a new product
 */
export async function createProduct(input: CreateProductInput): Promise<DbProduct> {
  const id = `prod_${uuidv4().replace(/-/g, '').substring(0, 16)}`;
  const now = new Date().toISOString();

  // CONDITION REFACTOR: Condition now lives in categoryAttributes only
  // Merge top-level condition into categoryAttributes if provided
  const categoryAttributes = input.categoryAttributes ? { ...input.categoryAttributes } : {};
  if (input.condition) {
    categoryAttributes.condition = input.condition;
  }
  const categoryAttributesJson = Object.keys(categoryAttributes).length > 0 
    ? JSON.stringify(categoryAttributes) 
    : null;

  await query(
    `INSERT INTO products (
      id, vendor_id, vendor_name, name, description, category, price,
      compare_price, cost_per_item, sku, barcode, quantity, track_quantity,
      images, weight, dimensions, tags, status, category_attributes,
      created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)`,
    [
      id,
      input.vendorId,
      input.vendorName,
      input.name,
      input.description || null,
      input.category || null,
      input.price,
      input.comparePrice || null,
      input.costPerItem || null,
      input.sku || null,
      input.barcode || null,
      input.quantity || 0,
      input.trackQuantity !== false ? 1 : 0,
      input.images ? JSON.stringify(input.images) : null,
      input.weight || null,
      input.dimensions ? JSON.stringify(input.dimensions) : null,
      input.tags ? JSON.stringify(input.tags) : null,
      input.status || 'active',
      categoryAttributesJson,
      now,
      now
    ]
  );

  const product = await getProductById(id);
  return product!;
}

/**
 * Get product by ID
 */
export async function getProductById(id: string): Promise<DbProduct | null> {
  const result = await query<DbProduct>('SELECT * FROM products WHERE id = $1', [id]);
  return result.rows[0] || null;
}

/**
 * Get all products
 */
export async function getProducts(options?: {
  vendorId?: string;
  category?: string;
  status?: ProductStatus;
  isFeatured?: boolean;
  limit?: number;
  offset?: number;
  search?: string;
}): Promise<DbProduct[]> {
  let sql = 'SELECT * FROM products WHERE 1=1';
  const params: unknown[] = [];
  let paramIndex = 1;

  if (options?.vendorId) {
    sql += ` AND vendor_id = $${paramIndex++}`;
    params.push(options.vendorId);
  }

  if (options?.category) {
    sql += ` AND category = $${paramIndex++}`;
    params.push(options.category);
  }

  if (options?.status) {
    sql += ` AND status = $${paramIndex++}`;
    params.push(options.status);
  }

  if (options?.isFeatured !== undefined) {
    sql += ` AND is_featured = $${paramIndex++}`;
    params.push(options.isFeatured ? 1 : 0);
  }

  if (options?.search) {
    sql += ` AND (LOWER(name) LIKE $${paramIndex} OR LOWER(description) LIKE $${paramIndex})`;
    const searchTerm = `%${options.search.toLowerCase()}%`;
    params.push(searchTerm);
    paramIndex++;
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

  const result = await query<DbProduct>(sql, params);
  return result.rows;
}

/**
 * Get active products (for storefront)
 */
export async function getActiveProducts(options?: {
  category?: string;
  vendorId?: string;
  limit?: number;
  offset?: number;
}): Promise<DbProduct[]> {
  return getProducts({
    ...options,
    status: 'active',
  });
}

/**
 * Get products by vendor
 */
export async function getProductsByVendor(vendorId: string): Promise<DbProduct[]> {
  return getProducts({ vendorId });
}

/**
 * Get featured products
 */
export async function getFeaturedProducts(limit?: number): Promise<DbProduct[]> {
  return getProducts({ status: 'active', isFeatured: true, limit });
}

/**
 * Update product
 */
export async function updateProduct(id: string, updates: UpdateProductInput): Promise<DbProduct | null> {
  const now = new Date().toISOString();

  const fields: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  fields.push(`updated_at = $${paramIndex++}`);
  values.push(now);

  if (updates.name !== undefined) {
    fields.push(`name = $${paramIndex++}`);
    values.push(updates.name);
  }
  if (updates.description !== undefined) {
    fields.push(`description = $${paramIndex++}`);
    values.push(updates.description);
  }
  if (updates.category !== undefined) {
    fields.push(`category = $${paramIndex++}`);
    values.push(updates.category);
  }
  // CONDITION REFACTOR: condition now lives in categoryAttributes only
  // If condition is passed at top-level, merge into categoryAttributes below
  if (updates.price !== undefined) {
    fields.push(`price = $${paramIndex++}`);
    values.push(updates.price);
  }
  if (updates.comparePrice !== undefined) {
    fields.push(`compare_price = $${paramIndex++}`);
    values.push(updates.comparePrice);
  }
  if (updates.costPerItem !== undefined) {
    fields.push(`cost_per_item = $${paramIndex++}`);
    values.push(updates.costPerItem);
  }
  if (updates.sku !== undefined) {
    fields.push(`sku = $${paramIndex++}`);
    values.push(updates.sku);
  }
  if (updates.barcode !== undefined) {
    fields.push(`barcode = $${paramIndex++}`);
    values.push(updates.barcode);
  }
  if (updates.quantity !== undefined) {
    fields.push(`quantity = $${paramIndex++}`);
    values.push(updates.quantity);
  }
  if (updates.trackQuantity !== undefined) {
    fields.push(`track_quantity = $${paramIndex++}`);
    values.push(updates.trackQuantity ? 1 : 0);
  }
  if (updates.images !== undefined) {
    fields.push(`images = $${paramIndex++}`);
    values.push(JSON.stringify(updates.images));
  }
  if (updates.weight !== undefined) {
    fields.push(`weight = $${paramIndex++}`);
    values.push(updates.weight);
  }
  if (updates.dimensions !== undefined) {
    fields.push(`dimensions = $${paramIndex++}`);
    values.push(JSON.stringify(updates.dimensions));
  }
  if (updates.tags !== undefined) {
    fields.push(`tags = $${paramIndex++}`);
    values.push(JSON.stringify(updates.tags));
  }
  if (updates.status !== undefined) {
    fields.push(`status = $${paramIndex++}`);
    values.push(updates.status);
  }
  if (updates.categoryAttributes !== undefined || updates.condition !== undefined) {
    // CONDITION REFACTOR: Merge condition into categoryAttributes
    const categoryAttrs = updates.categoryAttributes ? { ...updates.categoryAttributes } : {};
    if (updates.condition !== undefined) {
      categoryAttrs.condition = updates.condition;
    }
    fields.push(`category_attributes = $${paramIndex++}`);
    values.push(Object.keys(categoryAttrs).length > 0 ? JSON.stringify(categoryAttrs) : null);
  }
  if (updates.isFeatured !== undefined) {
    fields.push(`is_featured = $${paramIndex++}`);
    values.push(updates.isFeatured ? 1 : 0);
    if (updates.isFeatured) {
      fields.push(`featured_at = $${paramIndex++}`);
      values.push(now);
      if (updates.featuredBy) {
        fields.push(`featured_by = $${paramIndex++}`);
        values.push(updates.featuredBy);
      }
    } else {
      fields.push('featured_at = NULL');
      fields.push('featured_by = NULL');
    }
  }

  values.push(id);

  const result = await query(
    `UPDATE products SET ${fields.join(', ')} WHERE id = $${paramIndex}`,
    values
  );

  if ((result.rowCount ?? 0) === 0) return null;
  return getProductById(id);
}

/**
 * Delete product
 */
export async function deleteProduct(id: string): Promise<boolean> {
  const result = await query('DELETE FROM products WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
}

/**
 * Reduce product inventory
 */
export async function reduceInventory(id: string, quantity: number): Promise<boolean> {
  const product = await getProductById(id);

  if (!product) return false;
  if (product.track_quantity && product.quantity < quantity) return false;

  if (product.track_quantity) {
    await query(
      `UPDATE products SET quantity = quantity - $1, updated_at = $2 WHERE id = $3`,
      [quantity, new Date().toISOString(), id]
    );
  }

  return true;
}

/**
 * Restore product inventory (for payment failure / order cancellation)
 */
export async function restoreInventory(id: string, quantity: number): Promise<boolean> {
  const product = await getProductById(id);

  if (!product) return false;

  if (product.track_quantity) {
    await query(
      `UPDATE products SET quantity = quantity + $1, updated_at = $2 WHERE id = $3`,
      [quantity, new Date().toISOString(), id]
    );
  }

  return true;
}

/**
 * Search products
 */
export async function searchProducts(searchQuery: string, options?: {
  category?: string;
  status?: ProductStatus;
  limit?: number;
}): Promise<DbProduct[]> {
  const searchTerm = `%${searchQuery.toLowerCase()}%`;
  let paramIndex = 1;

  let sql = `
    SELECT * FROM products
    WHERE status = $${paramIndex++}
    AND (
      LOWER(name) LIKE $${paramIndex}
      OR LOWER(description) LIKE $${paramIndex}
      OR tags LIKE $${paramIndex}
    )
  `;

  const params: unknown[] = [
    options?.status || 'active',
    searchTerm,
  ];
  paramIndex++;

  if (options?.category) {
    sql += ` AND category = $${paramIndex++}`;
    params.push(options.category);
  }

  sql += ' ORDER BY name ASC';

  if (options?.limit) {
    sql += ` LIMIT $${paramIndex++}`;
    params.push(options.limit);
  }

  const result = await query<DbProduct>(sql, params);
  return result.rows;
}

/**
 * Get product stats
 */
export async function getProductStats(vendorId?: string): Promise<{
  totalProducts: number;
  activeProducts: number;
  draftProducts: number;
  pendingProducts: number;
  featuredProducts: number;
}> {
  let whereClause = '';
  const params: unknown[] = [];

  if (vendorId) {
    whereClause = ' WHERE vendor_id = $1';
    params.push(vendorId);
  }

  const result = await query<{
    totalproducts: string;
    activeproducts: string;
    draftproducts: string;
    pendingproducts: string;
    featuredproducts: string;
  }>(
    `SELECT
      COUNT(*) as totalproducts,
      SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as activeproducts,
      SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draftproducts,
      SUM(CASE WHEN status = 'pending_approval' THEN 1 ELSE 0 END) as pendingproducts,
      SUM(CASE WHEN is_featured = 1 AND status = 'active' THEN 1 ELSE 0 END) as featuredproducts
    FROM products${whereClause}`,
    params
  );

  const row = result.rows[0];

  return {
    totalProducts: parseInt(row?.totalproducts || '0'),
    activeProducts: parseInt(row?.activeproducts || '0'),
    draftProducts: parseInt(row?.draftproducts || '0'),
    pendingProducts: parseInt(row?.pendingproducts || '0'),
    featuredProducts: parseInt(row?.featuredproducts || '0'),
  };
}

/**
 * Suspend product
 */
export async function suspendProduct(id: string, suspendedBy: string, reason: string): Promise<boolean> {
  const now = new Date().toISOString();

  const result = await query(
    `UPDATE products SET
      status = 'suspended',
      suspended_by = $1,
      suspended_at = $2,
      suspension_reason = $3,
      updated_at = $4
    WHERE id = $5`,
    [suspendedBy, now, reason, now, id]
  );

  return (result.rowCount ?? 0) > 0;
}

/**
 * Unsuspend product
 */
export async function unsuspendProduct(id: string): Promise<boolean> {
  const now = new Date().toISOString();

  const result = await query(
    `UPDATE products SET
      status = 'active',
      suspended_by = NULL,
      suspended_at = NULL,
      suspension_reason = NULL,
      updated_at = $1
    WHERE id = $2`,
    [now, id]
  );

  return (result.rowCount ?? 0) > 0;
}
