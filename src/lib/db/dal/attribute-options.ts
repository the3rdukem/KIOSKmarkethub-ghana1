/**
 * Attribute Options Data Access Layer
 *
 * Manages hierarchical attribute options for cascading filters.
 * Supports 3-level dependencies: Level 1 → Level 2 → Level 3
 * Example: Make → Model → Trim (Vehicles), Brand → Model → Variant (Mobile)
 */

import { query } from '../index';
import { v4 as uuidv4 } from 'uuid';

export interface DbAttributeOption {
  id: string;
  category_id: string;
  field_key: string;
  value: string;
  parent_option_id: string | null;
  level: number;
  display_order: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface AttributeOption {
  id: string;
  categoryId: string;
  fieldKey: string;
  value: string;
  parentOptionId: string | null;
  level: number;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  children?: AttributeOption[];
}

export interface CreateAttributeOptionInput {
  categoryId: string;
  fieldKey: string;
  value: string;
  parentOptionId?: string | null;
  level?: number;
  displayOrder?: number;
  isActive?: boolean;
}

export interface UpdateAttributeOptionInput {
  value?: string;
  parentOptionId?: string | null;
  displayOrder?: number;
  isActive?: boolean;
}

function mapDbToAttributeOption(db: DbAttributeOption): AttributeOption {
  return {
    id: db.id,
    categoryId: db.category_id,
    fieldKey: db.field_key,
    value: db.value,
    parentOptionId: db.parent_option_id,
    level: db.level,
    displayOrder: db.display_order,
    isActive: db.is_active === 1,
    createdAt: db.created_at,
    updatedAt: db.updated_at,
  };
}

/**
 * Create a new attribute option
 */
export async function createAttributeOption(input: CreateAttributeOptionInput): Promise<AttributeOption> {
  const id = `opt_${uuidv4().replace(/-/g, '').substring(0, 16)}`;
  const now = new Date().toISOString();

  let level = input.level || 1;
  if (input.parentOptionId && !input.level) {
    const parent = await getAttributeOptionById(input.parentOptionId);
    if (parent) {
      level = parent.level + 1;
    }
  }

  if (level > 3) {
    throw new Error('Maximum 3 levels of attribute hierarchy supported');
  }

  let displayOrder = input.displayOrder;
  if (displayOrder === undefined) {
    const maxResult = await query<{ max: number | null }>(
      `SELECT MAX(display_order) as max FROM attribute_options 
       WHERE category_id = $1 AND field_key = $2 AND COALESCE(parent_option_id, '') = COALESCE($3, '')`,
      [input.categoryId, input.fieldKey, input.parentOptionId || null]
    );
    displayOrder = (maxResult.rows[0]?.max || 0) + 1;
  }

  await query(
    `INSERT INTO attribute_options 
     (id, category_id, field_key, value, parent_option_id, level, display_order, is_active, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      id,
      input.categoryId,
      input.fieldKey,
      input.value,
      input.parentOptionId || null,
      level,
      displayOrder,
      input.isActive !== false ? 1 : 0,
      now,
      now,
    ]
  );

  return {
    id,
    categoryId: input.categoryId,
    fieldKey: input.fieldKey,
    value: input.value,
    parentOptionId: input.parentOptionId || null,
    level,
    displayOrder,
    isActive: input.isActive !== false,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Create multiple attribute options in batch (for seeding/import)
 */
export async function createAttributeOptionsBatch(
  options: CreateAttributeOptionInput[]
): Promise<AttributeOption[]> {
  const results: AttributeOption[] = [];
  for (const opt of options) {
    results.push(await createAttributeOption(opt));
  }
  return results;
}

/**
 * Get attribute option by ID
 */
export async function getAttributeOptionById(id: string): Promise<AttributeOption | null> {
  const result = await query<DbAttributeOption>(
    'SELECT * FROM attribute_options WHERE id = $1',
    [id]
  );
  if (result.rows.length === 0) return null;
  return mapDbToAttributeOption(result.rows[0]);
}

/**
 * Get all options for a category field (level 1 only - root options)
 */
export async function getRootOptions(
  categoryId: string,
  fieldKey: string
): Promise<AttributeOption[]> {
  const result = await query<DbAttributeOption>(
    `SELECT * FROM attribute_options 
     WHERE category_id = $1 AND field_key = $2 AND parent_option_id IS NULL AND is_active = 1
     ORDER BY display_order, value`,
    [categoryId, fieldKey]
  );
  return result.rows.map(mapDbToAttributeOption);
}

/**
 * Get child options for a parent option
 */
export async function getChildOptions(parentOptionId: string): Promise<AttributeOption[]> {
  const result = await query<DbAttributeOption>(
    `SELECT * FROM attribute_options 
     WHERE parent_option_id = $1 AND is_active = 1
     ORDER BY display_order, value`,
    [parentOptionId]
  );
  return result.rows.map(mapDbToAttributeOption);
}

/**
 * Get options by parent value (for product forms/filters)
 * Finds the parent option by value and returns its children
 */
export async function getChildOptionsByParentValue(
  categoryId: string,
  parentFieldKey: string,
  parentValue: string,
  childFieldKey: string
): Promise<AttributeOption[]> {
  const result = await query<DbAttributeOption>(
    `SELECT child.* FROM attribute_options child
     INNER JOIN attribute_options parent ON child.parent_option_id = parent.id
     WHERE parent.category_id = $1 
       AND parent.field_key = $2 
       AND parent.value = $3
       AND child.field_key = $4
       AND child.is_active = 1
     ORDER BY child.display_order, child.value`,
    [categoryId, parentFieldKey, parentValue, childFieldKey]
  );
  return result.rows.map(mapDbToAttributeOption);
}

/**
 * Get all options for a category (including inactive, for admin)
 */
export async function getAllCategoryOptions(
  categoryId: string,
  includeInactive: boolean = false
): Promise<AttributeOption[]> {
  const activeClause = includeInactive ? '' : 'AND is_active = 1';
  const result = await query<DbAttributeOption>(
    `SELECT * FROM attribute_options 
     WHERE category_id = $1 ${activeClause}
     ORDER BY field_key, level, display_order, value`,
    [categoryId]
  );
  return result.rows.map(mapDbToAttributeOption);
}

/**
 * Get all options for a specific field (including children hierarchy)
 */
export async function getFieldOptionsHierarchy(
  categoryId: string,
  fieldKey: string,
  includeInactive: boolean = false
): Promise<AttributeOption[]> {
  const activeClause = includeInactive ? '' : 'AND is_active = 1';
  const result = await query<DbAttributeOption>(
    `SELECT * FROM attribute_options 
     WHERE category_id = $1 AND (field_key = $2 OR parent_option_id IN (
       SELECT id FROM attribute_options WHERE category_id = $1 AND field_key = $2
     )) ${activeClause}
     ORDER BY level, display_order, value`,
    [categoryId, fieldKey]
  );
  return result.rows.map(mapDbToAttributeOption);
}

/**
 * Build a tree structure from flat options list
 */
export function buildOptionsTree(options: AttributeOption[]): AttributeOption[] {
  const optionMap = new Map<string, AttributeOption>();
  const roots: AttributeOption[] = [];

  options.forEach(opt => {
    optionMap.set(opt.id, { ...opt, children: [] });
  });

  options.forEach(opt => {
    const mapped = optionMap.get(opt.id)!;
    if (opt.parentOptionId && optionMap.has(opt.parentOptionId)) {
      const parent = optionMap.get(opt.parentOptionId)!;
      parent.children = parent.children || [];
      parent.children.push(mapped);
    } else if (!opt.parentOptionId) {
      roots.push(mapped);
    }
  });

  return roots;
}

/**
 * Update an attribute option
 */
export async function updateAttributeOption(
  id: string,
  updates: UpdateAttributeOptionInput
): Promise<AttributeOption | null> {
  const setClauses: string[] = ['updated_at = NOW()'];
  const values: (string | number | null)[] = [];
  let paramIndex = 1;

  if (updates.value !== undefined) {
    setClauses.push(`value = $${paramIndex++}`);
    values.push(updates.value);
  }
  if (updates.parentOptionId !== undefined) {
    setClauses.push(`parent_option_id = $${paramIndex++}`);
    values.push(updates.parentOptionId);
  }
  if (updates.displayOrder !== undefined) {
    setClauses.push(`display_order = $${paramIndex++}`);
    values.push(updates.displayOrder);
  }
  if (updates.isActive !== undefined) {
    setClauses.push(`is_active = $${paramIndex++}`);
    values.push(updates.isActive ? 1 : 0);
  }

  values.push(id);

  await query(
    `UPDATE attribute_options SET ${setClauses.join(', ')} WHERE id = $${paramIndex}`,
    values
  );

  return getAttributeOptionById(id);
}

/**
 * Delete an attribute option (cascades to children)
 */
export async function deleteAttributeOption(id: string): Promise<boolean> {
  const result = await query(
    'DELETE FROM attribute_options WHERE id = $1',
    [id]
  );
  return (result.rowCount ?? 0) > 0;
}

/**
 * Delete all options for a category field
 */
export async function deleteFieldOptions(
  categoryId: string,
  fieldKey: string
): Promise<number> {
  const result = await query(
    'DELETE FROM attribute_options WHERE category_id = $1 AND field_key = $2',
    [categoryId, fieldKey]
  );
  return result.rowCount ?? 0;
}

/**
 * Reorder options at the same level
 */
export async function reorderOptions(optionIds: string[]): Promise<void> {
  for (let i = 0; i < optionIds.length; i++) {
    await query(
      'UPDATE attribute_options SET display_order = $1, updated_at = NOW() WHERE id = $2',
      [i + 1, optionIds[i]]
    );
  }
}

/**
 * Get dependent field configuration for a category
 * Returns which fields depend on which
 */
export async function getDependentFieldsConfig(categoryId: string): Promise<{
  fieldKey: string;
  level: number;
  parentFieldKey: string | null;
  optionCount: number;
}[]> {
  const result = await query<{
    field_key: string;
    level: number;
    option_count: string;
  }>(
    `SELECT field_key, level, COUNT(*) as option_count
     FROM attribute_options 
     WHERE category_id = $1 AND is_active = 1
     GROUP BY field_key, level
     ORDER BY level, field_key`,
    [categoryId]
  );

  return result.rows.map(row => ({
    fieldKey: row.field_key,
    level: row.level,
    parentFieldKey: null,
    optionCount: parseInt(row.option_count),
  }));
}

/**
 * Check if a field has dynamic options configured
 */
export async function hasFieldOptions(
  categoryId: string,
  fieldKey: string
): Promise<boolean> {
  const result = await query<{ count: string }>(
    'SELECT COUNT(*) as count FROM attribute_options WHERE category_id = $1 AND field_key = $2',
    [categoryId, fieldKey]
  );
  return parseInt(result.rows[0].count) > 0;
}

/**
 * Import options from a flat array with parent references
 * Useful for bulk importing data
 */
export async function importOptionsHierarchy(
  categoryId: string,
  options: Array<{
    fieldKey: string;
    value: string;
    parentValue?: string;
    parentFieldKey?: string;
  }>
): Promise<{ created: number; errors: string[] }> {
  const created: AttributeOption[] = [];
  const errors: string[] = [];

  for (const opt of options) {
    try {
      let parentOptionId: string | null = null;
      let level = 1;

      if (opt.parentValue && opt.parentFieldKey) {
        const parentResult = await query<DbAttributeOption>(
          `SELECT id, level FROM attribute_options 
           WHERE category_id = $1 AND field_key = $2 AND value = $3`,
          [categoryId, opt.parentFieldKey, opt.parentValue]
        );
        if (parentResult.rows.length > 0) {
          parentOptionId = parentResult.rows[0].id;
          level = parentResult.rows[0].level + 1;
        } else {
          errors.push(`Parent not found: ${opt.parentFieldKey}=${opt.parentValue} for ${opt.value}`);
          continue;
        }
      }

      const existingResult = await query<DbAttributeOption>(
        `SELECT id FROM attribute_options 
         WHERE category_id = $1 AND field_key = $2 AND value = $3 AND COALESCE(parent_option_id, '') = COALESCE($4, '')`,
        [categoryId, opt.fieldKey, opt.value, parentOptionId]
      );

      if (existingResult.rows.length === 0) {
        const newOpt = await createAttributeOption({
          categoryId,
          fieldKey: opt.fieldKey,
          value: opt.value,
          parentOptionId,
          level,
        });
        created.push(newOpt);
      }
    } catch (e) {
      errors.push(`Error creating option ${opt.value}: ${e}`);
    }
  }

  return { created: created.length, errors };
}
