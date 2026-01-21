import { query } from '../index';

export interface StaticPage {
  id: string;
  slug: string;
  title: string;
  content: string;
  meta_title: string | null;
  meta_description: string | null;
  is_published: boolean;
  show_in_footer: boolean;
  show_in_header: boolean;
  order_index: number;
  created_by: string | null;
  updated_by: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateStaticPageInput {
  slug: string;
  title: string;
  content: string;
  metaTitle?: string;
  metaDescription?: string;
  isPublished?: boolean;
  showInFooter?: boolean;
  showInHeader?: boolean;
  orderIndex?: number;
  createdBy?: string;
}

export interface UpdateStaticPageInput {
  slug?: string;
  title?: string;
  content?: string;
  metaTitle?: string;
  metaDescription?: string;
  isPublished?: boolean;
  showInFooter?: boolean;
  showInHeader?: boolean;
  orderIndex?: number;
  updatedBy?: string;
}

function generateId(): string {
  return `page_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
}

export async function createStaticPage(input: CreateStaticPageInput): Promise<StaticPage> {
  const id = generateId();
  const now = new Date().toISOString();
  
  const result = await query<StaticPage>(
    `INSERT INTO static_pages (
      id, slug, title, content, meta_title, meta_description,
      is_published, show_in_footer, show_in_header, order_index,
      created_by, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12)
    RETURNING *`,
    [
      id,
      input.slug,
      input.title,
      input.content,
      input.metaTitle ?? null,
      input.metaDescription ?? null,
      input.isPublished ?? false,
      input.showInFooter ?? false,
      input.showInHeader ?? false,
      input.orderIndex ?? 0,
      input.createdBy ?? null,
      now
    ]
  );
  
  return mapRow(result.rows[0]);
}

export async function getStaticPageById(id: string): Promise<StaticPage | null> {
  const result = await query<StaticPage>(
    'SELECT * FROM static_pages WHERE id = $1',
    [id]
  );
  return result.rows[0] ? mapRow(result.rows[0]) : null;
}

export async function getStaticPageBySlug(slug: string): Promise<StaticPage | null> {
  const result = await query<StaticPage>(
    'SELECT * FROM static_pages WHERE slug = $1',
    [slug]
  );
  return result.rows[0] ? mapRow(result.rows[0]) : null;
}

export async function getPublishedPageBySlug(slug: string): Promise<StaticPage | null> {
  const result = await query<StaticPage>(
    'SELECT * FROM static_pages WHERE slug = $1 AND is_published = true',
    [slug]
  );
  return result.rows[0] ? mapRow(result.rows[0]) : null;
}

export async function getAllStaticPages(): Promise<StaticPage[]> {
  const result = await query<StaticPage>(
    'SELECT * FROM static_pages ORDER BY order_index ASC, created_at DESC'
  );
  return result.rows.map(mapRow);
}

export async function getPublishedStaticPages(): Promise<StaticPage[]> {
  const result = await query<StaticPage>(
    'SELECT * FROM static_pages WHERE is_published = true ORDER BY order_index ASC'
  );
  return result.rows.map(mapRow);
}

export async function getFooterPages(): Promise<StaticPage[]> {
  const result = await query<StaticPage>(
    'SELECT * FROM static_pages WHERE is_published = true AND show_in_footer = true ORDER BY order_index ASC'
  );
  return result.rows.map(mapRow);
}

export async function getHeaderPages(): Promise<StaticPage[]> {
  const result = await query<StaticPage>(
    'SELECT * FROM static_pages WHERE is_published = true AND show_in_header = true ORDER BY order_index ASC'
  );
  return result.rows.map(mapRow);
}

export async function updateStaticPage(
  id: string,
  input: UpdateStaticPageInput
): Promise<StaticPage | null> {
  const fields: string[] = [];
  const values: (string | number | boolean | null)[] = [];
  let paramIndex = 1;

  if (input.slug !== undefined) {
    fields.push(`slug = $${paramIndex++}`);
    values.push(input.slug);
  }
  if (input.title !== undefined) {
    fields.push(`title = $${paramIndex++}`);
    values.push(input.title);
  }
  if (input.content !== undefined) {
    fields.push(`content = $${paramIndex++}`);
    values.push(input.content);
  }
  if (input.metaTitle !== undefined) {
    fields.push(`meta_title = $${paramIndex++}`);
    values.push(input.metaTitle);
  }
  if (input.metaDescription !== undefined) {
    fields.push(`meta_description = $${paramIndex++}`);
    values.push(input.metaDescription);
  }
  if (input.isPublished !== undefined) {
    fields.push(`is_published = $${paramIndex++}`);
    values.push(input.isPublished);
    if (input.isPublished) {
      fields.push(`published_at = NOW()`);
    }
  }
  if (input.showInFooter !== undefined) {
    fields.push(`show_in_footer = $${paramIndex++}`);
    values.push(input.showInFooter);
  }
  if (input.showInHeader !== undefined) {
    fields.push(`show_in_header = $${paramIndex++}`);
    values.push(input.showInHeader);
  }
  if (input.orderIndex !== undefined) {
    fields.push(`order_index = $${paramIndex++}`);
    values.push(input.orderIndex);
  }
  if (input.updatedBy !== undefined) {
    fields.push(`updated_by = $${paramIndex++}`);
    values.push(input.updatedBy);
  }

  if (fields.length === 0) return getStaticPageById(id);

  fields.push(`updated_at = NOW()`);
  values.push(id);

  const result = await query<StaticPage>(
    `UPDATE static_pages SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  );

  return result.rows[0] ? mapRow(result.rows[0]) : null;
}

export async function deleteStaticPage(id: string): Promise<boolean> {
  const result = await query(
    'DELETE FROM static_pages WHERE id = $1',
    [id]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function publishStaticPage(id: string, updatedBy?: string): Promise<StaticPage | null> {
  return updateStaticPage(id, { isPublished: true, updatedBy });
}

export async function unpublishStaticPage(id: string, updatedBy?: string): Promise<StaticPage | null> {
  return updateStaticPage(id, { isPublished: false, updatedBy });
}

function mapRow(row: StaticPage): StaticPage {
  return {
    ...row,
    is_published: Boolean(row.is_published),
    show_in_footer: Boolean(row.show_in_footer),
    show_in_header: Boolean(row.show_in_header),
  };
}
