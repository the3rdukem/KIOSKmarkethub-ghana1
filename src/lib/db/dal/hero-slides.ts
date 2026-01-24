import { query } from '../index';

export interface HeroSlide {
  id: string;
  title: string | null;
  subtitle: string | null;
  image_url: string;
  link_url: string | null;
  order_num: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateHeroSlideInput {
  title?: string;
  subtitle?: string;
  image_url: string;
  link_url?: string;
  order_num?: number;
  is_active?: boolean;
}

export interface UpdateHeroSlideInput {
  title?: string;
  subtitle?: string;
  image_url?: string;
  link_url?: string;
  order_num?: number;
  is_active?: boolean;
}

export async function getAllHeroSlides(): Promise<HeroSlide[]> {
  const result = await query<HeroSlide>(
    'SELECT * FROM hero_slides ORDER BY order_num ASC, created_at ASC'
  );
  return result.rows;
}

export async function getActiveHeroSlides(): Promise<HeroSlide[]> {
  const result = await query<HeroSlide>(
    'SELECT * FROM hero_slides WHERE is_active = TRUE ORDER BY order_num ASC, created_at ASC'
  );
  return result.rows;
}

export async function getHeroSlideById(id: string): Promise<HeroSlide | null> {
  const result = await query<HeroSlide>(
    'SELECT * FROM hero_slides WHERE id = $1',
    [id]
  );
  return result.rows[0] || null;
}

export async function createHeroSlide(input: CreateHeroSlideInput): Promise<HeroSlide> {
  const id = `hs_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const now = new Date().toISOString();
  
  const result = await query<HeroSlide>(
    `INSERT INTO hero_slides (id, title, subtitle, image_url, link_url, order_num, is_active, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      id,
      input.title || null,
      input.subtitle || null,
      input.image_url,
      input.link_url || null,
      input.order_num ?? 0,
      input.is_active ?? true,
      now,
      now
    ]
  );
  
  return result.rows[0];
}

export async function updateHeroSlide(id: string, input: UpdateHeroSlideInput): Promise<HeroSlide | null> {
  const updates: string[] = [];
  const values: (string | number | boolean | null)[] = [];
  let paramCount = 1;

  if (input.title !== undefined) {
    updates.push(`title = $${paramCount++}`);
    values.push(input.title || null);
  }
  if (input.subtitle !== undefined) {
    updates.push(`subtitle = $${paramCount++}`);
    values.push(input.subtitle || null);
  }
  if (input.image_url !== undefined) {
    updates.push(`image_url = $${paramCount++}`);
    values.push(input.image_url);
  }
  if (input.link_url !== undefined) {
    updates.push(`link_url = $${paramCount++}`);
    values.push(input.link_url || null);
  }
  if (input.order_num !== undefined) {
    updates.push(`order_num = $${paramCount++}`);
    values.push(input.order_num);
  }
  if (input.is_active !== undefined) {
    updates.push(`is_active = $${paramCount++}`);
    values.push(input.is_active);
  }

  if (updates.length === 0) {
    return getHeroSlideById(id);
  }

  updates.push(`updated_at = $${paramCount++}`);
  values.push(new Date().toISOString());
  values.push(id);

  const result = await query<HeroSlide>(
    `UPDATE hero_slides SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
    values
  );

  return result.rows[0] || null;
}

export async function deleteHeroSlide(id: string): Promise<boolean> {
  const result = await query(
    'DELETE FROM hero_slides WHERE id = $1',
    [id]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function reorderHeroSlides(slideIds: string[]): Promise<void> {
  for (let i = 0; i < slideIds.length; i++) {
    await query(
      'UPDATE hero_slides SET order_num = $1, updated_at = $2 WHERE id = $3',
      [i, new Date().toISOString(), slideIds[i]]
    );
  }
}
