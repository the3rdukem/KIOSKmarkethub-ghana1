import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface WishlistItem {
  id: string;
  buyerId: string;
  productId: string;
  addedAt: string;
}

export interface WishlistItemWithProduct extends WishlistItem {
  productName?: string;
  productPrice?: number;
  productImage?: string | null;
  productStatus?: string;
  vendorId?: string;
  vendorName?: string;
}

interface WishlistState {
  wishlistItems: WishlistItem[];
  isLoading: boolean;
  isSynced: boolean;

  addToWishlist: (buyerId: string, productId: string) => Promise<WishlistItem>;
  removeFromWishlist: (buyerId: string, productId: string) => Promise<void>;
  isInWishlist: (buyerId: string, productId: string) => boolean;
  getWishlistByBuyer: (buyerId: string) => WishlistItem[];
  getWishlistProductIds: (buyerId: string) => string[];
  toggleWishlist: (buyerId: string, productId: string) => Promise<boolean>;
  clearWishlist: (buyerId: string) => void;
  syncWithServer: (buyerId: string) => Promise<void>;
  mergeLocalWithServer: (buyerId: string) => Promise<void>;
}

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      wishlistItems: [],
      isLoading: false,
      isSynced: false,

      addToWishlist: async (buyerId, productId) => {
        if (get().isInWishlist(buyerId, productId)) {
          return get().wishlistItems.find(
            (item) => item.buyerId === buyerId && item.productId === productId
          )!;
        }

        const newItem: WishlistItem = {
          id: `wishlist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          buyerId,
          productId,
          addedAt: new Date().toISOString(),
        };

        set((state) => ({
          wishlistItems: [...state.wishlistItems, newItem],
        }));

        try {
          const response = await fetch('/api/wishlist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ productId }),
          });
          
          if (response.ok) {
            const data = await response.json();
            if (data.item) {
              set((state) => ({
                wishlistItems: state.wishlistItems.map((item) =>
                  item.productId === productId && item.buyerId === buyerId
                    ? { ...item, id: data.item.id }
                    : item
                ),
              }));
            }
          }
        } catch (error) {
          console.error('Failed to sync wishlist add:', error);
        }

        return newItem;
      },

      removeFromWishlist: async (buyerId, productId) => {
        set((state) => ({
          wishlistItems: state.wishlistItems.filter(
            (item) => !(item.buyerId === buyerId && item.productId === productId)
          ),
        }));

        try {
          await fetch(`/api/wishlist/${productId}`, {
            method: 'DELETE',
            credentials: 'include',
          });
        } catch (error) {
          console.error('Failed to sync wishlist remove:', error);
        }
      },

      isInWishlist: (buyerId, productId) => {
        return get().wishlistItems.some(
          (item) => item.buyerId === buyerId && item.productId === productId
        );
      },

      getWishlistByBuyer: (buyerId) => {
        return get().wishlistItems
          .filter((item) => item.buyerId === buyerId)
          .sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());
      },

      getWishlistProductIds: (buyerId) => {
        return get().getWishlistByBuyer(buyerId).map((item) => item.productId);
      },

      toggleWishlist: async (buyerId, productId) => {
        const isCurrentlyInWishlist = get().isInWishlist(buyerId, productId);

        if (isCurrentlyInWishlist) {
          await get().removeFromWishlist(buyerId, productId);
          return false;
        } else {
          await get().addToWishlist(buyerId, productId);
          return true;
        }
      },

      clearWishlist: (buyerId) => {
        set((state) => ({
          wishlistItems: state.wishlistItems.filter((item) => item.buyerId !== buyerId),
        }));
      },

      syncWithServer: async (buyerId: string) => {
        set({ isLoading: true });
        try {
          const response = await fetch('/api/wishlist', {
            credentials: 'include',
          });
          
          if (response.ok) {
            const data = await response.json();
            if (data.authenticated && data.items) {
              const serverItems: WishlistItem[] = data.items.map((item: { id: string; productId: string; createdAt: string }) => ({
                id: item.id,
                buyerId,
                productId: item.productId,
                addedAt: item.createdAt,
              }));

              set((state) => {
                const otherUserItems = state.wishlistItems.filter(
                  (item) => item.buyerId !== buyerId
                );
                return {
                  wishlistItems: [...otherUserItems, ...serverItems],
                  isSynced: true,
                };
              });
            }
          }
        } catch (error) {
          console.error('Failed to sync wishlist:', error);
        } finally {
          set({ isLoading: false });
        }
      },

      mergeLocalWithServer: async (buyerId: string) => {
        const localItems = get().getWishlistByBuyer(buyerId);
        
        if (localItems.length === 0) {
          await get().syncWithServer(buyerId);
          return;
        }

        try {
          const response = await fetch('/api/wishlist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              localItems: localItems.map((item) => ({ productId: item.productId })),
            }),
          });

          if (response.ok) {
            await get().syncWithServer(buyerId);
          }
        } catch (error) {
          console.error('Failed to merge wishlist:', error);
        }
      },
    }),
    {
      name: 'marketplace-wishlist',
    }
  )
);
