/**
 * Categories Data Access Layer
 *
 * Schema-driven categories with dynamic form fields.
 * Each category has a formSchema that defines product fields.
 */

import { query } from '../index';
import { v4 as uuidv4 } from 'uuid';

export interface CategoryFormField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'multi_select' | 'boolean' | 'date' | 'textarea' | 'dependent_select';
  required: boolean;
  placeholder?: string;
  helpText?: string;
  options?: string[];
  min?: number;
  max?: number;
  dependsOn?: string;
  optionsSource?: 'static' | 'dynamic';
  level?: 1 | 2 | 3;
  childFieldKey?: string;
}

export interface DbCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  image_url: string | null;
  parent_id: string | null;
  is_active: number;
  show_in_menu: number;
  show_in_home: number;
  display_order: number;
  form_schema: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateCategoryInput {
  name: string;
  slug?: string;
  description?: string;
  icon?: string;
  imageUrl?: string;
  parentId?: string;
  isActive?: boolean;
  showInMenu?: boolean;
  showInHome?: boolean;
  displayOrder?: number;
  formSchema?: CategoryFormField[];
  createdBy?: string;
}

export interface UpdateCategoryInput {
  name?: string;
  slug?: string;
  description?: string;
  icon?: string;
  imageUrl?: string;
  parentId?: string | null;
  isActive?: boolean;
  showInMenu?: boolean;
  showInHome?: boolean;
  displayOrder?: number;
  formSchema?: CategoryFormField[];
}

/**
 * Generate slug from name
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .trim();
}

/**
 * Create a new category
 */
export async function createCategory(input: CreateCategoryInput): Promise<DbCategory> {
  const id = `cat_${uuidv4().replace(/-/g, '').substring(0, 16)}`;
  const slug = input.slug || generateSlug(input.name);
  const now = new Date().toISOString();

  // Get max display order if not provided
  let displayOrder = input.displayOrder;
  if (displayOrder === undefined) {
    const maxOrderResult = await query<{ max: number | null }>('SELECT MAX(display_order) as max FROM categories');
    const maxOrder = maxOrderResult.rows[0];
    displayOrder = (maxOrder?.max || 0) + 1;
  }

  await query(`
    INSERT INTO categories (
      id, name, slug, description, icon, image_url, parent_id,
      is_active, show_in_menu, show_in_home, display_order,
      form_schema, created_by, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
  `, [
    id,
    input.name,
    slug,
    input.description || null,
    input.icon || null,
    input.imageUrl || null,
    input.parentId || null,
    input.isActive !== false ? 1 : 0,
    input.showInMenu !== false ? 1 : 0,
    input.showInHome !== false ? 1 : 0,
    displayOrder,
    input.formSchema ? JSON.stringify(input.formSchema) : null,
    input.createdBy || null,
    now,
    now
  ]);

  const category = await getCategoryById(id);
  if (!category) throw new Error('Failed to create category');
  return category;
}

/**
 * Get category by ID
 */
export async function getCategoryById(id: string): Promise<DbCategory | null> {
  const result = await query<DbCategory & Record<string, unknown>>('SELECT * FROM categories WHERE id = $1', [id]);
  return result.rows[0] || null;
}

/**
 * Get category by slug
 */
export async function getCategoryBySlug(slug: string): Promise<DbCategory | null> {
  const result = await query<DbCategory & Record<string, unknown>>('SELECT * FROM categories WHERE slug = $1', [slug]);
  return result.rows[0] || null;
}

/**
 * Get all categories
 */
export async function getCategories(options?: {
  isActive?: boolean;
  showInMenu?: boolean;
  showInHome?: boolean;
  parentId?: string | null;
}): Promise<DbCategory[]> {
  let sql = 'SELECT * FROM categories WHERE 1=1';
  const params: unknown[] = [];
  let paramCount = 1;

  if (options?.isActive !== undefined) {
    sql += ` AND is_active = $${paramCount++}`;
    params.push(options.isActive ? 1 : 0);
  }

  if (options?.showInMenu !== undefined) {
    sql += ` AND show_in_menu = $${paramCount++}`;
    params.push(options.showInMenu ? 1 : 0);
  }

  if (options?.showInHome !== undefined) {
    sql += ` AND show_in_home = $${paramCount++}`;
    params.push(options.showInHome ? 1 : 0);
  }

  if (options?.parentId !== undefined) {
    if (options.parentId === null) {
      sql += ' AND parent_id IS NULL';
    } else {
      sql += ` AND parent_id = $${paramCount++}`;
      params.push(options.parentId);
    }
  }

  sql += ' ORDER BY display_order ASC, name ASC';

  const result = await query<DbCategory & Record<string, unknown>>(sql, params);
  return result.rows;
}

/**
 * Get active categories (for dropdowns)
 */
export async function getActiveCategories(): Promise<DbCategory[]> {
  return getCategories({ isActive: true });
}

/**
 * Get menu categories
 */
export async function getMenuCategories(): Promise<DbCategory[]> {
  return getCategories({ isActive: true, showInMenu: true });
}

/**
 * Get home page categories
 */
export async function getHomeCategories(): Promise<DbCategory[]> {
  return getCategories({ isActive: true, showInHome: true });
}

/**
 * Get child categories
 */
export async function getChildCategories(parentId: string): Promise<DbCategory[]> {
  return getCategories({ isActive: true, parentId });
}

/**
 * Update category
 */
export async function updateCategory(id: string, updates: UpdateCategoryInput): Promise<DbCategory | null> {
  const now = new Date().toISOString();

  const fields: string[] = ['updated_at = $1'];
  const values: unknown[] = [now];
  let paramCount = 2;

  if (updates.name !== undefined) {
    fields.push(`name = $${paramCount++}`);
    values.push(updates.name);
  }
  if (updates.slug !== undefined) {
    fields.push(`slug = $${paramCount++}`);
    values.push(updates.slug);
  }
  if (updates.description !== undefined) {
    fields.push(`description = $${paramCount++}`);
    values.push(updates.description);
  }
  if (updates.icon !== undefined) {
    fields.push(`icon = $${paramCount++}`);
    values.push(updates.icon);
  }
  if (updates.imageUrl !== undefined) {
    fields.push(`image_url = $${paramCount++}`);
    values.push(updates.imageUrl);
  }
  if (updates.parentId !== undefined) {
    fields.push(`parent_id = $${paramCount++}`);
    values.push(updates.parentId);
  }
  if (updates.isActive !== undefined) {
    fields.push(`is_active = $${paramCount++}`);
    values.push(updates.isActive ? 1 : 0);
  }
  if (updates.showInMenu !== undefined) {
    fields.push(`show_in_menu = $${paramCount++}`);
    values.push(updates.showInMenu ? 1 : 0);
  }
  if (updates.showInHome !== undefined) {
    fields.push(`show_in_home = $${paramCount++}`);
    values.push(updates.showInHome ? 1 : 0);
  }
  if (updates.displayOrder !== undefined) {
    fields.push(`display_order = $${paramCount++}`);
    values.push(updates.displayOrder);
  }
  if (updates.formSchema !== undefined) {
    fields.push(`form_schema = $${paramCount++}`);
    values.push(JSON.stringify(updates.formSchema));
  }

  const idParamIndex = paramCount;
  values.push(id);

  const result = await query(`UPDATE categories SET ${fields.join(', ')} WHERE id = $${idParamIndex}`, values);

  if ((result.rowCount ?? 0) === 0) return null;
  return getCategoryById(id);
}

/**
 * Delete category
 * Returns false if category has products or children
 */
export async function deleteCategory(id: string, force: boolean = false): Promise<{ success: boolean; error?: string }> {
  // Check for child categories
  const childrenResult = await query<{ count: string }>('SELECT COUNT(*) as count FROM categories WHERE parent_id = $1', [id]);
  const children = { count: parseInt(childrenResult.rows[0]?.count || '0') };
  if (children.count > 0 && !force) {
    return { success: false, error: 'Category has child categories' };
  }

  // Check for products
  const productsResult = await query<{ count: string }>('SELECT COUNT(*) as count FROM products WHERE category_id = $1', [id]);
  const products = { count: parseInt(productsResult.rows[0]?.count || '0') };
  if (products.count > 0 && !force) {
    return { success: false, error: 'Category has associated products' };
  }

  const result = await query('DELETE FROM categories WHERE id = $1', [id]);

  return { success: (result.rowCount ?? 0) > 0 };
}

/**
 * Reorder categories
 */
export async function reorderCategories(categoryIds: string[]): Promise<void> {
  const now = new Date().toISOString();

  for (let i = 0; i < categoryIds.length; i++) {
    await query('UPDATE categories SET display_order = $1, updated_at = $2 WHERE id = $3', [i + 1, now, categoryIds[i]]);
  }
}

/**
 * Get category form schema
 */
export async function getCategoryFormSchema(categoryId: string): Promise<CategoryFormField[]> {
  const category = await getCategoryById(categoryId);
  if (!category || !category.form_schema) return [];

  try {
    return JSON.parse(category.form_schema) as CategoryFormField[];
  } catch {
    return [];
  }
}

/**
 * Get category form schema by slug or name
 */
export async function getCategoryFormSchemaByName(nameOrSlug: string): Promise<CategoryFormField[]> {
  const result = await query<{ form_schema: string | null }>(`
    SELECT form_schema FROM categories
    WHERE (slug = $1 OR name = $2) AND is_active = 1
  `, [nameOrSlug, nameOrSlug]);

  const category = result.rows[0];
  if (!category || !category.form_schema) return [];

  try {
    return JSON.parse(category.form_schema) as CategoryFormField[];
  } catch {
    return [];
  }
}

/**
 * Get category names (for legacy compatibility)
 */
export async function getCategoryNames(): Promise<string[]> {
  const categories = await getActiveCategories();
  return categories.map(c => c.name);
}

/**
 * Get category statistics
 */
export async function getCategoryStats(): Promise<{
  total: number;
  active: number;
  inactive: number;
}> {
  const result = await query<{ total: string; active: string; inactive: string }>(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active,
      SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) as inactive
    FROM categories
  `);

  const stats = result.rows[0];
  return {
    total: parseInt(stats?.total || '0'),
    active: parseInt(stats?.active || '0'),
    inactive: parseInt(stats?.inactive || '0'),
  };
}
