/**
 * Site Settings Store
 *
 * Comprehensive CMS for MASTER_ADMIN control of:
 * - Site branding (name, logo, tagline)
 * - Homepage content (hero, banners, featured items)
 * - Static pages (About, Terms, Privacy, FAQ, etc.)
 * - Footer content
 * - Promotional content
 * - Featured products/vendors
 *
 * All settings persist independently and are MASTER_ADMIN only.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface HeroBanner {
  id: string;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  backgroundColor?: string;
  textColor?: string;
  ctaText?: string;
  ctaLink?: string;
  isActive: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface PromotionalBanner {
  id: string;
  title: string;
  description?: string;
  imageUrl?: string;
  linkUrl?: string;
  position: 'top' | 'sidebar' | 'footer' | 'popup';
  startDate?: string;
  endDate?: string;
  isActive: boolean;
  order: number;
  mediaType?: 'image' | 'video';
  videoUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StaticPage {
  id: string;
  slug: string;
  title: string;
  content: string;
  metaTitle?: string;
  metaDescription?: string;
  isPublished: boolean;
  showInFooter: boolean;
  showInHeader: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface FooterLink {
  id: string;
  title: string;
  url: string;
  section: 'company' | 'support' | 'legal' | 'social';
  order: number;
  isExternal: boolean;
  isActive: boolean;
}

export interface FeaturedProduct {
  productId: string;
  position: number;
  startDate?: string;
  endDate?: string;
  isActive: boolean;
  addedAt: string;
  addedBy: string;
}

export interface FeaturedVendor {
  vendorId: string;
  position: number;
  startDate?: string;
  endDate?: string;
  isActive: boolean;
  addedAt: string;
  addedBy: string;
}

export interface HomepageSection {
  id: string;
  type: 'hero' | 'featured_products' | 'featured_vendors' | 'categories' | 'banner' | 'testimonials' | 'stats' | 'cta' | 'custom';
  title?: string;
  subtitle?: string;
  isVisible: boolean;
  order: number;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface SiteBranding {
  siteName: string;
  tagline: string;
  logoUrl?: string;
  logoAltText?: string;
  faviconUrl?: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  footerText: string;
  copyrightText: string;
  socialLinks: {
    facebook?: string;
    twitter?: string;
    instagram?: string;
    linkedin?: string;
    youtube?: string;
    tiktok?: string;
  };
  contactEmail: string;
  contactPhone: string;
  contactAddress: string;
}

export interface SiteSettingsAuditLog {
  id: string;
  action: string;
  section: 'branding' | 'hero' | 'banner' | 'page' | 'footer' | 'featured' | 'homepage' | 'general';
  adminId: string;
  adminEmail: string;
  details: string;
  previousValue?: string;
  newValue?: string;
  timestamp: string;
}

const DEFAULT_BRANDING: SiteBranding = {
  siteName: 'KIOSK',
  tagline: "Ghana's Trusted Marketplace",
  primaryColor: '#16a34a',
  secondaryColor: '#2563eb',
  accentColor: '#f59e0b',
  footerText: 'Your trusted marketplace for quality products from verified vendors across Ghana.',
  copyrightText: '© 2024 KIOSK. All rights reserved.',
  socialLinks: {},
  contactEmail: 'support@kiosk.com.gh',
  contactPhone: '+233 XX XXX XXXX',
  contactAddress: 'Accra, Ghana',
};

const DEFAULT_PAGES: StaticPage[] = [
  {
    id: 'page_about',
    slug: 'about',
    title: 'About Us',
    content: '<h1>About KIOSK</h1><p>KIOSK is Ghana\'s most trusted online marketplace.</p>',
    isPublished: true,
    showInFooter: true,
    showInHeader: false,
    order: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'page_terms',
    slug: 'terms',
    title: 'Terms of Service',
    content: '<h1>Terms of Service</h1><p>By using KIOSK, you agree to these terms...</p>',
    isPublished: true,
    showInFooter: true,
    showInHeader: false,
    order: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'page_privacy',
    slug: 'privacy',
    title: 'Privacy Policy',
    content: '<h1>Privacy Policy</h1><p>Your privacy is important to us...</p>',
    isPublished: true,
    showInFooter: true,
    showInHeader: false,
    order: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'page_faq',
    slug: 'faq',
    title: 'FAQ',
    content: '<h1>Frequently Asked Questions</h1><p>Find answers to common questions.</p>',
    isPublished: true,
    showInFooter: true,
    showInHeader: false,
    order: 4,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const DEFAULT_HOMEPAGE_SECTIONS: HomepageSection[] = [
  { id: 'section_hero', type: 'hero', title: 'Shop with Confidence', isVisible: true, order: 1, config: {}, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'section_stats', type: 'stats', title: 'Platform Statistics', isVisible: true, order: 2, config: {}, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'section_categories', type: 'categories', title: 'Shop by Category', isVisible: true, order: 3, config: {}, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'section_featured_products', type: 'featured_products', title: 'Featured Products', isVisible: true, order: 4, config: {}, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'section_cta', type: 'cta', title: 'Join KIOSK Today', isVisible: true, order: 5, config: {}, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
];

interface SiteSettingsState {
  branding: SiteBranding;
  heroBanners: HeroBanner[];
  promotionalBanners: PromotionalBanner[];
  staticPages: StaticPage[];
  footerLinks: FooterLink[];
  featuredProducts: FeaturedProduct[];
  featuredVendors: FeaturedVendor[];
  homepageSections: HomepageSection[];
  auditLogs: SiteSettingsAuditLog[];
  isInitialized: boolean;

  initializeSiteSettings: () => void;
  updateBranding: (updates: Partial<SiteBranding>, adminId: string, adminEmail: string) => void;
  getBranding: () => SiteBranding;

  addHeroBanner: (banner: Omit<HeroBanner, 'id' | 'createdAt' | 'updatedAt'>, adminId: string, adminEmail: string) => HeroBanner;
  updateHeroBanner: (id: string, updates: Partial<HeroBanner>, adminId: string, adminEmail: string) => void;
  deleteHeroBanner: (id: string, adminId: string, adminEmail: string) => void;
  getActiveHeroBanners: () => HeroBanner[];

  addPromotionalBanner: (banner: Omit<PromotionalBanner, 'id' | 'createdAt' | 'updatedAt'>, adminId: string, adminEmail: string) => PromotionalBanner;
  updatePromotionalBanner: (id: string, updates: Partial<PromotionalBanner>, adminId: string, adminEmail: string) => void;
  deletePromotionalBanner: (id: string, adminId: string, adminEmail: string) => void;
  getActivePromotionalBanners: (position?: PromotionalBanner['position']) => PromotionalBanner[];

  addStaticPage: (page: Omit<StaticPage, 'id' | 'createdAt' | 'updatedAt'>, adminId: string, adminEmail: string) => StaticPage;
  updateStaticPage: (id: string, updates: Partial<StaticPage>, adminId: string, adminEmail: string) => void;
  deleteStaticPage: (id: string, adminId: string, adminEmail: string) => void;
  publishStaticPage: (id: string, adminId: string, adminEmail: string) => void;
  unpublishStaticPage: (id: string, adminId: string, adminEmail: string) => void;
  getPageBySlug: (slug: string) => StaticPage | undefined;
  getPublishedPages: () => StaticPage[];
  getFooterPages: () => StaticPage[];

  addFeaturedProduct: (productId: string, position: number, adminId: string, adminEmail: string) => void;
  removeFeaturedProduct: (productId: string, adminId: string, adminEmail: string) => void;
  getActiveFeaturedProducts: () => FeaturedProduct[];

  addFeaturedVendor: (vendorId: string, position: number, adminId: string, adminEmail: string) => void;
  removeFeaturedVendor: (vendorId: string, adminId: string, adminEmail: string) => void;
  getActiveFeaturedVendors: () => FeaturedVendor[];

  updateHomepageSection: (id: string, updates: Partial<HomepageSection>, adminId: string, adminEmail: string) => void;
  toggleHomepageSection: (id: string, adminId: string, adminEmail: string) => void;
  reorderHomepageSections: (sectionIds: string[], adminId: string, adminEmail: string) => void;
  getVisibleHomepageSections: () => HomepageSection[];

  addAuditLog: (log: Omit<SiteSettingsAuditLog, 'id' | 'timestamp'>) => void;
  getAuditLogs: (section?: SiteSettingsAuditLog['section']) => SiteSettingsAuditLog[];
}

export const useSiteSettingsStore = create<SiteSettingsState>()(
  persist(
    (set, get) => ({
      branding: DEFAULT_BRANDING,
      heroBanners: [],
      promotionalBanners: [],
      staticPages: [],
      footerLinks: [],
      featuredProducts: [],
      featuredVendors: [],
      homepageSections: [],
      auditLogs: [],
      isInitialized: false,

      initializeSiteSettings: () => {
        const state = get();
        if (state.isInitialized) return;
        set({
          staticPages: state.staticPages.length > 0 ? state.staticPages : DEFAULT_PAGES,
          homepageSections: state.homepageSections.length > 0 ? state.homepageSections : DEFAULT_HOMEPAGE_SECTIONS,
          isInitialized: true,
        });
      },

      updateBranding: (updates, adminId, adminEmail) => {
        set((state) => ({ branding: { ...state.branding, ...updates } }));
        get().addAuditLog({ action: 'BRANDING_UPDATED', section: 'branding', adminId, adminEmail, details: `Updated: ${Object.keys(updates).join(', ')}` });
      },

      getBranding: () => get().branding,

      addHeroBanner: (bannerData, adminId, adminEmail) => {
        const now = new Date().toISOString();
        const newBanner: HeroBanner = { ...bannerData, id: `hero_${Date.now()}`, createdAt: now, updatedAt: now };
        set((state) => ({ heroBanners: [...state.heroBanners, newBanner] }));
        get().addAuditLog({ action: 'HERO_BANNER_ADDED', section: 'hero', adminId, adminEmail, details: `Added: ${newBanner.title}` });
        return newBanner;
      },

      updateHeroBanner: (id, updates, adminId, adminEmail) => {
        set((state) => ({ heroBanners: state.heroBanners.map(b => b.id === id ? { ...b, ...updates, updatedAt: new Date().toISOString() } : b) }));
        get().addAuditLog({ action: 'HERO_BANNER_UPDATED', section: 'hero', adminId, adminEmail, details: `Updated banner: ${id}` });
      },

      deleteHeroBanner: (id, adminId, adminEmail) => {
        set((state) => ({ heroBanners: state.heroBanners.filter(b => b.id !== id) }));
        get().addAuditLog({ action: 'HERO_BANNER_DELETED', section: 'hero', adminId, adminEmail, details: `Deleted banner: ${id}` });
      },

      getActiveHeroBanners: () => get().heroBanners.filter(b => b.isActive).sort((a, b) => a.order - b.order),

      addPromotionalBanner: (bannerData, adminId, adminEmail) => {
        const now = new Date().toISOString();
        const newBanner: PromotionalBanner = { ...bannerData, id: `promo_${Date.now()}`, createdAt: now, updatedAt: now };
        set((state) => ({ promotionalBanners: [...state.promotionalBanners, newBanner] }));
        get().addAuditLog({ action: 'PROMO_BANNER_ADDED', section: 'banner', adminId, adminEmail, details: `Added: ${newBanner.title}` });
        return newBanner;
      },

      updatePromotionalBanner: (id, updates, adminId, adminEmail) => {
        set((state) => ({ promotionalBanners: state.promotionalBanners.map(b => b.id === id ? { ...b, ...updates, updatedAt: new Date().toISOString() } : b) }));
        get().addAuditLog({ action: 'PROMO_BANNER_UPDATED', section: 'banner', adminId, adminEmail, details: `Updated banner: ${id}` });
      },

      deletePromotionalBanner: (id, adminId, adminEmail) => {
        set((state) => ({ promotionalBanners: state.promotionalBanners.filter(b => b.id !== id) }));
        get().addAuditLog({ action: 'PROMO_BANNER_DELETED', section: 'banner', adminId, adminEmail, details: `Deleted banner: ${id}` });
      },

      getActivePromotionalBanners: (position) => {
        const now = new Date().toISOString();
        return get().promotionalBanners.filter(b => b.isActive && (!position || b.position === position) && (!b.startDate || b.startDate <= now) && (!b.endDate || b.endDate >= now)).sort((a, b) => a.order - b.order);
      },

      addStaticPage: (pageData, adminId, adminEmail) => {
        const now = new Date().toISOString();
        const newPage: StaticPage = { ...pageData, id: `page_${Date.now()}`, createdAt: now, updatedAt: now, createdBy: adminId };
        set((state) => ({ staticPages: [...state.staticPages, newPage] }));
        get().addAuditLog({ action: 'PAGE_ADDED', section: 'page', adminId, adminEmail, details: `Added: ${newPage.title}` });
        return newPage;
      },

      updateStaticPage: (id, updates, adminId, adminEmail) => {
        set((state) => ({ staticPages: state.staticPages.map(p => p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString(), updatedBy: adminId } : p) }));
        get().addAuditLog({ action: 'PAGE_UPDATED', section: 'page', adminId, adminEmail, details: `Updated page: ${id}` });
      },

      deleteStaticPage: (id, adminId, adminEmail) => {
        const page = get().staticPages.find(p => p.id === id);
        set((state) => ({ staticPages: state.staticPages.filter(p => p.id !== id) }));
        get().addAuditLog({ action: 'PAGE_DELETED', section: 'page', adminId, adminEmail, details: `Deleted: ${page?.title}` });
      },

      publishStaticPage: (id, adminId, adminEmail) => {
        set((state) => ({ staticPages: state.staticPages.map(p => p.id === id ? { ...p, isPublished: true, publishedAt: new Date().toISOString() } : p) }));
        get().addAuditLog({ action: 'PAGE_PUBLISHED', section: 'page', adminId, adminEmail, details: `Published page: ${id}` });
      },

      unpublishStaticPage: (id, adminId, adminEmail) => {
        set((state) => ({ staticPages: state.staticPages.map(p => p.id === id ? { ...p, isPublished: false } : p) }));
        get().addAuditLog({ action: 'PAGE_UNPUBLISHED', section: 'page', adminId, adminEmail, details: `Unpublished page: ${id}` });
      },

      getPageBySlug: (slug) => get().staticPages.find(p => p.slug === slug && p.isPublished),
      getPublishedPages: () => get().staticPages.filter(p => p.isPublished).sort((a, b) => a.order - b.order),
      getFooterPages: () => get().staticPages.filter(p => p.isPublished && p.showInFooter).sort((a, b) => a.order - b.order),

      addFeaturedProduct: (productId, position, adminId, adminEmail) => {
        const newFeatured: FeaturedProduct = { productId, position, isActive: true, addedAt: new Date().toISOString(), addedBy: adminId };
        set((state) => ({ featuredProducts: [...state.featuredProducts.filter(f => f.productId !== productId), newFeatured] }));
        get().addAuditLog({ action: 'PRODUCT_FEATURED', section: 'featured', adminId, adminEmail, details: `Featured: ${productId}` });
      },

      removeFeaturedProduct: (productId, adminId, adminEmail) => {
        set((state) => ({ featuredProducts: state.featuredProducts.filter(f => f.productId !== productId) }));
        get().addAuditLog({ action: 'PRODUCT_UNFEATURED', section: 'featured', adminId, adminEmail, details: `Removed: ${productId}` });
      },

      getActiveFeaturedProducts: () => {
        const now = new Date().toISOString();
        return get().featuredProducts.filter(f => f.isActive && (!f.startDate || f.startDate <= now) && (!f.endDate || f.endDate >= now)).sort((a, b) => a.position - b.position);
      },

      addFeaturedVendor: (vendorId, position, adminId, adminEmail) => {
        const newFeatured: FeaturedVendor = { vendorId, position, isActive: true, addedAt: new Date().toISOString(), addedBy: adminId };
        set((state) => ({ featuredVendors: [...state.featuredVendors.filter(f => f.vendorId !== vendorId), newFeatured] }));
        get().addAuditLog({ action: 'VENDOR_FEATURED', section: 'featured', adminId, adminEmail, details: `Featured: ${vendorId}` });
      },

      removeFeaturedVendor: (vendorId, adminId, adminEmail) => {
        set((state) => ({ featuredVendors: state.featuredVendors.filter(f => f.vendorId !== vendorId) }));
        get().addAuditLog({ action: 'VENDOR_UNFEATURED', section: 'featured', adminId, adminEmail, details: `Removed: ${vendorId}` });
      },

      getActiveFeaturedVendors: () => {
        const now = new Date().toISOString();
        return get().featuredVendors.filter(f => f.isActive && (!f.startDate || f.startDate <= now) && (!f.endDate || f.endDate >= now)).sort((a, b) => a.position - b.position);
      },

      updateHomepageSection: (id, updates, adminId, adminEmail) => {
        set((state) => ({ homepageSections: state.homepageSections.map(s => s.id === id ? { ...s, ...updates, updatedAt: new Date().toISOString() } : s) }));
        get().addAuditLog({ action: 'HOMEPAGE_SECTION_UPDATED', section: 'homepage', adminId, adminEmail, details: `Updated section: ${id}` });
      },

      toggleHomepageSection: (id, adminId, adminEmail) => {
        const section = get().homepageSections.find(s => s.id === id);
        set((state) => ({ homepageSections: state.homepageSections.map(s => s.id === id ? { ...s, isVisible: !s.isVisible } : s) }));
        get().addAuditLog({ action: section?.isVisible ? 'SECTION_HIDDEN' : 'SECTION_SHOWN', section: 'homepage', adminId, adminEmail, details: `Toggled: ${id}` });
      },

      reorderHomepageSections: (sectionIds, adminId, adminEmail) => {
        set((state) => ({ homepageSections: state.homepageSections.map(s => ({ ...s, order: sectionIds.indexOf(s.id) + 1 })).sort((a, b) => a.order - b.order) }));
        get().addAuditLog({ action: 'SECTIONS_REORDERED', section: 'homepage', adminId, adminEmail, details: 'Reordered homepage sections' });
      },

      getVisibleHomepageSections: () => get().homepageSections.filter(s => s.isVisible).sort((a, b) => a.order - b.order),

      addAuditLog: (logData) => {
        const newLog: SiteSettingsAuditLog = { ...logData, id: `sitelog_${Date.now()}`, timestamp: new Date().toISOString() };
        set((state) => ({ auditLogs: [newLog, ...state.auditLogs].slice(0, 1000) }));
      },

      getAuditLogs: (section) => {
        const logs = get().auditLogs;
        return section ? logs.filter(log => log.section === section) : logs;
      },
    }),
    { name: 'marketplace-site-settings' }
  )
);
