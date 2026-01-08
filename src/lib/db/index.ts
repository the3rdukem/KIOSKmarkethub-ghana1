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
    isInitialized = true;
    console.log('[DB] PostgreSQL database initialized successfully');
  } finally {
    client.release();
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
      status TEXT NOT NULL DEFAULT 'pending',
      payment_status TEXT NOT NULL DEFAULT 'pending',
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
    { table: 'products', column: 'cost_per_item', type: 'REAL' },
    { table: 'products', column: 'sku', type: 'TEXT' },
    { table: 'products', column: 'barcode', type: 'TEXT' },
    { table: 'products', column: 'weight', type: 'REAL' },
    { table: 'products', column: 'dimensions', type: 'TEXT' },
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
  ];

  for (const migration of migrations) {
    try {
      await client.query(`
        ALTER TABLE ${migration.table} ADD COLUMN IF NOT EXISTS ${migration.column} ${migration.type}
      `);
    } catch (e) {
      // Column may already exist or syntax not supported
    }
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
