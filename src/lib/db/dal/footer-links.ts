import { query } from '../index';

export interface FooterLink {
  id: string;
  section: string;
  title: string;
  url: string;
  order_num: number;
  is_visible: boolean;
  is_external: boolean;
  created_at: string;
  updated_at: string;
}

export async function getAllFooterLinks(): Promise<FooterLink[]> {
  const result = await query<FooterLink>(
    `SELECT * FROM footer_links ORDER BY section, order_num`
  );
  return result.rows;
}

export async function getVisibleFooterLinks(): Promise<FooterLink[]> {
  const result = await query<FooterLink>(
    `SELECT * FROM footer_links WHERE is_visible = true ORDER BY section, order_num`
  );
  return result.rows;
}

export async function getFooterLinksBySection(section: string): Promise<FooterLink[]> {
  const result = await query<FooterLink>(
    `SELECT * FROM footer_links WHERE section = $1 ORDER BY order_num`,
    [section]
  );
  return result.rows;
}

export async function createFooterLink(link: Omit<FooterLink, 'id' | 'created_at' | 'updated_at'>): Promise<FooterLink> {
  const id = `fl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const result = await query<FooterLink>(
    `INSERT INTO footer_links (id, section, title, url, order_num, is_visible, is_external, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
     RETURNING *`,
    [id, link.section, link.title, link.url, link.order_num, link.is_visible, link.is_external]
  );
  return result.rows[0];
}

export async function updateFooterLink(
  id: string,
  updates: Partial<Omit<FooterLink, 'id' | 'created_at' | 'updated_at'>>
): Promise<FooterLink | null> {
  const fields: string[] = [];
  const values: (string | number | boolean)[] = [];
  let paramIndex = 1;

  if (updates.section !== undefined) {
    fields.push(`section = $${paramIndex++}`);
    values.push(updates.section);
  }
  if (updates.title !== undefined) {
    fields.push(`title = $${paramIndex++}`);
    values.push(updates.title);
  }
  if (updates.url !== undefined) {
    fields.push(`url = $${paramIndex++}`);
    values.push(updates.url);
  }
  if (updates.order_num !== undefined) {
    fields.push(`order_num = $${paramIndex++}`);
    values.push(updates.order_num);
  }
  if (updates.is_visible !== undefined) {
    fields.push(`is_visible = $${paramIndex++}`);
    values.push(updates.is_visible);
  }
  if (updates.is_external !== undefined) {
    fields.push(`is_external = $${paramIndex++}`);
    values.push(updates.is_external);
  }

  if (fields.length === 0) return null;

  fields.push('updated_at = NOW()');
  values.push(id);

  const result = await query<FooterLink>(
    `UPDATE footer_links SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  );
  return result.rows[0] || null;
}

export async function deleteFooterLink(id: string): Promise<boolean> {
  const result = await query(
    `DELETE FROM footer_links WHERE id = $1`,
    [id]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function toggleFooterLinkVisibility(id: string): Promise<FooterLink | null> {
  const result = await query<FooterLink>(
    `UPDATE footer_links SET is_visible = NOT is_visible, updated_at = NOW() WHERE id = $1 RETURNING *`,
    [id]
  );
  return result.rows[0] || null;
}
