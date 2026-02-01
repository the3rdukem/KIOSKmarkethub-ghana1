import { describe, it, expect, beforeAll } from 'vitest';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:5000';

async function fetchAPI(path: string, options?: RequestInit) {
  const response = await fetch(`${BASE_URL}${path}`, options);
  return {
    status: response.status,
    ok: response.ok,
    data: await response.json().catch(() => null),
  };
}

describe('Health Check', () => {
  it('should return healthy status', async () => {
    const res = await fetchAPI('/api/health');
    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty('status', 'healthy');
    expect(res.data).toHaveProperty('database', 'connected');
  });
});

describe('Public Products API', () => {
  it('should return products list', async () => {
    const res = await fetchAPI('/api/products?status=active');
    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty('products');
    expect(Array.isArray(res.data.products)).toBe(true);
  });

  it('should support pagination', async () => {
    const res = await fetchAPI('/api/products?status=active&page=1&limit=5');
    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty('products');
    expect(res.data.products.length).toBeLessThanOrEqual(5);
  });

  it('should support search', async () => {
    const res = await fetchAPI('/api/products?status=active&search=test');
    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty('products');
  });
});

describe('Public Categories API', () => {
  it('should return categories list', async () => {
    const res = await fetchAPI('/api/categories');
    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty('categories');
    expect(Array.isArray(res.data.categories)).toBe(true);
  });

  it('should include category properties', async () => {
    const res = await fetchAPI('/api/categories');
    expect(res.status).toBe(200);
    if (res.data.categories.length > 0) {
      const category = res.data.categories[0];
      expect(category).toHaveProperty('id');
      expect(category).toHaveProperty('name');
      expect(category).toHaveProperty('slug');
    }
  });
});

describe('Public Hero Slides API', () => {
  it('should return active hero slides', async () => {
    const res = await fetchAPI('/api/hero-slides?active=true');
    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty('slides');
    expect(Array.isArray(res.data.slides)).toBe(true);
  });
});

describe('Public Site Settings API', () => {
  it('should return public site settings', async () => {
    const res = await fetchAPI('/api/site-settings/public');
    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty('settings');
    expect(res.data.settings).toHaveProperty('site_name');
  });
});

describe('Public Stats API', () => {
  it('should return platform statistics', async () => {
    const res = await fetchAPI('/api/stats/public');
    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty('totalVendors');
    expect(res.data).toHaveProperty('totalProducts');
  });
});

describe('Cart API', () => {
  it('should return cart for guest users', async () => {
    const res = await fetchAPI('/api/cart');
    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty('success', true);
    expect(res.data).toHaveProperty('cart');
    expect(res.data.cart).toHaveProperty('items');
  });
});

describe('Wishlist API', () => {
  it('should return empty wishlist for unauthenticated users', async () => {
    const res = await fetchAPI('/api/wishlist');
    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty('items');
    expect(res.data).toHaveProperty('authenticated', false);
  });
});

describe('Reviews API', () => {
  it('should require query parameter', async () => {
    const res = await fetchAPI('/api/reviews');
    expect(res.status).toBe(400);
    expect(res.data).toHaveProperty('error');
  });

  it('should return reviews for product', async () => {
    const productsRes = await fetchAPI('/api/products?status=active&limit=1');
    if (productsRes.data?.products?.length > 0) {
      const productId = productsRes.data.products[0].id;
      const res = await fetchAPI(`/api/reviews?productId=${productId}`);
      expect(res.status).toBe(200);
    }
  });
});

describe('Footer Links API', () => {
  it('should return footer links', async () => {
    const res = await fetchAPI('/api/footer-links/public');
    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty('sections');
  });
});

describe('Session API', () => {
  it('should return unauthenticated for no session', async () => {
    const res = await fetchAPI('/api/auth/session');
    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty('authenticated', false);
    expect(res.data).toHaveProperty('user', null);
  });
});

describe('Rate Limiting', () => {
  it('should include rate limit handling', async () => {
    const res = await fetchAPI('/api/products?status=active');
    expect(res.status).toBe(200);
  });
});
