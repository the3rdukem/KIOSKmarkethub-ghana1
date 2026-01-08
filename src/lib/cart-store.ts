/**
 * Cart Store - Identity-Aware
 *
 * Client-side cart state that syncs with server-side cart.
 * 
 * CRITICAL RULES:
 * - Cart state is keyed by identity (user_id OR session_id)
 * - Cart MUST reset on logout / auth change
 * - Server is the source of truth
 * - Client state is a cache that syncs with server
 */

import { create } from 'zustand';
import type { Product } from './products-store';

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

export interface CartValidationResult {
  isValid: boolean;
  issues: {
    itemId: string;
    itemName: string;
    type: 'out_of_stock' | 'insufficient_stock' | 'price_changed' | 'product_unavailable';
    message: string;
    oldValue?: number;
    newValue?: number;
  }[];
}

interface CartStore {
  items: CartItem[];
  isOpen: boolean;
  isLoading: boolean;
  isSynced: boolean;
  ownerType: 'guest' | 'user' | null;

  addItem: (item: Omit<CartItem, 'quantity'> & { quantity?: number }) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  updateQuantity: (id: string, quantity: number) => Promise<void>;
  updateItemPrice: (id: string, newPrice: number) => void;
  updateItemMaxQuantity: (id: string, maxQuantity: number) => void;
  removeUnavailableItems: (productIds: string[]) => void;
  clearCart: () => Promise<void>;
  openCart: () => void;
  closeCart: () => void;
  syncWithServer: () => Promise<void>;
  resetCart: () => void;

  getTotalItems: () => number;
  getTotalPrice: () => number;
  getItemsByVendor: () => Record<string, CartItem[]>;
}

export const useCartStore = create<CartStore>()((set, get) => ({
  items: [],
  isOpen: false,
  isLoading: false,
  isSynced: false,
  ownerType: null,

  syncWithServer: async () => {
    try {
      set({ isLoading: true });
      const response = await fetch('/api/cart', {
        credentials: 'include',
        cache: 'no-store',
      });
      
      if (!response.ok) {
        console.error('[CART_STORE] Failed to sync with server');
        set({ isLoading: false });
        return;
      }
      
      const data = await response.json();
      set({
        items: data.cart?.items || [],
        ownerType: data.cart?.ownerType || null,
        isSynced: true,
        isLoading: false,
      });
    } catch (error) {
      console.error('[CART_STORE] Sync error:', error);
      set({ isLoading: false });
    }
  },

  resetCart: () => {
    set({
      items: [],
      isOpen: false,
      isSynced: false,
      ownerType: null,
    });
  },

  addItem: async (newItem) => {
    const previousItems = [...get().items];
    const items = get().items;
    const existingItemIndex = items.findIndex(
      item => item.id === newItem.id &&
             JSON.stringify(item.variations) === JSON.stringify(newItem.variations)
    );

    let updatedItems: CartItem[];
    if (existingItemIndex > -1) {
      const existingItem = items[existingItemIndex];
      const newQuantity = Math.min(
        existingItem.quantity + (newItem.quantity || 1),
        existingItem.maxQuantity
      );
      updatedItems = items.map((item, index) =>
        index === existingItemIndex
          ? { ...item, quantity: newQuantity }
          : item
      );
    } else {
      updatedItems = [...items, { ...newItem, quantity: newItem.quantity || 1 } as CartItem];
    }

    set({ items: updatedItems, isOpen: true });
    setTimeout(() => set({ isOpen: false }), 2000);

    try {
      const response = await fetch('/api/cart', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', item: { ...newItem, quantity: newItem.quantity || 1 } }),
      });
      
      if (!response.ok) {
        console.error('[CART_STORE] Server rejected add, rolling back');
        set({ items: previousItems });
      }
    } catch (error) {
      console.error('[CART_STORE] Failed to sync add, rolling back:', error);
      set({ items: previousItems });
    }
  },

  removeItem: async (id) => {
    const previousItems = [...get().items];
    set({ items: get().items.filter(item => item.id !== id) });

    try {
      const response = await fetch('/api/cart', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove', itemId: id }),
      });
      
      if (!response.ok) {
        console.error('[CART_STORE] Server rejected remove, rolling back');
        set({ items: previousItems });
      }
    } catch (error) {
      console.error('[CART_STORE] Failed to sync remove, rolling back:', error);
      set({ items: previousItems });
    }
  },

  updateQuantity: async (id, quantity) => {
    if (quantity <= 0) {
      get().removeItem(id);
      return;
    }

    const previousItems = [...get().items];
    set({
      items: get().items.map(item =>
        item.id === id
          ? { ...item, quantity: Math.min(quantity, item.maxQuantity) }
          : item
      )
    });

    try {
      const response = await fetch('/api/cart', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_quantity', itemId: id, quantity }),
      });
      
      if (!response.ok) {
        console.error('[CART_STORE] Server rejected quantity update, rolling back');
        set({ items: previousItems });
      }
    } catch (error) {
      console.error('[CART_STORE] Failed to sync quantity, rolling back:', error);
      set({ items: previousItems });
    }
  },

  updateItemPrice: (id, newPrice) => {
    set({
      items: get().items.map(item =>
        item.id === id
          ? { ...item, price: newPrice }
          : item
      )
    });
  },

  updateItemMaxQuantity: (id, maxQuantity) => {
    set({
      items: get().items.map(item =>
        item.id === id
          ? {
              ...item,
              maxQuantity,
              quantity: Math.min(item.quantity, maxQuantity)
            }
          : item
      )
    });
  },

  removeUnavailableItems: (productIds) => {
    set({
      items: get().items.filter(item => !productIds.includes(item.id))
    });
  },

  clearCart: async () => {
    set({ items: [] });

    try {
      await fetch('/api/cart', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear' }),
      });
    } catch (error) {
      console.error('[CART_STORE] Failed to sync clear:', error);
    }
  },

  openCart: () => {
    set({ isOpen: true });
  },

  closeCart: () => {
    set({ isOpen: false });
  },

  getTotalItems: () => {
    return get().items.reduce((total, item) => total + item.quantity, 0);
  },

  getTotalPrice: () => {
    return get().items.reduce((total, item) => total + (item.price * item.quantity), 0);
  },

  getItemsByVendor: () => {
    const items = get().items;
    return items.reduce((groups, item) => {
      const vendorId = item.vendorId;
      if (!groups[vendorId]) {
        groups[vendorId] = [];
      }
      groups[vendorId].push(item);
      return groups;
    }, {} as Record<string, CartItem[]>);
  }
}));

export function validateCartItems(
  cartItems: CartItem[],
  products: Product[]
): CartValidationResult {
  const issues: CartValidationResult['issues'] = [];

  for (const cartItem of cartItems) {
    const product = products.find(p => p.id === cartItem.id);

    if (!product) {
      issues.push({
        itemId: cartItem.id,
        itemName: cartItem.name,
        type: 'product_unavailable',
        message: `"${cartItem.name}" is no longer available`,
      });
      continue;
    }

    if (product.status !== 'active') {
      issues.push({
        itemId: cartItem.id,
        itemName: cartItem.name,
        type: 'product_unavailable',
        message: `"${cartItem.name}" is currently unavailable`,
      });
      continue;
    }

    if (product.trackQuantity) {
      if (product.quantity === 0) {
        issues.push({
          itemId: cartItem.id,
          itemName: cartItem.name,
          type: 'out_of_stock',
          message: `"${cartItem.name}" is out of stock`,
        });
      } else if (product.quantity < cartItem.quantity) {
        issues.push({
          itemId: cartItem.id,
          itemName: cartItem.name,
          type: 'insufficient_stock',
          message: `Only ${product.quantity} units of "${cartItem.name}" available`,
          oldValue: cartItem.quantity,
          newValue: product.quantity,
        });
      }
    }

    if (product.price !== cartItem.price) {
      issues.push({
        itemId: cartItem.id,
        itemName: cartItem.name,
        type: 'price_changed',
        message: `Price of "${cartItem.name}" has changed from GHS ${cartItem.price.toLocaleString()} to GHS ${product.price.toLocaleString()}`,
        oldValue: cartItem.price,
        newValue: product.price,
      });
    }
  }

  return {
    isValid: issues.length === 0,
    issues,
  };
}

export function syncCartWithProducts(
  cartItems: CartItem[],
  products: Product[],
  updateItemPrice: (id: string, price: number) => void,
  updateItemMaxQuantity: (id: string, maxQuantity: number) => void,
  removeUnavailableItems: (ids: string[]) => void
): void {
  const unavailableIds: string[] = [];

  for (const cartItem of cartItems) {
    const product = products.find(p => p.id === cartItem.id);

    if (!product || product.status !== 'active') {
      unavailableIds.push(cartItem.id);
      continue;
    }

    if (product.price !== cartItem.price) {
      updateItemPrice(cartItem.id, product.price);
    }

    const newMaxQuantity = product.trackQuantity ? product.quantity : 999;
    if (newMaxQuantity !== cartItem.maxQuantity) {
      updateItemMaxQuantity(cartItem.id, newMaxQuantity);
    }
  }

  if (unavailableIds.length > 0) {
    removeUnavailableItems(unavailableIds);
  }
}
