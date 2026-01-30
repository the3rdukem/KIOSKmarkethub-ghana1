"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

const MAX_RECENTLY_VIEWED = 20;

export interface RecentlyViewedProduct {
  id: string;
  name: string;
  price: number;
  image?: string;
  category?: string;
  vendorName?: string;
  viewedAt: number;
}

interface RecentlyViewedStore {
  products: RecentlyViewedProduct[];
  addProduct: (product: Omit<RecentlyViewedProduct, "viewedAt">) => void;
  removeProduct: (productId: string) => void;
  clearAll: () => void;
  getRecentProducts: (limit?: number) => RecentlyViewedProduct[];
}

export const useRecentlyViewedStore = create<RecentlyViewedStore>()(
  persist(
    (set, get) => ({
      products: [],

      addProduct: (product) => {
        set((state) => {
          const filtered = state.products.filter((p) => p.id !== product.id);

          const newProduct: RecentlyViewedProduct = {
            ...product,
            viewedAt: Date.now(),
          };

          const updated = [newProduct, ...filtered].slice(0, MAX_RECENTLY_VIEWED);

          return { products: updated };
        });
      },

      removeProduct: (productId) => {
        set((state) => ({
          products: state.products.filter((p) => p.id !== productId),
        }));
      },

      clearAll: () => {
        set({ products: [] });
      },

      getRecentProducts: (limit = 10) => {
        return get().products.slice(0, limit);
      },
    }),
    {
      name: "kiosk-recently-viewed",
    }
  )
);
