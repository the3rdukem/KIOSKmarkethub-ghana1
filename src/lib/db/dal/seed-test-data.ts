/**
 * Seed Test Data
 *
 * Creates test vendors and products for development and testing.
 * Call this from the DB initialization or manually via API.
 */

import { getDatabase } from '../index';
import { v4 as uuidv4 } from 'uuid';
import { hashPasswordSync } from '@/lib/utils/crypto';

/**
 * Seed test vendor and products
 */
export function seedTestData(): void {
  const db = getDatabase();

  // Check if test vendor already exists
  const existingVendor = db.prepare(
    "SELECT id FROM users WHERE email = 'testvendor@markethub.gh'"
  ).get();

  if (existingVendor) {
    console.log('[SEED] Test data already exists');
    return;
  }

  const now = new Date().toISOString();
  const vendorUserId = `user_${uuidv4().replace(/-/g, '').substring(0, 16)}`;
  const vendorId = `vendor_${uuidv4().replace(/-/g, '').substring(0, 16)}`;

  // Create test vendor user
  db.prepare(`
    INSERT INTO users (id, email, password_hash, name, role, status, phone, location, business_name, verification_status, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'vendor', 'active', ?, ?, ?, 'verified', ?, ?)
  `).run(
    vendorUserId,
    'testvendor@markethub.gh',
    hashPasswordSync('TestVendor123!'),
    'Ghana Electronics Store',
    '+233 24 555 1234',
    'Accra, Greater Accra',
    'Ghana Electronics',
    now,
    now
  );

  // Create vendor record
  db.prepare(`
    INSERT INTO vendors (id, user_id, business_name, business_type, description, phone, email, address, city, region, verification_status, store_status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'verified', 'active', ?, ?)
  `).run(
    vendorId,
    vendorUserId,
    'Ghana Electronics',
    'Retailer',
    'Premium electronics and gadgets at affordable prices. Authorized dealer for Apple, Samsung, and more.',
    '+233 24 555 1234',
    'testvendor@markethub.gh',
    '15 Oxford Street, Osu',
    'Accra',
    'Greater Accra',
    now,
    now
  );

  // Create test products
  const products = [
    {
      name: 'iPhone 15 Pro Max 256GB',
      description: 'Brand new Apple iPhone 15 Pro Max with 256GB storage. Natural Titanium color. 1 year warranty included.',
      category: 'Electronics',
      price: 8500.00,
      comparePrice: 9200.00,
      quantity: 15,
      images: JSON.stringify(['https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=500']),
      tags: JSON.stringify(['iPhone', 'Apple', 'smartphone', 'premium']),
    },
    {
      name: 'Samsung Galaxy S24 Ultra',
      description: 'Samsung Galaxy S24 Ultra with S Pen. 512GB storage, Titanium Black. Official Ghana warranty.',
      category: 'Electronics',
      price: 7200.00,
      comparePrice: 7800.00,
      quantity: 20,
      images: JSON.stringify(['https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=500']),
      tags: JSON.stringify(['Samsung', 'Galaxy', 'Android', 'smartphone']),
    },
    {
      name: 'MacBook Air M3 15-inch',
      description: 'Apple MacBook Air with M3 chip. 15-inch Liquid Retina display, 8GB RAM, 256GB SSD.',
      category: 'Electronics',
      price: 12500.00,
      comparePrice: 13500.00,
      quantity: 8,
      images: JSON.stringify(['https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=500']),
      tags: JSON.stringify(['MacBook', 'Apple', 'laptop', 'M3']),
    },
    {
      name: 'AirPods Pro (2nd Gen)',
      description: 'Apple AirPods Pro with MagSafe Charging Case. Active Noise Cancellation, Transparency mode.',
      category: 'Electronics',
      price: 1450.00,
      comparePrice: 1600.00,
      quantity: 50,
      images: JSON.stringify(['https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?w=500']),
      tags: JSON.stringify(['AirPods', 'Apple', 'earbuds', 'wireless']),
    },
    {
      name: 'Sony WH-1000XM5 Headphones',
      description: 'Premium wireless noise-canceling headphones. 30-hour battery life, multipoint connection.',
      category: 'Electronics',
      price: 2200.00,
      comparePrice: 2500.00,
      quantity: 25,
      images: JSON.stringify(['https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=500']),
      tags: JSON.stringify(['Sony', 'headphones', 'wireless', 'noise-canceling']),
    },
    {
      name: 'Traditional Kente Cloth',
      description: 'Authentic hand-woven Kente cloth from Bonwire. Perfect for special occasions. 12 yards.',
      category: 'Fashion',
      price: 850.00,
      comparePrice: 1000.00,
      quantity: 30,
      images: JSON.stringify(['https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=500']),
      tags: JSON.stringify(['Kente', 'traditional', 'Ghana', 'fashion']),
    },
  ];

  for (const product of products) {
    const productId = `prod_${uuidv4().replace(/-/g, '').substring(0, 16)}`;
    db.prepare(`
      INSERT INTO products (
        id, vendor_id, vendor_name, name, description, category, price, compare_price,
        quantity, track_quantity, images, tags, status, approval_status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, 'active', 'approved', ?, ?)
    `).run(
      productId,
      vendorUserId,
      'Ghana Electronics',
      product.name,
      product.description,
      product.category,
      product.price,
      product.comparePrice,
      product.quantity,
      product.images,
      product.tags,
      now,
      now
    );
  }

  console.log('[SEED] Test vendor and products created successfully');
  console.log('[SEED] Test Vendor Login: testvendor@markethub.gh / TestVendor123!');
}

/**
 * Create a test buyer account
 */
export function seedTestBuyer(): void {
  const db = getDatabase();

  // Check if test buyer already exists
  const existingBuyer = db.prepare(
    "SELECT id FROM users WHERE email = 'testbuyer@markethub.gh'"
  ).get();

  if (existingBuyer) {
    console.log('[SEED] Test buyer already exists');
    return;
  }

  const now = new Date().toISOString();
  const buyerId = `user_${uuidv4().replace(/-/g, '').substring(0, 16)}`;

  db.prepare(`
    INSERT INTO users (id, email, password_hash, name, role, status, phone, location, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'buyer', 'active', ?, ?, ?, ?)
  `).run(
    buyerId,
    'testbuyer@markethub.gh',
    hashPasswordSync('TestBuyer123!'),
    'Test Buyer',
    '+233 24 555 5678',
    'Kumasi, Ashanti Region',
    now,
    now
  );

  console.log('[SEED] Test buyer created: testbuyer@markethub.gh / TestBuyer123!');
}

/**
 * Seed all test data
 */
export function seedAllTestData(): void {
  seedTestData();
  seedTestBuyer();
}
