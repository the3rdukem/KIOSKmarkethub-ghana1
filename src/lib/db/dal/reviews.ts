/**
 * Reviews Data Access Layer
 * 
 * Server-side only - provides CRUD operations for reviews, vendor replies, and admin moderation.
 */

import { query } from '../index';
import { v4 as uuidv4 } from 'uuid';

export type ReviewStatus = 'active' | 'hidden' | 'deleted';

export interface DbReview {
  id: string;
  product_id: string;
  buyer_id: string;
  vendor_id: string;
  rating: number;
  comment: string;
  is_verified_purchase: number;
  status: ReviewStatus;
  helpful_count: number;
  edited_at: string | null;
  vendor_reply: string | null;
  vendor_reply_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbReviewMedia {
  id: string;
  review_id: string;
  file_url: string;
  file_type: string;
  created_at: string;
}

export interface ReviewWithMedia extends DbReview {
  media: DbReviewMedia[];
  buyer_name?: string;
  buyer_avatar?: string;
  product_name?: string;
}

export interface CreateReviewInput {
  productId: string;
  buyerId: string;
  vendorId: string;
  rating: number;
  comment: string;
  isVerifiedPurchase?: boolean;
  mediaUrls?: string[];
}

export interface UpdateReviewInput {
  rating?: number;
  comment?: string;
  mediaUrls?: string[];
}

const EDIT_WINDOW_MINUTES = 15;

/**
 * Check if buyer can still edit their review
 * Rules: Within 15 minutes of creation AND no vendor reply yet
 */
export function canBuyerEditReview(review: DbReview): { canEdit: boolean; reason?: string } {
  // If vendor has replied, buyer cannot edit
  if (review.vendor_reply) {
    return { canEdit: false, reason: 'Editing is locked after vendor has replied' };
  }

  // Check 15-minute window from creation
  const createdAt = new Date(review.created_at);
  const now = new Date();
  const minutesSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60);

  if (minutesSinceCreation > EDIT_WINDOW_MINUTES) {
    return { canEdit: false, reason: `Reviews can only be edited within ${EDIT_WINDOW_MINUTES} minutes of posting` };
  }

  return { canEdit: true };
}

/**
 * Create a new review
 */
export async function createReview(input: CreateReviewInput): Promise<ReviewWithMedia | null> {
  const id = `review_${uuidv4().replace(/-/g, '').substring(0, 20)}`;
  const now = new Date().toISOString();

  // Check if buyer already reviewed this product
  const existing = await getReviewByBuyerAndProduct(input.buyerId, input.productId);
  if (existing) {
    return null; // Buyer already reviewed
  }

  await query(`
    INSERT INTO reviews (
      id, product_id, buyer_id, vendor_id, rating, comment, 
      is_verified_purchase, status, helpful_count, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', 0, $8, $9)
  `, [
    id,
    input.productId,
    input.buyerId,
    input.vendorId,
    input.rating,
    input.comment,
    input.isVerifiedPurchase ? 1 : 0,
    now,
    now
  ]);

  // Add media if provided
  if (input.mediaUrls && input.mediaUrls.length > 0) {
    for (const url of input.mediaUrls) {
      await addReviewMedia(id, url);
    }
  }

  return getReviewById(id);
}

/**
 * Get review by ID with media
 */
export async function getReviewById(id: string): Promise<ReviewWithMedia | null> {
  const result = await query<DbReview>(`
    SELECT r.*, u.name as buyer_name, u.avatar as buyer_avatar, p.name as product_name
    FROM reviews r
    LEFT JOIN users u ON r.buyer_id = u.id
    LEFT JOIN products p ON r.product_id = p.id
    WHERE r.id = $1
  `, [id]);

  if (!result.rows[0]) return null;

  const media = await getReviewMedia(id);
  return { ...result.rows[0], media };
}

/**
 * Get review by buyer and product (for uniqueness check)
 */
export async function getReviewByBuyerAndProduct(buyerId: string, productId: string): Promise<DbReview | null> {
  const result = await query<DbReview>(
    'SELECT * FROM reviews WHERE buyer_id = $1 AND product_id = $2 AND status != $3',
    [buyerId, productId, 'deleted']
  );
  return result.rows[0] || null;
}

/**
 * Get reviews for a product (public, active only)
 */
export async function getProductReviews(productId: string): Promise<ReviewWithMedia[]> {
  const result = await query<DbReview & { buyer_name: string; buyer_avatar: string }>(`
    SELECT r.*, u.name as buyer_name, u.avatar as buyer_avatar
    FROM reviews r
    LEFT JOIN users u ON r.buyer_id = u.id
    WHERE r.product_id = $1 AND r.status = 'active'
    ORDER BY r.created_at DESC
  `, [productId]);

  const reviews: ReviewWithMedia[] = [];
  for (const row of result.rows) {
    const media = await getReviewMedia(row.id);
    reviews.push({ ...row, media });
  }
  return reviews;
}

/**
 * Get reviews by buyer
 */
export async function getBuyerReviews(buyerId: string): Promise<ReviewWithMedia[]> {
  const result = await query<DbReview & { product_name: string }>(`
    SELECT r.*, p.name as product_name
    FROM reviews r
    LEFT JOIN products p ON r.product_id = p.id
    WHERE r.buyer_id = $1 AND r.status != 'deleted'
    ORDER BY r.created_at DESC
  `, [buyerId]);

  const reviews: ReviewWithMedia[] = [];
  for (const row of result.rows) {
    const media = await getReviewMedia(row.id);
    reviews.push({ ...row, media });
  }
  return reviews;
}

/**
 * Get reviews for a vendor's products
 */
export async function getVendorProductReviews(vendorId: string): Promise<ReviewWithMedia[]> {
  const result = await query<DbReview & { buyer_name: string; buyer_avatar: string; product_name: string }>(`
    SELECT r.*, u.name as buyer_name, u.avatar as buyer_avatar, p.name as product_name
    FROM reviews r
    LEFT JOIN users u ON r.buyer_id = u.id
    LEFT JOIN products p ON r.product_id = p.id
    WHERE r.vendor_id = $1 AND r.status != 'deleted'
    ORDER BY r.created_at DESC
  `, [vendorId]);

  const reviews: ReviewWithMedia[] = [];
  for (const row of result.rows) {
    const media = await getReviewMedia(row.id);
    reviews.push({ ...row, media });
  }
  return reviews;
}

/**
 * Get all reviews (admin)
 */
export async function getAllReviews(options?: {
  status?: ReviewStatus;
  limit?: number;
  offset?: number;
}): Promise<ReviewWithMedia[]> {
  let sql = `
    SELECT r.*, u.name as buyer_name, u.avatar as buyer_avatar, p.name as product_name
    FROM reviews r
    LEFT JOIN users u ON r.buyer_id = u.id
    LEFT JOIN products p ON r.product_id = p.id
    WHERE 1=1
  `;
  const params: unknown[] = [];
  let paramIndex = 1;

  if (options?.status) {
    sql += ` AND r.status = $${paramIndex++}`;
    params.push(options.status);
  }

  sql += ' ORDER BY r.created_at DESC';

  if (options?.limit) {
    sql += ` LIMIT $${paramIndex++}`;
    params.push(options.limit);
  }

  if (options?.offset) {
    sql += ` OFFSET $${paramIndex++}`;
    params.push(options.offset);
  }

  const result = await query<DbReview & { buyer_name: string; buyer_avatar: string; product_name: string }>(sql, params);

  const reviews: ReviewWithMedia[] = [];
  for (const row of result.rows) {
    const media = await getReviewMedia(row.id);
    reviews.push({ ...row, media });
  }
  return reviews;
}

/**
 * Update a review (buyer only)
 * Returns object with success flag and reason if failed
 */
export async function updateReview(id: string, buyerId: string, input: UpdateReviewInput): Promise<{ review: ReviewWithMedia | null; error?: string }> {
  const review = await getReviewById(id);
  if (!review || review.buyer_id !== buyerId || review.status === 'deleted') {
    return { review: null, error: 'Review not found or access denied' };
  }

  // Check edit window
  const editCheck = canBuyerEditReview(review);
  if (!editCheck.canEdit) {
    return { review: null, error: editCheck.reason };
  }

  const now = new Date().toISOString();
  const updates: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (input.rating !== undefined) {
    updates.push(`rating = $${paramIndex++}`);
    params.push(input.rating);
  }

  if (input.comment !== undefined) {
    updates.push(`comment = $${paramIndex++}`);
    params.push(input.comment);
  }

  updates.push(`edited_at = $${paramIndex++}`);
  params.push(now);

  updates.push(`updated_at = $${paramIndex++}`);
  params.push(now);

  params.push(id);

  await query(`UPDATE reviews SET ${updates.join(', ')} WHERE id = $${paramIndex}`, params);

  // Update media if provided
  if (input.mediaUrls) {
    // Remove existing media
    await query('DELETE FROM review_media WHERE review_id = $1', [id]);
    // Add new media
    for (const url of input.mediaUrls) {
      await addReviewMedia(id, url);
    }
  }

  const updatedReview = await getReviewById(id);
  return { review: updatedReview };
}

/**
 * Soft delete a review (buyer only)
 */
export async function deleteReview(id: string, buyerId: string): Promise<boolean> {
  const review = await getReviewById(id);
  if (!review || review.buyer_id !== buyerId) {
    return false;
  }

  const now = new Date().toISOString();
  await query(
    'UPDATE reviews SET status = $1, updated_at = $2 WHERE id = $3',
    ['deleted', now, id]
  );
  return true;
}

/**
 * Add vendor reply
 */
export async function addVendorReply(id: string, vendorId: string, reply: string): Promise<ReviewWithMedia | null> {
  const review = await getReviewById(id);
  if (!review || review.vendor_id !== vendorId) {
    return null;
  }

  // Vendor can only reply once
  if (review.vendor_reply) {
    return null;
  }

  const now = new Date().toISOString();
  await query(
    'UPDATE reviews SET vendor_reply = $1, vendor_reply_at = $2, updated_at = $3 WHERE id = $4',
    [reply, now, now, id]
  );

  return getReviewById(id);
}

/**
 * Hide/unhide review (admin moderation)
 */
export async function moderateReview(id: string, action: 'hide' | 'unhide' | 'delete'): Promise<ReviewWithMedia | null> {
  const review = await getReviewById(id);
  if (!review) return null;

  const now = new Date().toISOString();
  let newStatus: ReviewStatus;

  switch (action) {
    case 'hide':
      newStatus = 'hidden';
      break;
    case 'unhide':
      newStatus = 'active';
      break;
    case 'delete':
      newStatus = 'deleted';
      break;
  }

  await query(
    'UPDATE reviews SET status = $1, updated_at = $2 WHERE id = $3',
    [newStatus, now, id]
  );

  return getReviewById(id);
}

/**
 * Mark review as helpful
 */
export async function markReviewHelpful(id: string): Promise<boolean> {
  const result = await query(
    'UPDATE reviews SET helpful_count = helpful_count + 1 WHERE id = $1 AND status = $2',
    [id, 'active']
  );
  return (result.rowCount ?? 0) > 0;
}

/**
 * Get review media
 */
export async function getReviewMedia(reviewId: string): Promise<DbReviewMedia[]> {
  const result = await query<DbReviewMedia>(
    'SELECT * FROM review_media WHERE review_id = $1 ORDER BY created_at ASC',
    [reviewId]
  );
  return result.rows;
}

/**
 * Add review media
 */
export async function addReviewMedia(reviewId: string, fileUrl: string, fileType: string = 'image'): Promise<DbReviewMedia> {
  const id = `media_${uuidv4().replace(/-/g, '').substring(0, 16)}`;
  const now = new Date().toISOString();

  await query(`
    INSERT INTO review_media (id, review_id, file_url, file_type, created_at)
    VALUES ($1, $2, $3, $4, $5)
  `, [id, reviewId, fileUrl, fileType, now]);

  const result = await query<DbReviewMedia>('SELECT * FROM review_media WHERE id = $1', [id]);
  return result.rows[0];
}

/**
 * Get product rating stats
 */
export async function getProductRatingStats(productId: string): Promise<{
  average: number;
  total: number;
  breakdown: Record<number, number>;
}> {
  const result = await query<{ rating: number; count: string }>(
    `SELECT rating, COUNT(*) as count FROM reviews 
     WHERE product_id = $1 AND status = 'active' 
     GROUP BY rating`,
    [productId]
  );

  const breakdown: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  let total = 0;
  let sum = 0;

  for (const row of result.rows) {
    const count = parseInt(row.count);
    breakdown[row.rating] = count;
    total += count;
    sum += row.rating * count;
  }

  return {
    average: total > 0 ? Math.round((sum / total) * 10) / 10 : 0,
    total,
    breakdown,
  };
}

/**
 * Get rating stats for multiple products (bulk operation for search page)
 */
export async function getBulkProductRatings(productIds: string[]): Promise<Map<string, { average: number; count: number }>> {
  if (productIds.length === 0) {
    return new Map();
  }

  const placeholders = productIds.map((_, i) => `$${i + 1}`).join(', ');
  const result = await query<{ product_id: string; avg_rating: string; review_count: string }>(
    `SELECT product_id, 
            AVG(rating) as avg_rating, 
            COUNT(*) as review_count 
     FROM reviews 
     WHERE product_id IN (${placeholders}) AND status = 'active' 
     GROUP BY product_id`,
    productIds
  );

  const ratingsMap = new Map<string, { average: number; count: number }>();
  for (const row of result.rows) {
    ratingsMap.set(row.product_id, {
      average: Math.round(parseFloat(row.avg_rating) * 10) / 10,
      count: parseInt(row.review_count),
    });
  }

  return ratingsMap;
}

/**
 * Get review stats for admin dashboard
 */
export async function getReviewStats(): Promise<{
  total: number;
  active: number;
  hidden: number;
  deleted: number;
  todayCount: number;
}> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString();

  const [totalRes, activeRes, hiddenRes, deletedRes, todayRes] = await Promise.all([
    query<{ count: string }>('SELECT COUNT(*) as count FROM reviews'),
    query<{ count: string }>("SELECT COUNT(*) as count FROM reviews WHERE status = 'active'"),
    query<{ count: string }>("SELECT COUNT(*) as count FROM reviews WHERE status = 'hidden'"),
    query<{ count: string }>("SELECT COUNT(*) as count FROM reviews WHERE status = 'deleted'"),
    query<{ count: string }>('SELECT COUNT(*) as count FROM reviews WHERE created_at >= $1', [todayStr]),
  ]);

  return {
    total: parseInt(totalRes.rows[0]?.count || '0'),
    active: parseInt(activeRes.rows[0]?.count || '0'),
    hidden: parseInt(hiddenRes.rows[0]?.count || '0'),
    deleted: parseInt(deletedRes.rows[0]?.count || '0'),
    todayCount: parseInt(todayRes.rows[0]?.count || '0'),
  };
}
