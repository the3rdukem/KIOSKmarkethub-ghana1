import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ActiveSale {
  id: string;
  name: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  endsAt: string;
}

export interface Product {
  id: string;
  vendorId: string;
  vendorName: string;
  name: string;
  description: string;
  category: string;
  price: number;
  effectivePrice?: number;
  activeSale?: ActiveSale | null;
  comparePrice?: number;
  costPerItem?: number;
  sku?: string;
  barcode?: string;
  quantity: number;
  trackQuantity: boolean;
  images: string[];
  weight?: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
  tags: string[];
  status: 'active' | 'draft' | 'archived' | 'pending_approval' | 'rejected' | 'suspended';
  // Category-specific attributes
  categoryAttributes: Record<string, string | number | boolean>;
  // Admin moderation fields
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
  suspendedBy?: string;
  suspendedAt?: string;
  suspensionReason?: string;
  isFeatured?: boolean;
  featuredAt?: string;
  featuredBy?: string;
  createdAt: string;
  updatedAt: string;
}

interface ProductsState {
  products: Product[];
  lastSyncedAt: string | null;

  // Actions
  addProduct: (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => Product;
  updateProduct: (id: string, updates: Partial<Product>) => void;
  deleteProduct: (id: string) => void;
  getProductById: (id: string) => Product | undefined;
  getProductsByVendor: (vendorId: string) => Product[];
  getActiveProducts: () => Product[];
  reduceInventory: (id: string, quantity: number) => boolean;
  searchProducts: (query: string) => Product[];

  // API sync functions
  setProducts: (products: Product[]) => void;
  syncFromApi: () => Promise<void>;
  syncVendorProducts: (vendorId: string) => Promise<void>;

  // Admin product management
  getAllProducts: () => Product[];
  getPendingApprovalProducts: () => Product[];
  getSuspendedProducts: () => Product[];
  approveProduct: (id: string, adminId: string) => void;
  rejectProduct: (id: string, adminId: string, reason: string) => void;
  suspendProduct: (id: string, adminId: string, reason: string) => void;
  unsuspendProduct: (id: string, adminId: string) => void;
  featureProduct: (id: string, adminId: string) => void;
  unfeatureProduct: (id: string, adminId: string) => void;
  adminDeleteProduct: (id: string, adminId: string) => void;
  getProductsByCategory: (category: string) => Product[];
  getFeaturedProducts: () => Product[];
}

export const useProductsStore = create<ProductsState>()(
  persist(
    (set, get) => ({
      products: [],
      lastSyncedAt: null,

      setProducts: (products) => {
        set({ products, lastSyncedAt: new Date().toISOString() });
      },

      syncFromApi: async () => {
        try {
          const response = await fetch('/api/products?status=active', {
            credentials: 'include',
          });
          if (response.ok) {
            const data = await response.json();
            set({
              products: data.products || [],
              lastSyncedAt: new Date().toISOString(),
            });
          }
        } catch (error) {
          console.error('Failed to sync products from API:', error);
        }
      },

      syncVendorProducts: async (vendorId: string) => {
        try {
          const response = await fetch(`/api/products?vendorId=${vendorId}`, {
            credentials: 'include',
          });
          if (response.ok) {
            const data = await response.json();
            const apiProducts = data.products || [];
            // Merge with existing products, replacing vendor's products
            set((state) => {
              const otherProducts = state.products.filter((p) => p.vendorId !== vendorId);
              return {
                products: [...otherProducts, ...apiProducts],
                lastSyncedAt: new Date().toISOString(),
              };
            });
          }
        } catch (error) {
          console.error('Failed to sync vendor products from API:', error);
        }
      },

      addProduct: (productData) => {
        const now = new Date().toISOString();
        const newProduct: Product = {
          ...productData,
          id: `prod_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({
          products: [...state.products, newProduct],
        }));
        return newProduct;
      },

      updateProduct: (id, updates) => {
        set((state) => ({
          products: state.products.map((product) =>
            product.id === id
              ? { ...product, ...updates, updatedAt: new Date().toISOString() }
              : product
          ),
        }));
      },

      deleteProduct: (id) => {
        set((state) => ({
          products: state.products.filter((product) => product.id !== id),
        }));
      },

      getProductById: (id) => {
        return get().products.find((product) => product.id === id);
      },

      getProductsByVendor: (vendorId) => {
        return get().products.filter((product) => product.vendorId === vendorId);
      },

      getActiveProducts: () => {
        return get().products.filter((product) => product.status === 'active');
      },

      reduceInventory: (id, quantity) => {
        const product = get().getProductById(id);
        if (!product) return false;

        if (product.trackQuantity && product.quantity < quantity) {
          return false; // Not enough inventory
        }

        if (product.trackQuantity) {
          get().updateProduct(id, { quantity: product.quantity - quantity });
        }
        return true;
      },

      searchProducts: (query) => {
        const lowerQuery = query.toLowerCase();
        return get().products.filter(
          (product) =>
            product.status === 'active' &&
            (product.name.toLowerCase().includes(lowerQuery) ||
              product.description.toLowerCase().includes(lowerQuery) ||
              (product.category && product.category.toLowerCase().includes(lowerQuery)) ||
              product.tags.some((tag) => tag.toLowerCase().includes(lowerQuery)))
        );
      },

      // Admin product management
      getAllProducts: () => get().products,

      getPendingApprovalProducts: () => get().products.filter(p => p.status === 'pending_approval' || p.approvalStatus === 'pending'),

      getSuspendedProducts: () => get().products.filter(p => p.status === 'suspended'),

      approveProduct: (id, adminId) => {
        get().updateProduct(id, {
          status: 'active',
          approvalStatus: 'approved',
          approvedBy: adminId,
          approvedAt: new Date().toISOString(),
        });
      },

      rejectProduct: (id, adminId, reason) => {
        get().updateProduct(id, {
          status: 'rejected',
          approvalStatus: 'rejected',
          approvedBy: adminId,
          approvedAt: new Date().toISOString(),
          rejectionReason: reason,
        });
      },

      suspendProduct: (id, adminId, reason) => {
        get().updateProduct(id, {
          status: 'suspended',
          suspendedBy: adminId,
          suspendedAt: new Date().toISOString(),
          suspensionReason: reason,
        });
      },

      unsuspendProduct: (id, adminId) => {
        get().updateProduct(id, {
          status: 'active',
          suspendedBy: undefined,
          suspendedAt: undefined,
          suspensionReason: undefined,
        });
      },

      featureProduct: (id, adminId) => {
        get().updateProduct(id, {
          isFeatured: true,
          featuredAt: new Date().toISOString(),
          featuredBy: adminId,
        });
      },

      unfeatureProduct: (id, adminId) => {
        get().updateProduct(id, {
          isFeatured: false,
          featuredAt: undefined,
          featuredBy: undefined,
        });
      },

      adminDeleteProduct: (id, adminId) => {
        set((state) => ({
          products: state.products.filter((product) => product.id !== id),
        }));
      },

      getProductsByCategory: (category) => get().products.filter(p => p.category === category && p.status === 'active'),

      getFeaturedProducts: () => get().products.filter(p => p.isFeatured && p.status === 'active'),
    }),
    {
      name: 'marketplace-products',
    }
  )
);
