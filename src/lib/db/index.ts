/**
 * Database Module - PostgreSQL
 *
 * Production-ready PostgreSQL database for Replit.
 * This module provides:
 * - Database connection pool management
 * - Schema initialization
 * - Transaction support
 *
 * Uses Replit's managed PostgreSQL via PGHOST/PGUSER/etc or DATABASE_URL.
 */

import { Pool, PoolClient, QueryResult } from 'pg';

// Build database connection string from Replit PostgreSQL env vars if available
// This takes precedence over DATABASE_URL to ensure we use the Replit-managed database
function buildConnectionString(): string {
  // Prefer Replit's native PostgreSQL environment variables
  const pgHost = process.env.PGHOST;
  const pgDatabase = process.env.PGDATABASE;
  const pgUser = process.env.PGUSER;
  const pgPassword = process.env.PGPASSWORD;
  const pgPort = process.env.PGPORT || '5432';

  if (pgHost && pgDatabase && pgUser && pgPassword) {
    console.log('[DB] Using Replit PostgreSQL environment variables');
    return `postgresql://${pgUser}:${encodeURIComponent(pgPassword)}@${pgHost}:${pgPort}/${pgDatabase}`;
  }

  // Fallback to DATABASE_URL
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      'PostgreSQL connection not configured. Either PGHOST/PGDATABASE/PGUSER/PGPASSWORD or DATABASE_URL must be set.'
    );
  }

  if (databaseUrl.includes('sqlite')) {
    throw new Error(
      'SQLite is not supported. DATABASE_URL must be a PostgreSQL connection string.'
    );
  }

  // Handle postgres:// vs postgresql:// prefix mismatch
  if (databaseUrl.startsWith('postgres://')) {
    return databaseUrl.replace(/^postgres:\/\//, 'postgresql://');
  }
  return databaseUrl;
}

const connectionString = buildConnectionString();

// Global connection pool
let pool: Pool | null = null;
let isInitialized = false;

/**
 * Get database connection pool (singleton pattern)
 */
export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    pool.on('error', (err) => {
      console.error('[DB] Unexpected pool error:', err);
    });
  }

  return pool;
}

/**
 * Initialize database schema and seed data
 */
export async function initializeDatabase(): Promise<void> {
  if (isInitialized) return;

  const client = await getPool().connect();
  try {
    await createSchema(client);
    await runMigrations(client);
    await seedDefaultCategories(client);
    await seedMasterAdmin(client);
    await sanitizeEmptyCategories(client);
    isInitialized = true;
    console.log('[DB] PostgreSQL database initialized successfully');
  } finally {
    client.release();
  }
}

/**
 * Sanitize empty category strings to NULL
 * CRITICAL: Radix Select crashes if any SelectItem has value=""
 * This ensures legacy/draft products with empty categories don't crash the admin UI
 */
async function sanitizeEmptyCategories(client: PoolClient): Promise<void> {
  const result = await client.query(`
    UPDATE products SET category = NULL WHERE category = ''
  `);
  if (result.rowCount && result.rowCount > 0) {
    console.log(`[DB] Sanitized ${result.rowCount} products with empty category strings`);
  }
}

/**
 * Seed the master admin account if none exists
 */
async function seedMasterAdmin(client: PoolClient): Promise<void> {
  // Check if any master admin exists
  const result = await client.query(
    "SELECT id FROM admin_users WHERE role = 'MASTER_ADMIN' LIMIT 1"
  );
  
  if (result.rows.length > 0) {
    console.log('[DB] Master admin already exists');
    return;
  }

  // Create master admin with environment variables or secure defaults
  const email = process.env.MASTER_ADMIN_EMAIL || 'the3rdukem@gmail.com';
  const password = process.env.MASTER_ADMIN_PASSWORD || '123asdqweX$';
  const name = 'System Administrator';
  
  // Hash password using the same format as users.ts hashPassword()
  // Format: salt:hash where salt is 16 chars from UUID
  const crypto = require('crypto');
  const salt = crypto.randomUUID().substring(0, 16);
  const hash = crypto.createHash('sha256').update(password + salt).digest('hex');
  const passwordHash = `${salt}:${hash}`;
  
  const adminId = `admin_${crypto.randomUUID().replace(/-/g, '').substring(0, 16)}`;
  const now = new Date().toISOString();
  const permissions = JSON.stringify([
    'MANAGE_CATEGORIES', 'MANAGE_PAYMENTS', 'MANAGE_API_KEYS', 'MANAGE_ADMINS',
    'MANAGE_VENDORS', 'MANAGE_USERS', 'MANAGE_PRODUCTS', 'MANAGE_ORDERS',
    'MANAGE_DISPUTES', 'VIEW_AUDIT_LOGS', 'MANAGE_SYSTEM_SETTINGS',
    'VIEW_ANALYTICS', 'MANAGE_SECURITY'
  ]);

  await client.query(`
    INSERT INTO admin_users (
      id, email, password_hash, name, role, is_active, permissions, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
  `, [adminId, email.toLowerCase(), passwordHash, name, 'MASTER_ADMIN', 1, permissions, now, now]);

  console.log('[DB] Master admin created:', email);
}

/**
 * Create database schema
 */
async function createSchema(client: PoolClient): Promise<void> {
  // Check if schema already exists by looking for the users table
  const tableCheck = await client.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'users'
    );
  `);

  if (tableCheck.rows[0].exists) {
    console.log('[DB] Schema already exists, skipping creation');
    
    // Run migrations for existing databases
    await runMigrations(client);
    return;
  }

  console.log('[DB] Creating database schema...');
  
  await client.query(`
    -- Users table
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('buyer', 'vendor', 'admin', 'master_admin')),
      status TEXT NOT NULL DEFAULT 'active',
      avatar TEXT,
      phone TEXT,
      location TEXT,
      business_name TEXT,
      business_type TEXT,
      verification_status TEXT,
      verification_documents TEXT,
      verification_notes TEXT,
      verified_at TEXT,
      verified_by TEXT,
      store_description TEXT,
      store_banner TEXT,
      store_logo TEXT,
      is_deleted INTEGER DEFAULT 0,
      deleted_at TEXT,
      deleted_by TEXT,
      deletion_reason TEXT,
      last_login_at TEXT,
      previous_login_at TEXT,
      created_at TEXT NOT NULL DEFAULT (NOW()::TEXT),
      updated_at TEXT NOT NULL DEFAULT (NOW()::TEXT)
    );

    -- Admin users table
    CREATE TABLE IF NOT EXISTS admin_users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('MASTER_ADMIN', 'ADMIN')),
      is_active INTEGER NOT NULL DEFAULT 1,
      permissions TEXT,
      mfa_enabled INTEGER DEFAULT 0,
      created_by TEXT,
      last_login_at TEXT,
      previous_login_at TEXT,
      created_at TEXT NOT NULL DEFAULT (NOW()::TEXT),
      updated_at TEXT NOT NULL DEFAULT (NOW()::TEXT)
    );

    -- Vendors table
    CREATE TABLE IF NOT EXISTS vendors (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE,
      business_name TEXT NOT NULL,
      business_type TEXT,
      description TEXT,
      logo TEXT,
      banner TEXT,
      phone TEXT,
      email TEXT,
      address TEXT,
      city TEXT,
      region TEXT,
      verification_status TEXT NOT NULL DEFAULT 'pending' CHECK(verification_status IN ('pending', 'under_review', 'verified', 'rejected', 'suspended')),
      verification_documents TEXT,
      verification_notes TEXT,
      verified_at TEXT,
      verified_by TEXT,
      store_status TEXT NOT NULL DEFAULT 'inactive' CHECK(store_status IN ('active', 'inactive', 'suspended')),
      commission_rate REAL DEFAULT 0.10,
      total_sales REAL DEFAULT 0,
      total_orders INTEGER DEFAULT 0,
      rating REAL DEFAULT 0,
      review_count INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (NOW()::TEXT),
      updated_at TEXT NOT NULL DEFAULT (NOW()::TEXT),
      CONSTRAINT fk_vendors_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Categories table
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      description TEXT,
      icon TEXT,
      image_url TEXT,
      parent_id TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      show_in_menu INTEGER NOT NULL DEFAULT 1,
      show_in_home INTEGER NOT NULL DEFAULT 1,
      display_order INTEGER NOT NULL DEFAULT 0,
      form_schema TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (NOW()::TEXT),
      updated_at TEXT NOT NULL DEFAULT (NOW()::TEXT),
      CONSTRAINT fk_categories_parent FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
    );

    -- Products table
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      vendor_id TEXT NOT NULL,
      vendor_name TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT,
      category_id TEXT,
      condition TEXT,
      price REAL NOT NULL,
      compare_price REAL,
      cost_per_item REAL,
      sku TEXT,
      barcode TEXT,
      quantity INTEGER DEFAULT 0,
      track_quantity INTEGER DEFAULT 1,
      images TEXT,
      weight REAL,
      dimensions TEXT,
      tags TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      category_attributes TEXT,
      approval_status TEXT,
      approved_by TEXT,
      approved_at TEXT,
      rejection_reason TEXT,
      suspended_by TEXT,
      suspended_at TEXT,
      suspension_reason TEXT,
      is_featured INTEGER DEFAULT 0,
      featured_at TEXT,
      featured_by TEXT,
      created_at TEXT NOT NULL DEFAULT (NOW()::TEXT),
      updated_at TEXT NOT NULL DEFAULT (NOW()::TEXT),
      CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
    );

    -- Orders table
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      buyer_id TEXT NOT NULL,
      buyer_name TEXT NOT NULL,
      buyer_email TEXT NOT NULL,
      items TEXT NOT NULL,
      subtotal REAL NOT NULL,
      shipping_fee REAL DEFAULT 0,
      tax REAL DEFAULT 0,
      total REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending_payment' CHECK(status IN ('pending_payment', 'cancelled', 'fulfilled')),
      payment_status TEXT NOT NULL DEFAULT 'pending' CHECK(payment_status IN ('pending', 'paid', 'failed', 'refunded')),
      payment_method TEXT,
      shipping_address TEXT NOT NULL,
      tracking_number TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (NOW()::TEXT),
      updated_at TEXT NOT NULL DEFAULT (NOW()::TEXT)
    );

    -- Sessions table
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      user_role TEXT NOT NULL,
      token_hash TEXT UNIQUE NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (NOW()::TEXT)
    );

    -- Audit logs table
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      category TEXT NOT NULL,
      admin_id TEXT,
      admin_name TEXT,
      admin_email TEXT,
      admin_role TEXT,
      target_id TEXT,
      target_type TEXT,
      target_name TEXT,
      details TEXT,
      previous_value TEXT,
      new_value TEXT,
      ip_address TEXT,
      user_agent TEXT,
      severity TEXT DEFAULT 'info',
      created_at TEXT NOT NULL DEFAULT (NOW()::TEXT)
    );

    -- Integrations table
    CREATE TABLE IF NOT EXISTS integrations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      provider TEXT NOT NULL,
      category TEXT NOT NULL,
      is_enabled INTEGER DEFAULT 0,
      is_configured INTEGER DEFAULT 0,
      environment TEXT DEFAULT 'demo',
      status TEXT DEFAULT 'not_configured',
      credentials TEXT,
      last_tested_at TEXT,
      last_error TEXT,
      created_at TEXT NOT NULL DEFAULT (NOW()::TEXT),
      updated_at TEXT NOT NULL DEFAULT (NOW()::TEXT)
    );

    -- Site settings table
    CREATE TABLE IF NOT EXISTS site_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (NOW()::TEXT)
    );

    -- Carts table - supports both guest (session_id) and authenticated (user_id) carts
    CREATE TABLE IF NOT EXISTS carts (
      id TEXT PRIMARY KEY,
      owner_type TEXT NOT NULL CHECK(owner_type IN ('guest', 'user')),
      owner_id TEXT NOT NULL,
      items TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (NOW()::TEXT),
      updated_at TEXT NOT NULL DEFAULT (NOW()::TEXT),
      UNIQUE(owner_type, owner_id)
    );

    -- Create indexes
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
    CREATE INDEX IF NOT EXISTS idx_vendors_user_id ON vendors(user_id);
    CREATE INDEX IF NOT EXISTS idx_vendors_verification ON vendors(verification_status);
    CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
    CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);
    CREATE INDEX IF NOT EXISTS idx_products_vendor ON products(vendor_id);
    CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
    CREATE INDEX IF NOT EXISTS idx_orders_buyer ON orders(buyer_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);
    CREATE INDEX IF NOT EXISTS idx_carts_owner ON carts(owner_type, owner_id);
  `);
}

/**
 * Run database migrations
 */
async function runMigrations(client: PoolClient): Promise<void> {
  // Add missing columns if they don't exist (PostgreSQL syntax)
  const migrations = [
    { table: 'users', column: 'deleted_at', type: 'TEXT' },
    { table: 'users', column: 'deleted_by', type: 'TEXT' },
    { table: 'users', column: 'deletion_reason', type: 'TEXT' },
    { table: 'users', column: 'created_by', type: 'TEXT' },
    { table: 'products', column: 'cost_per_item', type: 'REAL' },
    { table: 'products', column: 'sku', type: 'TEXT' },
    { table: 'products', column: 'barcode', type: 'TEXT' },
    { table: 'products', column: 'weight', type: 'REAL' },
    { table: 'products', column: 'dimensions', type: 'TEXT' },
    { table: 'products', column: 'condition', type: 'TEXT' },
    { table: 'products', column: 'approval_status', type: 'TEXT' },
    { table: 'products', column: 'approved_by', type: 'TEXT' },
    { table: 'products', column: 'approved_at', type: 'TEXT' },
    { table: 'products', column: 'rejection_reason', type: 'TEXT' },
    { table: 'products', column: 'suspended_by', type: 'TEXT' },
    { table: 'products', column: 'suspended_at', type: 'TEXT' },
    { table: 'products', column: 'suspension_reason', type: 'TEXT' },
    { table: 'products', column: 'featured_at', type: 'TEXT' },
    { table: 'products', column: 'featured_by', type: 'TEXT' },
    { table: 'products', column: 'category_id', type: 'TEXT' },
    { table: 'integrations', column: 'description', type: 'TEXT' },
    { table: 'integrations', column: 'last_tested_at', type: 'TEXT' },
    { table: 'integrations', column: 'last_error', type: 'TEXT' },
    { table: 'users', column: 'previous_login_at', type: 'TEXT' },
    { table: 'admin_users', column: 'previous_login_at', type: 'TEXT' },
    { table: 'users', column: 'last_activity_checkpoint_at', type: 'TEXT' },
    { table: 'admin_users', column: 'last_activity_checkpoint_at', type: 'TEXT' },
    { table: 'sessions', column: 'updated_at', type: 'TEXT' },
  ];

  // Create carts table if it doesn't exist (for existing databases)
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS carts (
        id TEXT PRIMARY KEY,
        owner_type TEXT NOT NULL CHECK(owner_type IN ('guest', 'user')),
        owner_id TEXT NOT NULL,
        items TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL DEFAULT (NOW()::TEXT),
        updated_at TEXT NOT NULL DEFAULT (NOW()::TEXT),
        UNIQUE(owner_type, owner_id)
      );
      CREATE INDEX IF NOT EXISTS idx_carts_owner ON carts(owner_type, owner_id);
    `);
  } catch (e) {
    // Table may already exist
  }

  // Create disputes table if it doesn't exist
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS disputes (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL,
        buyer_id TEXT NOT NULL,
        vendor_id TEXT NOT NULL,
        type TEXT NOT NULL,
        reason TEXT,
        amount REAL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'open',
        resolution TEXT,
        resolved_by TEXT,
        resolved_at TEXT,
        created_at TEXT NOT NULL DEFAULT (NOW()::TEXT),
        updated_at TEXT NOT NULL DEFAULT (NOW()::TEXT)
      );
      CREATE INDEX IF NOT EXISTS idx_disputes_order ON disputes(order_id);
      CREATE INDEX IF NOT EXISTS idx_disputes_status ON disputes(status);
    `);
  } catch (e) {
    // Table may already exist
  }

  // Create reviews table if it doesn't exist
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS reviews (
        id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL,
        buyer_id TEXT NOT NULL,
        vendor_id TEXT NOT NULL,
        rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
        comment TEXT NOT NULL,
        is_verified_purchase INTEGER DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'hidden', 'deleted')),
        helpful_count INTEGER DEFAULT 0,
        edited_at TEXT,
        vendor_reply TEXT,
        vendor_reply_at TEXT,
        created_at TEXT NOT NULL DEFAULT (NOW()::TEXT),
        updated_at TEXT NOT NULL DEFAULT (NOW()::TEXT),
        CONSTRAINT fk_reviews_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        CONSTRAINT fk_reviews_buyer FOREIGN KEY (buyer_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(product_id, buyer_id)
      );
      CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id);
      CREATE INDEX IF NOT EXISTS idx_reviews_buyer ON reviews(buyer_id);
      CREATE INDEX IF NOT EXISTS idx_reviews_vendor ON reviews(vendor_id);
      CREATE INDEX IF NOT EXISTS idx_reviews_status ON reviews(status);
    `);
  } catch (e) {
    // Table may already exist
  }

  // Create review_media table if it doesn't exist
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS review_media (
        id TEXT PRIMARY KEY,
        review_id TEXT NOT NULL,
        file_url TEXT NOT NULL,
        file_type TEXT NOT NULL DEFAULT 'image',
        created_at TEXT NOT NULL DEFAULT (NOW()::TEXT),
        CONSTRAINT fk_review_media_review FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_review_media_review ON review_media(review_id);
    `);
  } catch (e) {
    // Table may already exist
  }

  // Create coupons table if it doesn't exist
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS coupons (
        id TEXT PRIMARY KEY,
        vendor_user_id TEXT NOT NULL,
        code TEXT NOT NULL,
        name TEXT NOT NULL,
        discount_type TEXT NOT NULL CHECK(discount_type IN ('percentage', 'fixed')),
        discount_value REAL NOT NULL,
        min_order_amount REAL DEFAULT 0,
        usage_limit INTEGER,
        usage_count INTEGER DEFAULT 0,
        starts_at TEXT NOT NULL,
        ends_at TEXT NOT NULL,
        is_active INTEGER DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (NOW()::TEXT),
        updated_at TEXT NOT NULL DEFAULT (NOW()::TEXT),
        UNIQUE(vendor_user_id, code)
      );
      CREATE INDEX IF NOT EXISTS idx_coupons_vendor ON coupons(vendor_user_id);
      CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
      CREATE INDEX IF NOT EXISTS idx_coupons_active ON coupons(is_active);
    `);
  } catch (e) {
    // Table may already exist
  }

  // Create sales table if it doesn't exist (multi-product support via join table)
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS sales (
        id TEXT PRIMARY KEY,
        vendor_user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        discount_type TEXT NOT NULL CHECK(discount_type IN ('percentage', 'fixed')),
        discount_value REAL NOT NULL,
        starts_at TEXT NOT NULL,
        ends_at TEXT NOT NULL,
        is_active INTEGER DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (NOW()::TEXT),
        updated_at TEXT NOT NULL DEFAULT (NOW()::TEXT)
      );
      CREATE INDEX IF NOT EXISTS idx_sales_vendor ON sales(vendor_user_id);
      CREATE INDEX IF NOT EXISTS idx_sales_active ON sales(is_active);
    `);
  } catch (e) {
    // Table may already exist
  }

  // Create sale_products join table for multi-product sales
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS sale_products (
        id TEXT PRIMARY KEY,
        sale_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (NOW()::TEXT),
        CONSTRAINT fk_sale_products_sale FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
        CONSTRAINT fk_sale_products_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        UNIQUE(sale_id, product_id)
      );
      CREATE INDEX IF NOT EXISTS idx_sale_products_sale ON sale_products(sale_id);
      CREATE INDEX IF NOT EXISTS idx_sale_products_product ON sale_products(product_id);
    `);
  } catch (e) {
    // Table may already exist
  }

  // Migration: If sales table has product_id column, migrate data to sale_products
  try {
    const hasProductIdColumn = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'sales' AND column_name = 'product_id'
    `);
    
    if (hasProductIdColumn.rows.length > 0) {
      // Migrate existing single-product sales to join table
      await client.query(`
        INSERT INTO sale_products (id, sale_id, product_id, created_at)
        SELECT 'sp_' || REPLACE(CAST(gen_random_uuid() AS TEXT), '-', ''), s.id, s.product_id, s.created_at
        FROM sales s
        WHERE s.product_id IS NOT NULL
        ON CONFLICT (sale_id, product_id) DO NOTHING
      `);
      
      // Drop the product_id column from sales
      await client.query(`ALTER TABLE sales DROP COLUMN IF EXISTS product_id`);
      console.log('[DB] Migrated sales to multi-product schema');
    }
  } catch (e) {
    console.log('[DB] Sales migration skipped or already done');
  }

  for (const migration of migrations) {
    try {
      await client.query(`
        ALTER TABLE ${migration.table} ADD COLUMN IF NOT EXISTS ${migration.column} ${migration.type}
      `);
    } catch (e) {
      // Column may already exist or syntax not supported
    }
  }
  
  // Phase 1.1D: Data repair - Fix NULL quantity values
  // This ensures no vendor products are bricked due to corrupted quantity data
  try {
    const result = await client.query(`
      UPDATE products SET quantity = 0 WHERE quantity IS NULL
    `);
    if (result.rowCount && result.rowCount > 0) {
      console.log(`[DB] Phase 1.1D: Repaired ${result.rowCount} products with NULL quantity`);
    }
  } catch (e) {
    console.log('[DB] Phase 1.1D: Quantity repair skipped or already done');
  }

  // CONDITION REFACTOR: Migrate condition from top-level column to categoryAttributes
  // Condition should only exist in categoryAttributes when a category defines it
  try {
    // Find products with top-level condition but not in categoryAttributes
    const productsWithCondition = await client.query(`
      SELECT id, condition, category_attributes 
      FROM products 
      WHERE condition IS NOT NULL 
        AND condition != '' 
        AND (
          category_attributes IS NULL 
          OR category_attributes = '{}' 
          OR category_attributes NOT LIKE '%"condition"%'
        )
    `);
    
    for (const row of productsWithCondition.rows) {
      let attrs: Record<string, unknown> = {};
      try {
        attrs = row.category_attributes ? JSON.parse(row.category_attributes) : {};
      } catch {
        attrs = {};
      }
      
      // Only migrate if condition not already in categoryAttributes
      if (!attrs.condition) {
        attrs.condition = row.condition;
        await client.query(
          `UPDATE products SET category_attributes = $1 WHERE id = $2`,
          [JSON.stringify(attrs), row.id]
        );
      }
    }
    
    if (productsWithCondition.rows.length > 0) {
      console.log(`[DB] CONDITION REFACTOR: Migrated ${productsWithCondition.rows.length} products' condition to categoryAttributes`);
    }
  } catch (e) {
    console.log('[DB] Condition migration skipped or already done');
  }

  // PHASE 2: Create order_items table for vendor-scoped order tracking
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        product_name TEXT NOT NULL,
        vendor_id TEXT NOT NULL,
        vendor_name TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        unit_price REAL NOT NULL,
        applied_discount REAL DEFAULT 0,
        final_price REAL NOT NULL,
        fulfillment_status TEXT NOT NULL DEFAULT 'pending' CHECK(fulfillment_status IN ('pending', 'shipped', 'fulfilled')),
        fulfilled_at TEXT,
        image TEXT,
        variations TEXT,
        created_at TEXT NOT NULL DEFAULT (NOW()::TEXT),
        updated_at TEXT NOT NULL DEFAULT (NOW()::TEXT),
        CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        CONSTRAINT fk_order_items_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
        CONSTRAINT fk_order_items_vendor FOREIGN KEY (vendor_id) REFERENCES users(id) ON DELETE SET NULL
      );
      CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
      CREATE INDEX IF NOT EXISTS idx_order_items_vendor ON order_items(vendor_id);
      CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);
      CREATE INDEX IF NOT EXISTS idx_order_items_fulfillment ON order_items(fulfillment_status);
    `);
    console.log('[DB] PHASE 2: Created order_items table');
  } catch (e) {
    // Table may already exist
  }

  // PHASE 2: Add discount_total column to orders table
  try {
    await client.query(`
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_total REAL DEFAULT 0
    `);
  } catch (e) {
    // Column may already exist
  }

  // PHASE 2: Add coupon_code column to orders table for tracking applied coupons
  try {
    await client.query(`
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS coupon_code TEXT
    `);
  } catch (e) {
    // Column may already exist
  }

  // PHASE 3: Create wishlist_items table for persistent wishlist
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS wishlist_items (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE(user_id, product_id),
        CONSTRAINT fk_wishlist_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_wishlist_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_wishlist_user ON wishlist_items(user_id);
      CREATE INDEX IF NOT EXISTS idx_wishlist_product ON wishlist_items(product_id);
    `);
    console.log('[DB] PHASE 3: Created wishlist_items table');
  } catch (e) {
    // Table may already exist
  }

  // PHASE 4: Add payment tracking columns to orders table for Paystack integration
  try {
    await client.query(`
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_reference TEXT
    `);
  } catch (e) {
    // Column may already exist
  }

  try {
    await client.query(`
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_provider TEXT
    `);
  } catch (e) {
    // Column may already exist
  }

  try {
    await client.query(`
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at TEXT
    `);
  } catch (e) {
    // Column may already exist
  }

  try {
    await client.query(`
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'GHS'
    `);
  } catch (e) {
    // Column may already exist
  }

  console.log('[DB] PHASE 4: Added payment tracking columns to orders table');

  // PHASE 5: Add CHECK constraints to orders table for data integrity
  try {
    await client.query(`
      ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check
    `);
    await client.query(`
      ALTER TABLE orders ADD CONSTRAINT orders_status_check 
      CHECK(status IN ('pending_payment', 'pending', 'cancelled', 'fulfilled', 'confirmed', 'processing', 'shipped', 'delivered', 'refunded'))
    `);
  } catch (e) {
    // Constraint may already exist or table structure differs
  }

  try {
    await client.query(`
      ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_status_check
    `);
    await client.query(`
      ALTER TABLE orders ADD CONSTRAINT orders_payment_status_check 
      CHECK(payment_status IN ('pending', 'paid', 'failed', 'refunded'))
    `);
  } catch (e) {
    // Constraint may already exist
  }

  console.log('[DB] PHASE 5: Added CHECK constraints to orders table');

  // PHASE 5B: Update fulfillment_status constraint to include 'shipped'
  try {
    await client.query(`
      ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_fulfillment_status_check
    `);
    await client.query(`
      ALTER TABLE order_items ADD CONSTRAINT order_items_fulfillment_status_check 
      CHECK(fulfillment_status IN ('pending', 'shipped', 'fulfilled'))
    `);
  } catch (e) {
    // Constraint may already exist or table structure differs
  }

  console.log('[DB] PHASE 5B: Updated fulfillment_status constraint to include shipped');

  // PHASE 6: Create messaging tables for buyer-vendor communication
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        buyer_id TEXT NOT NULL,
        buyer_name TEXT NOT NULL,
        buyer_avatar TEXT,
        vendor_id TEXT NOT NULL,
        vendor_name TEXT NOT NULL,
        vendor_avatar TEXT,
        vendor_business_name TEXT,
        context TEXT NOT NULL DEFAULT 'general' CHECK(context IN ('product_inquiry', 'order_support', 'general', 'dispute')),
        product_id TEXT,
        product_name TEXT,
        product_image TEXT,
        order_id TEXT,
        order_number TEXT,
        dispute_id TEXT,
        status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'archived', 'flagged', 'closed')),
        is_pinned_buyer INTEGER DEFAULT 0,
        is_pinned_vendor INTEGER DEFAULT 0,
        is_muted_buyer INTEGER DEFAULT 0,
        is_muted_vendor INTEGER DEFAULT 0,
        last_message_id TEXT,
        last_message_content TEXT,
        last_message_at TEXT,
        last_message_sender_id TEXT,
        unread_count_buyer INTEGER DEFAULT 0,
        unread_count_vendor INTEGER DEFAULT 0,
        archived_at TEXT,
        archived_by TEXT,
        flagged_at TEXT,
        flagged_by TEXT,
        flag_reason TEXT,
        moderator_notes TEXT,
        reviewed_at TEXT,
        reviewed_by TEXT,
        created_at TEXT NOT NULL DEFAULT (NOW()::TEXT),
        updated_at TEXT NOT NULL DEFAULT (NOW()::TEXT),
        CONSTRAINT fk_conversations_buyer FOREIGN KEY (buyer_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_conversations_vendor FOREIGN KEY (vendor_id) REFERENCES users(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_conversations_buyer ON conversations(buyer_id);
      CREATE INDEX IF NOT EXISTS idx_conversations_vendor ON conversations(vendor_id);
      CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);
      CREATE INDEX IF NOT EXISTS idx_conversations_context ON conversations(context);
      CREATE INDEX IF NOT EXISTS idx_conversations_product ON conversations(product_id);
      CREATE INDEX IF NOT EXISTS idx_conversations_order ON conversations(order_id);
      CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated_at DESC);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_unique_context ON conversations(buyer_id, vendor_id, context, COALESCE(product_id, ''), COALESCE(order_id, ''));
    `);
    console.log('[DB] PHASE 6: Created conversations table');
  } catch (e) {
    // Table may already exist
  }

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        sender_id TEXT NOT NULL,
        sender_name TEXT NOT NULL,
        sender_role TEXT NOT NULL CHECK(sender_role IN ('buyer', 'vendor', 'admin')),
        sender_avatar TEXT,
        content TEXT NOT NULL,
        message_type TEXT NOT NULL DEFAULT 'text' CHECK(message_type IN ('text', 'image', 'file', 'system')),
        attachment_url TEXT,
        attachment_name TEXT,
        is_read INTEGER DEFAULT 0,
        read_at TEXT,
        is_deleted INTEGER DEFAULT 0,
        deleted_at TEXT,
        deleted_by TEXT,
        created_at TEXT NOT NULL DEFAULT (NOW()::TEXT),
        updated_at TEXT NOT NULL DEFAULT (NOW()::TEXT),
        CONSTRAINT fk_messages_conversation FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
        CONSTRAINT fk_messages_sender FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE SET NULL
      );
      CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
      CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages(conversation_id, is_read) WHERE is_read = 0;
    `);
    console.log('[DB] PHASE 6: Created messages table');
  } catch (e) {
    // Table may already exist
  }

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS messaging_audit_logs (
        id TEXT PRIMARY KEY,
        action TEXT NOT NULL,
        performed_by TEXT NOT NULL,
        performed_by_role TEXT NOT NULL CHECK(performed_by_role IN ('buyer', 'vendor', 'admin')),
        conversation_id TEXT,
        message_id TEXT,
        details TEXT,
        created_at TEXT NOT NULL DEFAULT (NOW()::TEXT),
        CONSTRAINT fk_messaging_audit_conversation FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE SET NULL,
        CONSTRAINT fk_messaging_audit_message FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE SET NULL
      );
      CREATE INDEX IF NOT EXISTS idx_messaging_audit_conversation ON messaging_audit_logs(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_messaging_audit_action ON messaging_audit_logs(action);
      CREATE INDEX IF NOT EXISTS idx_messaging_audit_created ON messaging_audit_logs(created_at DESC);
    `);
    console.log('[DB] PHASE 6: Created messaging_audit_logs table');
  } catch (e) {
    // Table may already exist
  }

  // PHASE 7: Create/update notifications table for in-app notifications
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('buyer', 'vendor', 'admin')),
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        payload TEXT,
        is_read INTEGER DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (NOW()::TEXT),
        CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
      CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);
      CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_notifications_role ON notifications(role);
    `);
    console.log('[DB] PHASE 7: Created notifications table');
  } catch (e) {
    // Table may already exist, try adding role column
    try {
      await client.query(`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'buyer'`);
      await client.query(`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS payload TEXT`);
      console.log('[DB] PHASE 7: Added role and payload columns to notifications');
    } catch (e2) {
      // Columns may already exist
    }
  }

  // PHASE 7: Create email_templates table for transactional email templates
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS email_templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        subject TEXT NOT NULL,
        body_html TEXT NOT NULL,
        body_text TEXT,
        variables TEXT,
        category TEXT NOT NULL CHECK(category IN ('order', 'payment', 'auth', 'notification', 'system')),
        is_active INTEGER DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (NOW()::TEXT),
        updated_at TEXT NOT NULL DEFAULT (NOW()::TEXT)
      );
      CREATE INDEX IF NOT EXISTS idx_email_templates_name ON email_templates(name);
      CREATE INDEX IF NOT EXISTS idx_email_templates_category ON email_templates(category);
    `);
    console.log('[DB] PHASE 7: Created email_templates table');
  } catch (e) {
    // Table may already exist
  }

  // Seed default email provider integration if not exists
  try {
    const existing = await client.query(
      `SELECT id FROM integrations WHERE provider = 'email' LIMIT 1`
    );
    if (existing.rows.length === 0) {
      const now = new Date().toISOString();
      await client.query(
        `INSERT INTO integrations (id, name, description, provider, category, is_enabled, is_configured, environment, status, credentials, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          'int_email_provider',
          'Email Provider',
          'Transactional email service for order confirmations, notifications, and system emails',
          'email',
          'email',
          0,
          0,
          'demo',
          'not_configured',
          JSON.stringify({ provider: 'none', dryRun: true }),
          now,
          now
        ]
      );
      console.log('[DB] PHASE 7: Seeded email provider integration');
    }
  } catch (e) {
    // Integration may already exist
  }

  // PHASE 8: Create password_reset_tokens table for secure password reset
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token_hash TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        used_at TEXT,
        created_at TEXT NOT NULL DEFAULT (NOW()::TEXT),
        CONSTRAINT fk_password_reset_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_password_reset_user ON password_reset_tokens(user_id);
      CREATE INDEX IF NOT EXISTS idx_password_reset_token ON password_reset_tokens(token_hash);
    `);
    console.log('[DB] PHASE 8: Created password_reset_tokens table');
  } catch (e) {
    // Table may already exist
  }
}

/**
 * Seed default categories if empty
 */
async function seedDefaultCategories(client: PoolClient): Promise<void> {
  const result = await client.query('SELECT COUNT(*) as count FROM categories');
  if (parseInt(result.rows[0].count) > 0) return;

  const defaultCategories = [
    {
      id: 'cat_electronics',
      name: 'Electronics',
      slug: 'electronics',
      description: 'Electronic devices and accessories',
      icon: '📱',
      display_order: 1,
      form_schema: JSON.stringify([
        { key: 'brand', label: 'Brand', type: 'text', required: false, placeholder: 'e.g., Apple, Samsung' },
        { key: 'model', label: 'Model', type: 'text', required: false, placeholder: 'e.g., iPhone 15' },
        { key: 'warranty', label: 'Warranty (months)', type: 'number', required: false, min: 0, max: 60 },
        { key: 'condition', label: 'Condition', type: 'select', required: true, options: ['New', 'Refurbished', 'Used - Like New', 'Used - Good', 'Used - Fair'] },
      ]),
    },
    {
      id: 'cat_mobile_phones',
      name: 'Mobile Phones',
      slug: 'mobile-phones',
      description: 'Smartphones and feature phones',
      icon: '📲',
      parent_id: 'cat_electronics',
      display_order: 2,
      form_schema: JSON.stringify([
        { key: 'storage', label: 'Storage', type: 'select', required: true, options: ['32GB', '64GB', '128GB', '256GB', '512GB', '1TB'] },
        { key: 'color', label: 'Color', type: 'text', required: false },
        { key: 'network', label: 'Network', type: 'multi_select', required: false, options: ['4G LTE', '5G', 'Dual SIM'] },
      ]),
    },
    {
      id: 'cat_fashion',
      name: 'Fashion & Clothing',
      slug: 'fashion-clothing',
      description: 'Clothes, shoes, and accessories',
      icon: '👕',
      display_order: 3,
      form_schema: JSON.stringify([
        { key: 'size', label: 'Size', type: 'select', required: true, options: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'] },
        { key: 'color', label: 'Color', type: 'text', required: true },
        { key: 'material', label: 'Material', type: 'text', required: false, placeholder: 'e.g., Cotton, Polyester' },
        { key: 'gender', label: 'Gender', type: 'select', required: true, options: ['Men', 'Women', 'Unisex', 'Boys', 'Girls', 'Kids'] },
      ]),
    },
    {
      id: 'cat_home_garden',
      name: 'Home & Garden',
      slug: 'home-garden',
      description: 'Home decor, furniture, and gardening',
      icon: '🏠',
      display_order: 4,
      form_schema: JSON.stringify([
        { key: 'room', label: 'Room Type', type: 'select', required: false, options: ['Living Room', 'Bedroom', 'Kitchen', 'Bathroom', 'Outdoor', 'Office'] },
        { key: 'material', label: 'Material', type: 'text', required: false },
        { key: 'dimensions', label: 'Dimensions', type: 'text', required: false, placeholder: 'L x W x H' },
      ]),
    },
    {
      id: 'cat_health_beauty',
      name: 'Health & Beauty',
      slug: 'health-beauty',
      description: 'Health products and beauty items',
      icon: '💄',
      display_order: 5,
      form_schema: JSON.stringify([
        { key: 'skinType', label: 'Skin Type', type: 'multi_select', required: false, options: ['Normal', 'Dry', 'Oily', 'Combination', 'Sensitive', 'All Types'] },
        { key: 'organic', label: 'Organic/Natural', type: 'boolean', required: false },
        { key: 'volume', label: 'Volume/Size', type: 'text', required: false, placeholder: 'e.g., 100ml, 50g' },
      ]),
    },
    {
      id: 'cat_food',
      name: 'Food & Beverages',
      slug: 'food-beverages',
      description: 'Food items and drinks',
      icon: '🍎',
      display_order: 6,
      form_schema: JSON.stringify([
        { key: 'expiryDate', label: 'Expiry Date', type: 'date', required: true },
        { key: 'dietary', label: 'Dietary Info', type: 'multi_select', required: false, options: ['Vegetarian', 'Vegan', 'Gluten-Free', 'Halal', 'Organic', 'Sugar-Free'] },
        { key: 'weight', label: 'Weight/Volume', type: 'text', required: false, placeholder: 'e.g., 500g, 1L' },
      ]),
    },
    {
      id: 'cat_sports',
      name: 'Sports & Outdoors',
      slug: 'sports-outdoors',
      description: 'Sports equipment and outdoor gear',
      icon: '⚽',
      display_order: 7,
      form_schema: JSON.stringify([
        { key: 'sport', label: 'Sport Type', type: 'select', required: false, options: ['Football', 'Basketball', 'Tennis', 'Running', 'Gym', 'Swimming', 'Cycling', 'Other'] },
        { key: 'size', label: 'Size', type: 'text', required: false },
      ]),
    },
    {
      id: 'cat_automotive',
      name: 'Automotive',
      slug: 'automotive',
      description: 'Car parts and accessories',
      icon: '🚗',
      display_order: 8,
      form_schema: JSON.stringify([
        { key: 'carMake', label: 'Car Make', type: 'text', required: false, placeholder: 'e.g., Toyota, Honda' },
        { key: 'carModel', label: 'Car Model', type: 'text', required: false },
        { key: 'yearRange', label: 'Compatible Years', type: 'text', required: false, placeholder: 'e.g., 2015-2023' },
      ]),
    },
  ];

  for (const cat of defaultCategories) {
    try {
      await client.query(
        `INSERT INTO categories (id, name, slug, description, icon, parent_id, display_order, form_schema, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW()::TEXT, NOW()::TEXT)
         ON CONFLICT (id) DO NOTHING`,
        [cat.id, cat.name, cat.slug, cat.description, cat.icon, cat.parent_id || null, cat.display_order, cat.form_schema]
      );
    } catch (e) {
      // Category may already exist
    }
  }

  console.log('[DB] Default categories seeded');
}

/**
 * Execute a query with parameters
 */
export async function query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<QueryResult<T & Record<string, unknown>>> {
  const client = await getPool().connect();
  try {
    return await client.query(text, params) as QueryResult<T & Record<string, unknown>>;
  } finally {
    client.release();
  }
}

/**
 * Run a transaction
 */
export async function runTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

/**
 * Close database pool
 */
export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    isInitialized = false;
  }
}

/**
 * Database health check
 */
export async function isDatabaseHealthy(): Promise<boolean> {
  try {
    const result = await query('SELECT 1');
    return result.rows.length > 0;
  } catch {
    return false;
  }
}

/**
 * Get database stats
 */
export async function getDatabaseStats(): Promise<{
  connected: boolean;
  poolSize: number;
  tables: string[];
  healthy: boolean;
}> {
  try {
    const tablesResult = await query<{ tablename: string }>(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public'"
    );
    const healthy = await isDatabaseHealthy();
    const p = getPool();

    return {
      connected: true,
      poolSize: p.totalCount,
      tables: tablesResult.rows.map((t) => t.tablename),
      healthy,
    };
  } catch (error) {
    return {
      connected: false,
      poolSize: 0,
      tables: [],
      healthy: false,
    };
  }
}

// Legacy sync function wrapper for compatibility during migration
// These wrap async calls - use with caution
export function getDatabase(): { 
  prepare: (sql: string) => { 
    run: (...params: unknown[]) => void; 
    get: (...params: unknown[]) => unknown;
    all: (...params: unknown[]) => unknown[];
  };
  exec: (sql: string) => void;
} {
  throw new Error(
    'Synchronous getDatabase() is no longer supported. Use async query() or runTransaction() instead.'
  );
}
