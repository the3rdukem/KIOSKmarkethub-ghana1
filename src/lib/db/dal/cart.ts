/**
 * Cart Data Access Layer - PostgreSQL
 *
 * Server-side cart management with ownership validation.
 * Supports both guest (session_id) and authenticated (user_id) carts.
 * 
 * CRITICAL RULES:
 * - A cart MUST belong to exactly ONE identity
 * - A cart MUST NEVER leak between users
 * - Every cart fetch MUST validate ownership
 */

import { query } from '../index';
import { v4 as uuidv4 } from 'uuid';

export type CartOwnerType = 'guest' | 'user';

export interface CartItem {
  id: string;
  name: string;
  price: number;
  image: string;
  vendor: string;
  vendorId: string;
  quantity: number;
  variations?: {
    color?: string;
    size?: string;
  };
  maxQuantity: number;
}

export interface DbCart {
  id: string;
  owner_type: CartOwnerType;
  owner_id: string;
  items: string;
  created_at: string;
  updated_at: string;
}

export interface Cart {
  id: string;
  ownerType: CartOwnerType;
  ownerId: string;
  items: CartItem[];
  createdAt: string;
  updatedAt: string;
}

function parseCart(dbCart: DbCart): Cart {
  let items: CartItem[] = [];
  try {
    items = JSON.parse(dbCart.items || '[]');
  } catch {
    items = [];
  }
  return {
    id: dbCart.id,
    ownerType: dbCart.owner_type,
    ownerId: dbCart.owner_id,
    items,
    createdAt: dbCart.created_at,
    updatedAt: dbCart.updated_at,
  };
}

export async function getCart(ownerType: CartOwnerType, ownerId: string): Promise<Cart | null> {
  const result = await query<DbCart>(
    'SELECT * FROM carts WHERE owner_type = $1 AND owner_id = $2',
    [ownerType, ownerId]
  );
  
  if (result.rows.length === 0) {
    return null;
  }
  
  return parseCart(result.rows[0]);
}

export async function getOrCreateCart(ownerType: CartOwnerType, ownerId: string): Promise<Cart> {
  const existing = await getCart(ownerType, ownerId);
  if (existing) {
    return existing;
  }
  
  const id = `cart_${uuidv4().replace(/-/g, '').substring(0, 24)}`;
  const now = new Date().toISOString();
  
  await query(
    `INSERT INTO carts (id, owner_type, owner_id, items, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (owner_type, owner_id) DO NOTHING`,
    [id, ownerType, ownerId, '[]', now, now]
  );
  
  const cart = await getCart(ownerType, ownerId);
  return cart!;
}

export async function updateCartItems(ownerType: CartOwnerType, ownerId: string, items: CartItem[]): Promise<Cart> {
  const now = new Date().toISOString();
  const itemsJson = JSON.stringify(items);
  
  const result = await query<DbCart>(
    `UPDATE carts SET items = $1, updated_at = $2 
     WHERE owner_type = $3 AND owner_id = $4
     RETURNING *`,
    [itemsJson, now, ownerType, ownerId]
  );
  
  if (result.rows.length === 0) {
    const cart = await getOrCreateCart(ownerType, ownerId);
    await query(
      `UPDATE carts SET items = $1, updated_at = $2 
       WHERE owner_type = $3 AND owner_id = $4`,
      [itemsJson, now, ownerType, ownerId]
    );
    return { ...cart, items, updatedAt: now };
  }
  
  return parseCart(result.rows[0]);
}

export async function addItemToCart(
  ownerType: CartOwnerType,
  ownerId: string,
  item: Omit<CartItem, 'quantity'> & { quantity?: number }
): Promise<Cart> {
  const cart = await getOrCreateCart(ownerType, ownerId);
  const items = [...cart.items];
  
  const existingIndex = items.findIndex(
    i => i.id === item.id && JSON.stringify(i.variations) === JSON.stringify(item.variations)
  );
  
  if (existingIndex > -1) {
    const existing = items[existingIndex];
    items[existingIndex] = {
      ...existing,
      quantity: Math.min(existing.quantity + (item.quantity || 1), existing.maxQuantity),
    };
  } else {
    items.push({ ...item, quantity: item.quantity || 1 } as CartItem);
  }
  
  return updateCartItems(ownerType, ownerId, items);
}

export async function removeItemFromCart(
  ownerType: CartOwnerType,
  ownerId: string,
  itemId: string
): Promise<Cart> {
  const cart = await getOrCreateCart(ownerType, ownerId);
  const items = cart.items.filter(i => i.id !== itemId);
  return updateCartItems(ownerType, ownerId, items);
}

export async function updateItemQuantity(
  ownerType: CartOwnerType,
  ownerId: string,
  itemId: string,
  quantity: number
): Promise<Cart> {
  const cart = await getOrCreateCart(ownerType, ownerId);
  
  if (quantity <= 0) {
    return removeItemFromCart(ownerType, ownerId, itemId);
  }
  
  const items = cart.items.map(item =>
    item.id === itemId
      ? { ...item, quantity: Math.min(quantity, item.maxQuantity) }
      : item
  );
  
  return updateCartItems(ownerType, ownerId, items);
}

export async function clearCart(ownerType: CartOwnerType, ownerId: string): Promise<void> {
  const now = new Date().toISOString();
  await query(
    `UPDATE carts SET items = $1, updated_at = $2 
     WHERE owner_type = $3 AND owner_id = $4`,
    ['[]', now, ownerType, ownerId]
  );
}

/**
 * Delete a cart from the database.
 * 
 * CRITICAL INVARIANT: User carts should NEVER be deleted except:
 * - After checkout completion
 * - By explicit user action (manual cart clear)
 * 
 * Guest carts CAN be deleted on merge or session expiry.
 * 
 * @param ownerType - 'guest' or 'user'
 * @param ownerId - session_id for guests, user_id for users
 * @param force - Must be true to delete user carts (safety guard)
 */
export async function deleteCart(
  ownerType: CartOwnerType,
  ownerId: string,
  force: boolean = false
): Promise<boolean> {
  // Safety guard: prevent accidental user cart deletion
  if (ownerType === 'user' && !force) {
    console.error('[CART_DAL] BLOCKED: Attempted to delete user cart without force flag', {
      ownerId: ownerId.substring(0, 8) + '...',
    });
    return false;
  }
  
  const result = await query(
    'DELETE FROM carts WHERE owner_type = $1 AND owner_id = $2',
    [ownerType, ownerId]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function mergeGuestCartToUser(guestSessionId: string, userId: string): Promise<Cart> {
  const guestCart = await getCart('guest', guestSessionId);
  const userCart = await getOrCreateCart('user', userId);
  
  if (!guestCart || guestCart.items.length === 0) {
    return userCart;
  }
  
  const mergedItems = [...userCart.items];
  
  for (const guestItem of guestCart.items) {
    const existingIndex = mergedItems.findIndex(
      i => i.id === guestItem.id && JSON.stringify(i.variations) === JSON.stringify(guestItem.variations)
    );
    
    if (existingIndex > -1) {
      const existing = mergedItems[existingIndex];
      mergedItems[existingIndex] = {
        ...existing,
        quantity: Math.min(existing.quantity + guestItem.quantity, existing.maxQuantity),
      };
    } else {
      mergedItems.push(guestItem);
    }
  }
  
  const updatedCart = await updateCartItems('user', userId, mergedItems);
  
  await deleteCart('guest', guestSessionId);
  
  console.log('[CART] Merged guest cart to user', {
    guestSessionId: guestSessionId.substring(0, 8) + '...',
    userId: userId.substring(0, 8) + '...',
    guestItemCount: guestCart.items.length,
    userItemCountBefore: userCart.items.length,
    mergedItemCount: mergedItems.length,
  });
  
  return updatedCart;
}

export async function validateCartOwnership(
  cartId: string,
  ownerType: CartOwnerType,
  ownerId: string
): Promise<boolean> {
  const result = await query<DbCart>(
    'SELECT id FROM carts WHERE id = $1 AND owner_type = $2 AND owner_id = $3',
    [cartId, ownerType, ownerId]
  );
  return result.rows.length > 0;
}
