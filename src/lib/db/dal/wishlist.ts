import { query } from '../index';

export interface WishlistItem {
  id: string;
  userId: string;
  productId: string;
  createdAt: string;
}

export interface WishlistItemWithProduct extends WishlistItem {
  productName: string;
  productPrice: number;
  productImage: string | null;
  productStatus: string;
  vendorId: string;
  vendorName: string;
}

export async function getWishlistByUser(userId: string): Promise<WishlistItemWithProduct[]> {
  const result = await query(
    `SELECT 
      w.id,
      w.user_id as "userId",
      w.product_id as "productId",
      w.created_at as "createdAt",
      p.name as "productName",
      p.price as "productPrice",
      p.images as "productImages",
      p.status as "productStatus",
      p.vendor_id as "vendorId",
      u.name as "vendorName"
    FROM wishlist_items w
    JOIN products p ON w.product_id = p.id
    LEFT JOIN users u ON p.vendor_id = u.id
    WHERE w.user_id = $1
    ORDER BY w.created_at DESC`,
    [userId]
  );

  return result.rows.map(row => {
    const images = row.productImages ? JSON.parse(row.productImages as string) : [];
    return {
      id: row.id as string,
      userId: row.userId as string,
      productId: row.productId as string,
      createdAt: row.createdAt as string,
      productName: row.productName as string,
      productPrice: row.productPrice as number,
      productImage: images[0] || null,
      productStatus: row.productStatus as string,
      vendorId: row.vendorId as string,
      vendorName: row.vendorName as string,
    };
  });
}

export async function addToWishlist(userId: string, productId: string): Promise<WishlistItem | null> {
  const id = `wishlist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    const result = await query(
      `INSERT INTO wishlist_items (id, user_id, product_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, product_id) DO NOTHING
       RETURNING id, user_id as "userId", product_id as "productId", created_at as "createdAt"`,
      [id, userId, productId]
    );

    if (result.rows.length === 0) {
      const existing = await query(
        `SELECT id, user_id as "userId", product_id as "productId", created_at as "createdAt"
         FROM wishlist_items WHERE user_id = $1 AND product_id = $2`,
        [userId, productId]
      );
      const row = existing.rows[0];
      if (!row) return null;
      return {
        id: row.id as string,
        userId: row.userId as string,
        productId: row.productId as string,
        createdAt: row.createdAt as string,
      };
    }

    const row = result.rows[0];
    return {
      id: row.id as string,
      userId: row.userId as string,
      productId: row.productId as string,
      createdAt: row.createdAt as string,
    };
  } catch (error) {
    console.error('Failed to add to wishlist:', error);
    return null;
  }
}

export async function removeFromWishlist(userId: string, productId: string): Promise<boolean> {
  const result = await query(
    `DELETE FROM wishlist_items WHERE user_id = $1 AND product_id = $2`,
    [userId, productId]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function isInWishlist(userId: string, productId: string): Promise<boolean> {
  const result = await query(
    `SELECT 1 FROM wishlist_items WHERE user_id = $1 AND product_id = $2`,
    [userId, productId]
  );
  return result.rows.length > 0;
}

export async function clearWishlist(userId: string): Promise<number> {
  const result = await query(
    `DELETE FROM wishlist_items WHERE user_id = $1`,
    [userId]
  );
  return result.rowCount ?? 0;
}

export async function getWishlistCount(userId: string): Promise<number> {
  const result = await query(
    `SELECT COUNT(*) as count FROM wishlist_items WHERE user_id = $1`,
    [userId]
  );
  return parseInt(result.rows[0].count as string);
}

export async function mergeWishlist(
  localItems: Array<{ productId: string }>,
  userId: string
): Promise<number> {
  let merged = 0;
  for (const item of localItems) {
    const productId: string = item.productId;
    const added = await addToWishlist(userId, productId);
    if (added) merged++;
  }
  return merged;
}
