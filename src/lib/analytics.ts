/**
 * Analytics Event Tracking System
 * 
 * Phase 4A: Non-invasive analytics instrumentation
 * 
 * Features:
 * - Page views tracking
 * - Product views tracking
 * - Checkout start tracking
 * - Payment success/failure tracking
 * - No PII leakage (only IDs, not emails/names)
 * - Non-blocking (async fire-and-forget)
 * 
 * Currently stores events in-memory with localStorage persistence.
 * Ready for integration with external analytics providers.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Event types
export type AnalyticsEventType =
  | 'page_view'
  | 'product_view'
  | 'product_click'
  | 'add_to_cart'
  | 'remove_from_cart'
  | 'checkout_start'
  | 'checkout_complete'
  | 'payment_initiated'
  | 'payment_success'
  | 'payment_failed'
  | 'search'
  | 'filter_applied'
  | 'wishlist_add'
  | 'wishlist_remove'
  | 'login'
  | 'logout'
  | 'signup';

// Event properties (no PII)
export interface AnalyticsEvent {
  id: string;
  type: AnalyticsEventType;
  timestamp: string;
  sessionId: string;
  userId?: string; // Optional, only ID not email
  properties: Record<string, string | number | boolean | null>;
}

export interface PageViewProperties {
  path: string;
  title?: string;
  referrer?: string;
}

export interface ProductViewProperties {
  productId: string;
  categoryId?: string;
  vendorId?: string;
  price?: number;
}

export interface CartProperties {
  productId: string;
  quantity: number;
  price?: number;
}

export interface CheckoutProperties {
  orderId?: string;
  itemCount: number;
  totalAmount: number;
  currency?: string;
}

export interface PaymentProperties {
  orderId: string;
  amount: number;
  currency: string;
  provider?: string;
  method?: string;
}

export interface SearchProperties {
  query: string;
  resultCount?: number;
  categoryId?: string;
}

// Analytics store
interface AnalyticsState {
  events: AnalyticsEvent[];
  sessionId: string;
  userId: string | null;
  isEnabled: boolean;
  
  // Actions
  trackEvent: (type: AnalyticsEventType, properties?: Record<string, string | number | boolean | null>) => void;
  trackPageView: (props: PageViewProperties) => void;
  trackProductView: (props: ProductViewProperties) => void;
  trackAddToCart: (props: CartProperties) => void;
  trackRemoveFromCart: (props: CartProperties) => void;
  trackCheckoutStart: (props: CheckoutProperties) => void;
  trackCheckoutComplete: (props: CheckoutProperties) => void;
  trackPaymentInitiated: (props: PaymentProperties) => void;
  trackPaymentSuccess: (props: PaymentProperties) => void;
  trackPaymentFailed: (props: PaymentProperties & { error?: string }) => void;
  trackSearch: (props: SearchProperties) => void;
  trackLogin: (userId: string, method: 'email' | 'google') => void;
  trackLogout: () => void;
  trackSignup: (userId: string, role: 'buyer' | 'vendor', method: 'email' | 'google') => void;
  
  // Utility
  setUserId: (userId: string | null) => void;
  setEnabled: (enabled: boolean) => void;
  clearEvents: () => void;
  getRecentEvents: (limit?: number) => AnalyticsEvent[];
}

// Generate session ID
function generateSessionId(): string {
  return `sess_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
}

// Generate event ID
function generateEventId(): string {
  return `evt_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
}

// Get or create session ID
function getSessionId(): string {
  if (typeof window === 'undefined') {
    return generateSessionId();
  }
  
  let sessionId = sessionStorage.getItem('analytics_session_id');
  if (!sessionId) {
    sessionId = generateSessionId();
    sessionStorage.setItem('analytics_session_id', sessionId);
  }
  return sessionId;
}

export const useAnalytics = create<AnalyticsState>()(
  persist(
    (set, get) => ({
      events: [],
      sessionId: getSessionId(),
      userId: null,
      isEnabled: true,
      
      trackEvent: (type, properties = {}) => {
        if (!get().isEnabled) return;
        
        const event: AnalyticsEvent = {
          id: generateEventId(),
          type,
          timestamp: new Date().toISOString(),
          sessionId: get().sessionId,
          userId: get().userId || undefined,
          properties,
        };
        
        set((state) => ({
          events: [...state.events.slice(-999), event], // Keep last 1000 events
        }));
        
        // Fire and forget - can be replaced with external provider
        if (typeof window !== 'undefined') {
          console.log('[ANALYTICS]', type, properties);
        }
      },
      
      trackPageView: (props) => {
        get().trackEvent('page_view', {
          path: props.path,
          title: props.title || null,
          referrer: props.referrer || null,
        });
      },
      
      trackProductView: (props) => {
        get().trackEvent('product_view', {
          productId: props.productId,
          categoryId: props.categoryId || null,
          vendorId: props.vendorId || null,
          price: props.price || null,
        });
      },
      
      trackAddToCart: (props) => {
        get().trackEvent('add_to_cart', {
          productId: props.productId,
          quantity: props.quantity,
          price: props.price || null,
        });
      },
      
      trackRemoveFromCart: (props) => {
        get().trackEvent('remove_from_cart', {
          productId: props.productId,
          quantity: props.quantity,
          price: props.price || null,
        });
      },
      
      trackCheckoutStart: (props) => {
        get().trackEvent('checkout_start', {
          orderId: props.orderId || null,
          itemCount: props.itemCount,
          totalAmount: props.totalAmount,
          currency: props.currency || 'GHS',
        });
      },
      
      trackCheckoutComplete: (props) => {
        get().trackEvent('checkout_complete', {
          orderId: props.orderId || null,
          itemCount: props.itemCount,
          totalAmount: props.totalAmount,
          currency: props.currency || 'GHS',
        });
      },
      
      trackPaymentInitiated: (props) => {
        get().trackEvent('payment_initiated', {
          orderId: props.orderId,
          amount: props.amount,
          currency: props.currency,
          provider: props.provider || null,
          method: props.method || null,
        });
      },
      
      trackPaymentSuccess: (props) => {
        get().trackEvent('payment_success', {
          orderId: props.orderId,
          amount: props.amount,
          currency: props.currency,
          provider: props.provider || null,
          method: props.method || null,
        });
      },
      
      trackPaymentFailed: (props) => {
        get().trackEvent('payment_failed', {
          orderId: props.orderId,
          amount: props.amount,
          currency: props.currency,
          provider: props.provider || null,
          method: props.method || null,
          error: props.error || null,
        });
      },
      
      trackSearch: (props) => {
        get().trackEvent('search', {
          query: props.query,
          resultCount: props.resultCount ?? null,
          categoryId: props.categoryId || null,
        });
      },
      
      trackLogin: (userId, method) => {
        set({ userId });
        get().trackEvent('login', {
          userId,
          method,
        });
      },
      
      trackLogout: () => {
        get().trackEvent('logout', {});
        set({ userId: null });
      },
      
      trackSignup: (userId, role, method) => {
        set({ userId });
        get().trackEvent('signup', {
          userId,
          role,
          method,
        });
      },
      
      setUserId: (userId) => set({ userId }),
      setEnabled: (enabled) => set({ isEnabled: enabled }),
      
      clearEvents: () => set({ events: [] }),
      
      getRecentEvents: (limit = 100) => {
        return get().events.slice(-limit);
      },
    }),
    {
      name: 'analytics-storage',
      partialize: (state) => ({
        events: state.events.slice(-100), // Only persist last 100 events
        userId: state.userId,
        isEnabled: state.isEnabled,
      }),
    }
  )
);

// Hook for easy analytics access
export function useTrackPageView(path: string, title?: string) {
  const trackPageView = useAnalytics((state) => state.trackPageView);
  
  // Track on mount
  if (typeof window !== 'undefined') {
    // Use effect would be better but this is simpler for now
    setTimeout(() => {
      trackPageView({ path, title, referrer: document.referrer });
    }, 0);
  }
}

// Non-hook tracking for server-side or utility contexts
export const analytics = {
  trackEvent: (type: AnalyticsEventType, properties?: Record<string, string | number | boolean | null>) => {
    if (typeof window !== 'undefined') {
      useAnalytics.getState().trackEvent(type, properties);
    }
  },
  trackPageView: (props: PageViewProperties) => {
    if (typeof window !== 'undefined') {
      useAnalytics.getState().trackPageView(props);
    }
  },
  trackProductView: (props: ProductViewProperties) => {
    if (typeof window !== 'undefined') {
      useAnalytics.getState().trackProductView(props);
    }
  },
  trackAddToCart: (props: CartProperties) => {
    if (typeof window !== 'undefined') {
      useAnalytics.getState().trackAddToCart(props);
    }
  },
  trackCheckoutStart: (props: CheckoutProperties) => {
    if (typeof window !== 'undefined') {
      useAnalytics.getState().trackCheckoutStart(props);
    }
  },
  trackPaymentInitiated: (props: PaymentProperties) => {
    if (typeof window !== 'undefined') {
      useAnalytics.getState().trackPaymentInitiated(props);
    }
  },
  trackPaymentSuccess: (props: PaymentProperties) => {
    if (typeof window !== 'undefined') {
      useAnalytics.getState().trackPaymentSuccess(props);
    }
  },
  trackPaymentFailed: (props: PaymentProperties & { error?: string }) => {
    if (typeof window !== 'undefined') {
      useAnalytics.getState().trackPaymentFailed(props);
    }
  },
  trackSearch: (props: SearchProperties) => {
    if (typeof window !== 'undefined') {
      useAnalytics.getState().trackSearch(props);
    }
  },
  trackLogin: (userId: string, method: 'email' | 'google') => {
    if (typeof window !== 'undefined') {
      useAnalytics.getState().trackLogin(userId, method);
    }
  },
  trackSignup: (userId: string, role: 'buyer' | 'vendor', method: 'email' | 'google') => {
    if (typeof window !== 'undefined') {
      useAnalytics.getState().trackSignup(userId, role, method);
    }
  },
};
