/**
 * Auth Store
 *
 * Client-side auth state management.
 * The actual authentication is handled by the server via atomic API routes.
 * This store syncs with the server session.
 * 
 * IMPORTANT: NO localStorage/sessionStorage persistence.
 * Authentication is server-authoritative only via session_token cookie.
 */

import { create } from 'zustand';

export type UserRole = 'buyer' | 'vendor' | 'admin' | 'master_admin';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar?: string;
  adminRole?: 'MASTER_ADMIN' | 'ADMIN';
  permissions?: string[];
  businessName?: string;
  isVerified?: boolean;
  verificationStatus?: 'pending' | 'under_review' | 'verified' | 'rejected' | 'suspended';
  storeDescription?: string;
  storeBanner?: string;
  storeLogo?: string;
  storeWebsite?: string;
  storeBusinessHours?: string;
  storeReturnPolicy?: string;
  storeShippingPolicy?: string;
  storeSpecialties?: string[];
  storeCertifications?: string[];
  storeRating?: number;
  storeResponseTime?: string;
  storeStatus?: 'open' | 'closed' | 'vacation';
  storeVacationMessage?: string;
  storeContactEmail?: string;
  storeContactPhone?: string;
  storeSocialLinks?: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
    whatsapp?: string;
  };
  status?: string;
  phone?: string;
  location?: string;
  createdAt: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isHydrated: boolean;
  setUser: (user: User | null) => void;
  clearAuth: () => void;
  setLoading: (loading: boolean) => void;
  setHydrated: (hydrated: boolean) => void;
  login: (user: User) => void;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
  isMasterAdmin: () => boolean;
  isAdmin: () => boolean;
  hasAdminAccess: () => boolean;
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  isHydrated: false,

  setUser: (user: User | null) => {
    set({
      user,
      isAuthenticated: !!user,
      isLoading: false,
    });
  },

  clearAuth: () => {
    set({ user: null, isAuthenticated: false, isLoading: false });
  },

  setLoading: (loading: boolean) => {
    set({ isLoading: loading });
  },

  setHydrated: (hydrated: boolean) => {
    set({ isHydrated: hydrated });
  },

  login: (user: User) => {
    set({ user, isAuthenticated: true, isLoading: false });
  },

  logout: async () => {
    try {
      set({ isLoading: true });
      
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        console.error('[AUTH_STORE] Logout API returned error:', response.status);
      }

      try {
        const { useCartStore } = await import('./cart-store');
        useCartStore.getState().resetCart();
      } catch (e) {
        console.error('[AUTH_STORE] Failed to clear cart on logout:', e);
      }
    } catch (error) {
      console.error('[AUTH_STORE] Logout error:', error);
    } finally {
      set({ user: null, isAuthenticated: false, isLoading: false });
      
      if (typeof window !== 'undefined') {
        window.location.href = '/auth/login';
      }
    }
  },

  updateUser: (updates: Partial<User>) => {
    const currentUser = get().user;
    if (currentUser) {
      set({ user: { ...currentUser, ...updates } });
    }
  },

  isMasterAdmin: () => {
    const user = get().user;
    return user?.role === 'master_admin' || user?.adminRole === 'MASTER_ADMIN';
  },

  isAdmin: () => {
    const user = get().user;
    return user?.role === 'admin' || user?.role === 'master_admin';
  },

  hasAdminAccess: () => {
    const user = get().user;
    return (
      user?.role === 'admin' ||
      user?.role === 'master_admin' ||
      user?.adminRole === 'ADMIN' ||
      user?.adminRole === 'MASTER_ADMIN'
    );
  },
}));

/**
 * Sync auth state with server session.
 * Call this on app initialization and after navigation.
 */
export async function syncAuthWithServer(): Promise<User | null> {
  try {
    const response = await fetch('/api/auth/session', {
      credentials: 'include',
    });

    if (!response.ok) {
      useAuthStore.getState().clearAuth();
      return null;
    }

    const data = await response.json();

    if (data.authenticated && data.user) {
      useAuthStore.getState().setUser(data.user);
      return data.user;
    } else {
      useAuthStore.getState().clearAuth();
      return null;
    }
  } catch (error) {
    console.error('[AUTH_STORE] Sync error:', error);
    useAuthStore.getState().clearAuth();
    return null;
  }
}

/**
 * Login via API - returns specific error codes on failure
 */
export async function loginViaAPI(
  email: string,
  password: string
): Promise<{ success: boolean; user?: User; error?: string; code?: string; redirect?: string }> {
  try {
    useAuthStore.getState().setLoading(true);

    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      useAuthStore.getState().setLoading(false);
      return {
        success: false,
        error: data.error || 'Login failed',
        code: data.code || 'UNKNOWN_ERROR'
      };
    }

    useAuthStore.getState().login(data.user);

    try {
      await fetch('/api/cart/merge', {
        method: 'POST',
        credentials: 'include',
      });
      const { useCartStore } = await import('./cart-store');
      await useCartStore.getState().syncWithServer();
    } catch (e) {
      console.error('[AUTH_STORE] Cart merge failed:', e);
    }

    return {
      success: true,
      user: data.user,
      redirect: data.redirect
    };
  } catch (error) {
    console.error('[AUTH_STORE] Login error:', error);
    useAuthStore.getState().setLoading(false);
    return { success: false, error: 'Network error', code: 'NETWORK_ERROR' };
  }
}

/**
 * Admin login via API - returns specific error codes on failure
 */
export async function adminLoginViaAPI(
  email: string,
  password: string
): Promise<{ success: boolean; admin?: User; error?: string; code?: string; redirect?: string }> {
  try {
    useAuthStore.getState().setLoading(true);

    const response = await fetch('/api/auth/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      useAuthStore.getState().setLoading(false);
      return {
        success: false,
        error: data.error || 'Admin login failed',
        code: data.code || 'UNKNOWN_ERROR'
      };
    }

    const adminUser: User = {
      id: data.admin.id,
      email: data.admin.email,
      name: data.admin.name,
      role: data.admin.role as UserRole,
      adminRole: data.admin.adminRole,
      permissions: data.admin.permissions,
      createdAt: data.admin.createdAt,
    };

    useAuthStore.getState().login(adminUser);

    return {
      success: true,
      admin: adminUser,
      redirect: data.redirect
    };
  } catch (error) {
    console.error('[AUTH_STORE] Admin login error:', error);
    useAuthStore.getState().setLoading(false);
    return { success: false, error: 'Network error', code: 'NETWORK_ERROR' };
  }
}

/**
 * Register via API - returns specific error codes on failure
 */
export async function registerViaAPI(data: {
  email: string;
  password: string;
  name: string;
  role: 'buyer' | 'vendor';
  phone?: string;
  location?: string;
  businessName?: string;
  businessType?: string;
}): Promise<{ success: boolean; user?: User; error?: string; code?: string; redirect?: string }> {
  try {
    useAuthStore.getState().setLoading(true);

    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });

    const responseData = await response.json();

    if (!response.ok) {
      useAuthStore.getState().setLoading(false);
      return {
        success: false,
        error: responseData.error || 'Registration failed',
        code: responseData.code || 'UNKNOWN_ERROR'
      };
    }

    useAuthStore.getState().login(responseData.user);

    try {
      await fetch('/api/cart/merge', {
        method: 'POST',
        credentials: 'include',
      });
      const { useCartStore } = await import('./cart-store');
      await useCartStore.getState().syncWithServer();
    } catch (e) {
      console.error('[AUTH_STORE] Cart merge after registration failed:', e);
    }

    return {
      success: true,
      user: responseData.user,
      redirect: responseData.redirect
    };
  } catch (error) {
    console.error('[AUTH_STORE] Register error:', error);
    useAuthStore.getState().setLoading(false);
    return { success: false, error: 'Network error', code: 'NETWORK_ERROR' };
  }
}

/**
 * Get route after login based on role
 */
export const getRouteForRole = (role: UserRole): string => {
  switch (role) {
    case 'master_admin':
      return '/admin';
    case 'admin':
      return '/admin';
    case 'vendor':
      return '/vendor';
    case 'buyer':
    default:
      return '/buyer/dashboard';
  }
};

/**
 * Check if user has specific admin permission
 */
export const hasAdminPermission = (user: User | null, permission: string): boolean => {
  if (!user) return false;
  if (user.adminRole === 'MASTER_ADMIN') return true;
  return user.permissions?.includes(permission) ?? false;
};
