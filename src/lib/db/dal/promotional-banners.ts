import { query } from '../index';

export interface PromotionalBanner {
  id: string;
  title: string;
  description?: string;
  image_url?: string;
  video_url?: string;
  media_type: 'image' | 'video';
  link_url?: string;
  position: 'top' | 'sidebar' | 'footer' | 'popup';
  is_active: boolean;
  start_date?: string;
  end_date?: string;
  created_at: string;
  updated_at: string;
}

export interface CreatePromotionalBannerInput {
  title: string;
  description?: string;
  image_url?: string;
  video_url?: string;
  media_type?: 'image' | 'video';
  link_url?: string;
  position: 'top' | 'sidebar' | 'footer' | 'popup';
  is_active?: boolean;
  start_date?: string;
  end_date?: string;
}

export interface UpdatePromotionalBannerInput {
  title?: string;
  description?: string;
  image_url?: string;
  video_url?: string;
  media_type?: 'image' | 'video';
  link_url?: string;
  position?: 'top' | 'sidebar' | 'footer' | 'popup';
  is_active?: boolean;
  start_date?: string;
  end_date?: string;
}

function mapRowToBanner(row: Record<string, unknown>): PromotionalBanner {
  return {
    id: row.id as string,
    title: row.title as string,
    description: row.description as string | undefined,
    image_url: row.image_url as string | undefined,
    video_url: row.video_url as string | undefined,
    media_type: (row.media_type as string || 'image') as 'image' | 'video',
    link_url: row.link_url as string | undefined,
    position: row.position as 'top' | 'sidebar' | 'footer' | 'popup',
    is_active: row.is_active === 1 || row.is_active === true,
    start_date: row.start_date as string | undefined,
    end_date: row.end_date as string | undefined,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export const promotionalBannersDAL = {
  async getAllBanners(): Promise<PromotionalBanner[]> {
    const result = await query('SELECT * FROM promotional_banners ORDER BY created_at DESC');
    return result.rows.map(mapRowToBanner);
  },

  async getActiveBanners(): Promise<PromotionalBanner[]> {
    const now = new Date().toISOString();
    const result = await query(
      `SELECT * FROM promotional_banners 
       WHERE is_active = 1 
       AND (start_date IS NULL OR start_date <= $1)
       AND (end_date IS NULL OR end_date >= $1)
       ORDER BY created_at DESC`,
      [now]
    );
    return result.rows.map(mapRowToBanner);
  },

  async getBannersByPosition(position: string): Promise<PromotionalBanner[]> {
    const now = new Date().toISOString();
    const result = await query(
      `SELECT * FROM promotional_banners 
       WHERE position = $1 
       AND is_active = 1
       AND (start_date IS NULL OR start_date <= $2)
       AND (end_date IS NULL OR end_date >= $2)
       ORDER BY created_at DESC`,
      [position, now]
    );
    return result.rows.map(mapRowToBanner);
  },

  async getBannerById(id: string): Promise<PromotionalBanner | null> {
    const result = await query('SELECT * FROM promotional_banners WHERE id = $1', [id]);
    if (result.rows.length === 0) return null;
    return mapRowToBanner(result.rows[0]);
  },

  async createBanner(input: CreatePromotionalBannerInput): Promise<PromotionalBanner> {
    const id = `promo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    
    const result = await query(
      `INSERT INTO promotional_banners 
       (id, title, description, image_url, video_url, media_type, link_url, position, is_active, start_date, end_date, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        id,
        input.title,
        input.description || null,
        input.image_url || null,
        input.video_url || null,
        input.media_type || 'image',
        input.link_url || null,
        input.position,
        input.is_active !== false ? 1 : 0,
        input.start_date || null,
        input.end_date || null,
        now,
        now,
      ]
    );
    
    return mapRowToBanner(result.rows[0]);
  },

  async updateBanner(id: string, input: UpdatePromotionalBannerInput): Promise<PromotionalBanner | null> {
    const existing = await this.getBannerById(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (input.title !== undefined) {
      updates.push(`title = $${paramIndex++}`);
      values.push(input.title);
    }
    if (input.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(input.description || null);
    }
    if (input.image_url !== undefined) {
      updates.push(`image_url = $${paramIndex++}`);
      values.push(input.image_url || null);
    }
    if (input.video_url !== undefined) {
      updates.push(`video_url = $${paramIndex++}`);
      values.push(input.video_url || null);
    }
    if (input.media_type !== undefined) {
      updates.push(`media_type = $${paramIndex++}`);
      values.push(input.media_type);
    }
    if (input.link_url !== undefined) {
      updates.push(`link_url = $${paramIndex++}`);
      values.push(input.link_url || null);
    }
    if (input.position !== undefined) {
      updates.push(`position = $${paramIndex++}`);
      values.push(input.position);
    }
    if (input.is_active !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      values.push(input.is_active ? 1 : 0);
    }
    if (input.start_date !== undefined) {
      updates.push(`start_date = $${paramIndex++}`);
      values.push(input.start_date || null);
    }
    if (input.end_date !== undefined) {
      updates.push(`end_date = $${paramIndex++}`);
      values.push(input.end_date || null);
    }

    updates.push(`updated_at = $${paramIndex++}`);
    values.push(now);
    values.push(id);

    const result = await query(
      `UPDATE promotional_banners SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    return result.rows.length > 0 ? mapRowToBanner(result.rows[0]) : null;
  },

  async deleteBanner(id: string): Promise<boolean> {
    const result = await query('DELETE FROM promotional_banners WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  },
};
