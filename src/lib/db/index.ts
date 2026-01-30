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

// Detect if running in Replit environment
function isReplitEnvironment(): boolean {
  return !!(process.env.REPL_ID || process.env.REPLIT_DEV_DOMAIN);
}

// Build database connection string
// Priority: 
// - On Replit: Use native PostgreSQL (PGHOST, etc.) for local development
// - On Render/Production: Use DATABASE_URL for external database (Supabase)
function buildConnectionString(): string {
  const pgHost = process.env.PGHOST;
  const pgDatabase = process.env.PGDATABASE;
  const pgUser = process.env.PGUSER;
  const pgPassword = process.env.PGPASSWORD;
  const pgPort = process.env.PGPORT || '5432';
  const databaseUrl = process.env.DATABASE_URL;

  // On Replit: Prefer native PostgreSQL for development
  if (isReplitEnvironment() && pgHost && pgDatabase && pgUser && pgPassword) {
    console.log('[DB] Using Replit native PostgreSQL (development)');
    return `postgresql://${pgUser}:${encodeURIComponent(pgPassword)}@${pgHost}:${pgPort}/${pgDatabase}`;
  }

  // On external platforms (Render, Vercel, etc.): Use DATABASE_URL
  if (databaseUrl && !databaseUrl.includes('sqlite')) {
    console.log('[DB] Using DATABASE_URL (production)');
    // Handle postgres:// vs postgresql:// prefix mismatch
    if (databaseUrl.startsWith('postgres://')) {
      return databaseUrl.replace(/^postgres:\/\//, 'postgresql://');
    }
    return databaseUrl;
  }

  // Fallback to Replit's native PostgreSQL if available
  if (pgHost && pgDatabase && pgUser && pgPassword) {
    console.log('[DB] Using Replit PostgreSQL environment variables');
    return `postgresql://${pgUser}:${encodeURIComponent(pgPassword)}@${pgHost}:${pgPort}/${pgDatabase}`;
  }

  throw new Error(
    'PostgreSQL connection not configured. Either DATABASE_URL or PGHOST/PGDATABASE/PGUSER/PGPASSWORD must be set.'
  );
}

const connectionString = buildConnectionString();

// Determine if SSL should be used (required for external databases like Supabase)
function shouldUseSSL(): boolean {
  // No SSL needed for Replit's native PostgreSQL
  if (isReplitEnvironment() && process.env.PGHOST) {
    return false;
  }
  
  const dbUrl = process.env.DATABASE_URL || '';
  // Enable SSL for Supabase, Neon, or any external PostgreSQL provider
  return dbUrl.includes('supabase.co') || 
         dbUrl.includes('neon.tech') || 
         dbUrl.includes('pooler.supabase.com') ||
         process.env.DB_SSL === 'true';
}

// Global connection pool
let pool: Pool | null = null;
let isInitialized = false;

/**
 * Get database connection pool (singleton pattern)
 */
export function getPool(): Pool {
  if (!pool) {
    const useSSL = shouldUseSSL();
    console.log('[DB] SSL enabled:', useSSL);
    
    pool = new Pool({
      connectionString,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      ssl: useSSL ? { rejectUnauthorized: false } : undefined,
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
    CREATE INDEX IF NOT EXISTS idx_products_category_text ON products(category);
    CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
    CREATE INDEX IF NOT EXISTS idx_orders_buyer ON orders(buyer_id);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);
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

  // Create static_pages table if it doesn't exist
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS static_pages (
        id TEXT PRIMARY KEY,
        slug TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        meta_title TEXT,
        meta_description TEXT,
        is_published BOOLEAN DEFAULT FALSE,
        show_in_footer BOOLEAN DEFAULT FALSE,
        show_in_header BOOLEAN DEFAULT FALSE,
        order_index INTEGER DEFAULT 0,
        created_by TEXT,
        updated_by TEXT,
        published_at TEXT,
        created_at TEXT NOT NULL DEFAULT (NOW()::TEXT),
        updated_at TEXT NOT NULL DEFAULT (NOW()::TEXT)
      );
      CREATE INDEX IF NOT EXISTS idx_static_pages_slug ON static_pages(slug);
      CREATE INDEX IF NOT EXISTS idx_static_pages_published ON static_pages(is_published);
    `);
    console.log('[DB] PHASE 9: Created static_pages table');
  } catch (e) {
    // Table may already exist
  }

  // Seed default static pages if table is empty
  try {
    const countResult = await client.query('SELECT COUNT(*) FROM static_pages');
    const count = parseInt(countResult.rows[0].count, 10);
    if (count === 0) {
      const defaultPages = [
        {
          slug: 'about',
          title: 'About Us',
          content: `<div class="space-y-6">
<h2 class="text-2xl font-bold text-gray-900">Welcome to KIOSK</h2>
<p class="text-gray-600">KIOSK is Ghana's most trusted online marketplace, connecting buyers with verified vendors across the country. We're committed to making online shopping safe, secure, and accessible for everyone.</p>

<h3 class="text-xl font-semibold text-gray-900 mt-6">Our Mission</h3>
<p class="text-gray-600">To revolutionize e-commerce in Ghana by providing a secure platform where buyers can shop with confidence and vendors can grow their businesses.</p>

<h3 class="text-xl font-semibold text-gray-900 mt-6">Why Choose Us?</h3>
<ul class="list-disc pl-6 space-y-2 text-gray-600">
<li><strong>100% Verified Vendors</strong> - Every seller goes through our rigorous verification process</li>
<li><strong>Buyer Protection</strong> - Your money is safe with our escrow payment system</li>
<li><strong>Mobile Money</strong> - Pay conveniently with MTN MoMo, AirtelTigo, or Vodafone Cash</li>
<li><strong>Local Focus</strong> - Built specifically for the Ghanaian market</li>
</ul>

<h3 class="text-xl font-semibold text-gray-900 mt-6">Contact Us</h3>
<p class="text-gray-600">Have questions? Reach out to our support team at <a href="mailto:support@kiosk.com.gh" class="text-green-600 hover:underline">support@kiosk.com.gh</a></p>
</div>`,
          meta_description: 'Learn about KIOSK - Ghana\'s trusted online marketplace for verified vendors and secure shopping.',
        },
        {
          slug: 'privacy',
          title: 'Privacy Policy',
          content: `<div class="space-y-6">
<h2 class="text-2xl font-bold text-gray-900">Privacy Policy</h2>
<p class="text-gray-600 text-sm">Last updated: January 2025</p>

<h3 class="text-xl font-semibold text-gray-900 mt-6">Information We Collect</h3>
<p class="text-gray-600">We collect information you provide directly to us, including your name, email address, phone number, and shipping address when you create an account or make a purchase.</p>

<h3 class="text-xl font-semibold text-gray-900 mt-6">How We Use Your Information</h3>
<ul class="list-disc pl-6 space-y-2 text-gray-600">
<li>Process and fulfill your orders</li>
<li>Send order confirmations and updates</li>
<li>Respond to your customer service requests</li>
<li>Improve our platform and services</li>
<li>Prevent fraud and enhance security</li>
</ul>

<h3 class="text-xl font-semibold text-gray-900 mt-6">Data Security</h3>
<p class="text-gray-600">We implement industry-standard security measures to protect your personal information. All payment transactions are encrypted and processed through secure payment gateways.</p>

<h3 class="text-xl font-semibold text-gray-900 mt-6">Your Rights</h3>
<p class="text-gray-600">You have the right to access, correct, or delete your personal information at any time. Contact us at <a href="mailto:privacy@kiosk.com.gh" class="text-green-600 hover:underline">privacy@kiosk.com.gh</a> for any privacy-related requests.</p>
</div>`,
          meta_description: 'KIOSK Privacy Policy - Learn how we collect, use, and protect your personal information.',
        },
        {
          slug: 'terms',
          title: 'Terms of Service',
          content: `<div class="space-y-6">
<h2 class="text-2xl font-bold text-gray-900">Terms of Service</h2>
<p class="text-gray-600 text-sm">Last updated: January 2025</p>

<h3 class="text-xl font-semibold text-gray-900 mt-6">Acceptance of Terms</h3>
<p class="text-gray-600">By accessing and using KIOSK, you agree to be bound by these Terms of Service and all applicable laws and regulations.</p>

<h3 class="text-xl font-semibold text-gray-900 mt-6">User Accounts</h3>
<p class="text-gray-600">You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.</p>

<h3 class="text-xl font-semibold text-gray-900 mt-6">Buyer Responsibilities</h3>
<ul class="list-disc pl-6 space-y-2 text-gray-600">
<li>Provide accurate shipping and contact information</li>
<li>Complete payment for orders placed</li>
<li>Report any issues within the specified timeframe</li>
<li>Respect vendor policies and product conditions</li>
</ul>

<h3 class="text-xl font-semibold text-gray-900 mt-6">Vendor Responsibilities</h3>
<ul class="list-disc pl-6 space-y-2 text-gray-600">
<li>Provide accurate product descriptions and images</li>
<li>Ship orders within the specified timeframe</li>
<li>Maintain adequate inventory levels</li>
<li>Respond to customer inquiries promptly</li>
</ul>

<h3 class="text-xl font-semibold text-gray-900 mt-6">Dispute Resolution</h3>
<p class="text-gray-600">We provide a dispute resolution process for buyers and vendors. All disputes should be reported through our platform within 7 days of delivery.</p>
</div>`,
          meta_description: 'KIOSK Terms of Service - Understand your rights and responsibilities as a user of our platform.',
        },
        {
          slug: 'contact',
          title: 'Contact Us',
          content: `<div class="space-y-6">
<h2 class="text-2xl font-bold text-gray-900">Contact Us</h2>
<p class="text-gray-600">We're here to help! Reach out to us through any of the channels below.</p>

<div class="grid md:grid-cols-2 gap-6 mt-6">
<div class="p-6 border rounded-lg">
<h3 class="text-lg font-semibold text-gray-900 mb-2">📧 Email Support</h3>
<p class="text-gray-600">For general inquiries and support:</p>
<a href="mailto:support@kiosk.com.gh" class="text-green-600 hover:underline">support@kiosk.com.gh</a>
</div>

<div class="p-6 border rounded-lg">
<h3 class="text-lg font-semibold text-gray-900 mb-2">📞 Phone Support</h3>
<p class="text-gray-600">Call us Monday - Friday, 9am - 6pm:</p>
<p class="text-green-600 font-medium">+233 XX XXX XXXX</p>
</div>

<div class="p-6 border rounded-lg">
<h3 class="text-lg font-semibold text-gray-900 mb-2">📍 Office Address</h3>
<p class="text-gray-600">Visit us at:</p>
<p class="text-gray-700">Accra, Ghana</p>
</div>

<div class="p-6 border rounded-lg">
<h3 class="text-lg font-semibold text-gray-900 mb-2">💬 Response Time</h3>
<p class="text-gray-600">We aim to respond to all inquiries within 24-48 hours during business days.</p>
</div>
</div>
</div>`,
          meta_description: 'Contact KIOSK - Get in touch with our support team for any questions or assistance.',
        },
        {
          slug: 'mobile-money',
          title: 'Mobile Money Guide',
          content: `<div class="space-y-6">
<h2 class="text-2xl font-bold text-gray-900">Mobile Money Payment Guide</h2>
<p class="text-gray-600">KIOSK makes it easy to pay for your purchases using Ghana's popular mobile money services.</p>

<h3 class="text-xl font-semibold text-gray-900 mt-6">Supported Providers</h3>
<ul class="list-disc pl-6 space-y-2 text-gray-600">
<li><strong>MTN Mobile Money (MoMo)</strong> - Ghana's largest mobile money network</li>
<li><strong>AirtelTigo Money</strong> - Fast and reliable payments</li>
<li><strong>Vodafone Cash</strong> - Secure transactions</li>
</ul>

<h3 class="text-xl font-semibold text-gray-900 mt-6">How to Pay</h3>
<ol class="list-decimal pl-6 space-y-2 text-gray-600">
<li>Add items to your cart and proceed to checkout</li>
<li>Select "Mobile Money" as your payment method</li>
<li>Choose your mobile money provider</li>
<li>Enter your mobile money phone number</li>
<li>Confirm the payment on your phone when prompted</li>
<li>Receive order confirmation once payment is complete</li>
</ol>

<h3 class="text-xl font-semibold text-gray-900 mt-6">Security</h3>
<p class="text-gray-600">All mobile money transactions are processed through Paystack, a PCI-DSS compliant payment processor. Your payment information is encrypted and never stored on our servers.</p>
</div>`,
          meta_description: 'Learn how to pay with Mobile Money on KIOSK - MTN MoMo, AirtelTigo, and Vodafone Cash accepted.',
        },
        {
          slug: 'security',
          title: 'Security Center',
          content: `<div class="space-y-6">
<h2 class="text-2xl font-bold text-gray-900">Security Center</h2>
<p class="text-gray-600">Your security is our top priority. Learn about the measures we take to protect you.</p>

<h3 class="text-xl font-semibold text-gray-900 mt-6">🛡️ Vendor Verification</h3>
<p class="text-gray-600">Every vendor on KIOSK undergoes a rigorous verification process including identity verification, business registration checks, and ongoing monitoring.</p>

<h3 class="text-xl font-semibold text-gray-900 mt-6">💰 Buyer Protection</h3>
<p class="text-gray-600">Our escrow payment system holds your payment securely until you confirm receipt of your order. If there's a problem, our dispute resolution team will help.</p>

<h3 class="text-xl font-semibold text-gray-900 mt-6">🔒 Secure Payments</h3>
<p class="text-gray-600">All transactions are encrypted with SSL and processed through Paystack, meeting the highest security standards in the industry.</p>

<h3 class="text-xl font-semibold text-gray-900 mt-6">🚨 Report Suspicious Activity</h3>
<p class="text-gray-600">If you notice any suspicious activity or believe you've encountered a scam, please report it immediately to <a href="mailto:security@kiosk.com.gh" class="text-green-600 hover:underline">security@kiosk.com.gh</a></p>
</div>`,
          meta_description: 'KIOSK Security Center - Learn about our vendor verification, buyer protection, and secure payment systems.',
        },
      ];
      
      for (const page of defaultPages) {
        const id = `page_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await client.query(
          `INSERT INTO static_pages (id, slug, title, content, meta_description, is_published, show_in_footer, order_index)
           VALUES ($1, $2, $3, $4, $5, TRUE, TRUE, $6)`,
          [id, page.slug, page.title, page.content, page.meta_description, defaultPages.indexOf(page) + 1]
        );
      }
      console.log('[DB] Seeded default static pages');
    }
  } catch (e) {
    console.error('[DB] Error seeding static pages:', e);
  }

  // Add updated_by column to site_settings if it doesn't exist
  try {
    await client.query(`
      ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS updated_by TEXT
    `);
  } catch (e) {
    // Column may already exist
  }

  // PHASE 10: Create footer_links table for dynamic footer management
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS footer_links (
        id TEXT PRIMARY KEY,
        section TEXT NOT NULL,
        title TEXT NOT NULL,
        url TEXT NOT NULL,
        order_num INTEGER DEFAULT 0,
        is_visible BOOLEAN DEFAULT TRUE,
        is_external BOOLEAN DEFAULT FALSE,
        created_at TEXT NOT NULL DEFAULT (NOW()::TEXT),
        updated_at TEXT NOT NULL DEFAULT (NOW()::TEXT)
      );
      CREATE INDEX IF NOT EXISTS idx_footer_links_section ON footer_links(section);
      CREATE INDEX IF NOT EXISTS idx_footer_links_visible ON footer_links(is_visible);
    `);
    console.log('[DB] PHASE 10: Created footer_links table');
  } catch (e) {
    // Table may already exist
  }

  // Seed default footer links if table is empty
  try {
    const countResult = await client.query('SELECT COUNT(*) FROM footer_links');
    const count = parseInt(countResult.rows[0].count, 10);
    if (count === 0) {
      const defaultLinks = [
        { section: 'For Buyers', title: 'How It Works', url: '/how-it-works', order: 1 },
        { section: 'For Buyers', title: 'Buyer Protection', url: '/buyer-protection', order: 2 },
        { section: 'For Buyers', title: 'Mobile Money Guide', url: '/pages/mobile-money', order: 3 },
        { section: 'For Buyers', title: 'Help Center', url: '/help', order: 4 },
        { section: 'For Vendors', title: 'Start Selling', url: '/vendor/register', order: 1 },
        { section: 'For Vendors', title: 'Verification Guide', url: '/pages/verification-guide', order: 2 },
        { section: 'For Vendors', title: 'Fees & Commissions', url: '/pages/vendor-fees', order: 3 },
        { section: 'For Vendors', title: 'Seller Resources', url: '/pages/vendor-resources', order: 4 },
        { section: 'Security', title: 'Security Center', url: '/pages/security', order: 1 },
        { section: 'Security', title: 'Vendor Verification', url: '/pages/vendor-verification', order: 2 },
        { section: 'Security', title: 'Privacy Policy', url: '/pages/privacy', order: 3 },
        { section: 'Security', title: 'Terms of Service', url: '/pages/terms', order: 4 },
        { section: 'Company', title: 'About Us', url: '/pages/about', order: 1 },
        { section: 'Company', title: 'Careers', url: '/pages/careers', order: 2 },
        { section: 'Company', title: 'Press', url: '/pages/press', order: 3 },
        { section: 'Company', title: 'Contact', url: '/pages/contact', order: 4 },
      ];
      for (const link of defaultLinks) {
        const id = `fl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await client.query(
          `INSERT INTO footer_links (id, section, title, url, order_num, is_visible, is_external)
           VALUES ($1, $2, $3, $4, $5, TRUE, FALSE)`,
          [id, link.section, link.title, link.url, link.order]
        );
      }
      console.log('[DB] Seeded default footer links');
    } else {
      // Migration: Update footer links to use /pages/ prefix for static pages
      await client.query(`
        UPDATE footer_links SET url = '/pages/mobile-money' WHERE url = '/mobile-money';
        UPDATE footer_links SET url = '/pages/verification-guide' WHERE url = '/verification-guide';
        UPDATE footer_links SET url = '/pages/vendor-fees' WHERE url = '/vendor/fees';
        UPDATE footer_links SET url = '/pages/vendor-resources' WHERE url = '/vendor/resources';
        UPDATE footer_links SET url = '/pages/security' WHERE url = '/security';
        UPDATE footer_links SET url = '/pages/vendor-verification' WHERE url = '/verification';
        UPDATE footer_links SET url = '/pages/privacy' WHERE url = '/privacy';
        UPDATE footer_links SET url = '/pages/terms' WHERE url = '/terms';
        UPDATE footer_links SET url = '/pages/about' WHERE url = '/about';
        UPDATE footer_links SET url = '/pages/careers' WHERE url = '/careers';
        UPDATE footer_links SET url = '/pages/press' WHERE url = '/press';
        UPDATE footer_links SET url = '/pages/contact' WHERE url = '/contact';
      `);
      console.log('[DB] Migrated footer links to /pages/ prefix');
    }
  } catch (e) {
    console.error('[DB] Error seeding footer links:', e);
  }

  // PHASE 11: Create hero_slides table for slideshow carousel
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS hero_slides (
        id TEXT PRIMARY KEY,
        title TEXT,
        subtitle TEXT,
        image_url TEXT NOT NULL,
        link_url TEXT,
        order_num INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TEXT NOT NULL DEFAULT (NOW()::TEXT),
        updated_at TEXT NOT NULL DEFAULT (NOW()::TEXT)
      );
      CREATE INDEX IF NOT EXISTS idx_hero_slides_active ON hero_slides(is_active);
      CREATE INDEX IF NOT EXISTS idx_hero_slides_order ON hero_slides(order_num);
    `);
    console.log('[DB] PHASE 11: Created hero_slides table');
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
      CHECK(status IN (
        'created', 'confirmed', 'preparing', 'ready_for_pickup', 'out_for_delivery', 
        'delivered', 'completed', 'cancelled', 'disputed', 'delivery_failed',
        'pending_payment', 'pending', 'fulfilled', 'processing', 'shipped', 'refunded'
      ))
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

  // PHASE 5B: Update fulfillment_status constraint for Phase 7B item statuses
  try {
    await client.query(`
      ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_fulfillment_status_check
    `);
    await client.query(`
      ALTER TABLE order_items ADD CONSTRAINT order_items_fulfillment_status_check 
      CHECK(fulfillment_status IN ('pending', 'packed', 'handed_to_courier', 'delivered', 'shipped', 'fulfilled'))
    `);
  } catch (e) {
    // Constraint may already exist or table structure differs
  }

  console.log('[DB] PHASE 5B: Updated fulfillment_status constraint for Phase 7B');

  // PHASE 5C: Add Phase 7D columns for courier-assisted delivery
  try {
    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS courier_provider TEXT`);
  } catch (e) { /* Column may already exist */ }
  try {
    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS courier_reference TEXT`);
  } catch (e) { /* Column may already exist */ }
  try {
    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_at TEXT`);
  } catch (e) { /* Column may already exist */ }
  try {
    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS disputed_at TEXT`);
  } catch (e) { /* Column may already exist */ }
  try {
    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS dispute_reason TEXT`);
  } catch (e) { /* Column may already exist */ }
  console.log('[DB] PHASE 5C: Added Phase 7D delivery columns to orders table');

  // PHASE 5D: Add per-vendor delivery columns to order_items for multi-vendor orders
  try {
    await client.query(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS vendor_courier_provider TEXT`);
  } catch (e) { /* Column may already exist */ }
  try {
    await client.query(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS vendor_courier_reference TEXT`);
  } catch (e) { /* Column may already exist */ }
  try {
    await client.query(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS vendor_delivered_at TEXT`);
  } catch (e) { /* Column may already exist */ }
  try {
    await client.query(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS vendor_ready_for_pickup_at TEXT`);
  } catch (e) { /* Column may already exist */ }
  console.log('[DB] PHASE 5D: Added per-vendor delivery columns to order_items table');

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

  // PHASE 12: Commission System - Add commission columns for revenue tracking
  // Add commission_rate to categories table
  try {
    await client.query(`ALTER TABLE categories ADD COLUMN IF NOT EXISTS commission_rate REAL`);
    console.log('[DB] PHASE 12: Added commission_rate to categories table');
  } catch (e) { /* Column may already exist */ }

  // Add commission columns to orders table
  try {
    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS platform_commission REAL DEFAULT 0`);
  } catch (e) { /* Column may already exist */ }
  try {
    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS vendor_earnings REAL DEFAULT 0`);
  } catch (e) { /* Column may already exist */ }
  try {
    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS commission_rate REAL`);
    console.log('[DB] PHASE 12: Added commission columns to orders table');
  } catch (e) { /* Column may already exist */ }

  // Add commission columns to order_items table for multi-vendor orders
  try {
    await client.query(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS commission_rate REAL`);
  } catch (e) { /* Column may already exist */ }
  try {
    await client.query(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS commission_amount REAL DEFAULT 0`);
  } catch (e) { /* Column may already exist */ }
  try {
    await client.query(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS vendor_earnings REAL DEFAULT 0`);
    console.log('[DB] PHASE 12: Added commission columns to order_items table');
  } catch (e) { /* Column may already exist */ }

  // Seed default commission rate in site_settings if not exists
  try {
    const existing = await client.query(
      `SELECT key FROM site_settings WHERE key = 'default_commission_rate' LIMIT 1`
    );
    if (existing.rows.length === 0) {
      await client.query(
        `INSERT INTO site_settings (key, value, updated_at) VALUES ($1, $2, $3)`,
        ['default_commission_rate', '0.08', new Date().toISOString()]
      );
      console.log('[DB] PHASE 12: Seeded default commission rate (8%)');
    }
  } catch (e) {
    // Setting may already exist
  }

  // PHASE 13: SMS Notifications System - Templates and Logs
  // Create sms_templates table
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS sms_templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        event_type TEXT NOT NULL,
        message_template TEXT NOT NULL,
        variables TEXT,
        is_active INTEGER DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (NOW()::TEXT),
        updated_at TEXT NOT NULL DEFAULT (NOW()::TEXT)
      );
      CREATE INDEX IF NOT EXISTS idx_sms_templates_event_type ON sms_templates(event_type);
      CREATE INDEX IF NOT EXISTS idx_sms_templates_is_active ON sms_templates(is_active);
    `);
    console.log('[DB] PHASE 13: Created sms_templates table');
  } catch (e) {
    // Table may already exist
  }

  // Create sms_logs table for tracking sent messages
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS sms_logs (
        id TEXT PRIMARY KEY,
        recipient_phone TEXT NOT NULL,
        recipient_name TEXT,
        recipient_id TEXT,
        recipient_role TEXT,
        event_type TEXT NOT NULL,
        template_id TEXT,
        message_content TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        provider_response TEXT,
        error_message TEXT,
        order_id TEXT,
        sent_at TEXT,
        created_at TEXT NOT NULL DEFAULT (NOW()::TEXT)
      );
      CREATE INDEX IF NOT EXISTS idx_sms_logs_recipient ON sms_logs(recipient_phone);
      CREATE INDEX IF NOT EXISTS idx_sms_logs_status ON sms_logs(status);
      CREATE INDEX IF NOT EXISTS idx_sms_logs_event_type ON sms_logs(event_type);
      CREATE INDEX IF NOT EXISTS idx_sms_logs_created_at ON sms_logs(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_sms_logs_order_id ON sms_logs(order_id);
    `);
    console.log('[DB] PHASE 13: Created sms_logs table');
  } catch (e) {
    // Table may already exist
  }

  // Seed default SMS templates
  try {
    const existingTemplates = await client.query('SELECT COUNT(*) as count FROM sms_templates');
    if (parseInt(existingTemplates.rows[0].count) === 0) {
      const now = new Date().toISOString();
      const templates = [
        {
          id: 'sms_order_confirmed',
          name: 'Order Confirmed',
          event_type: 'order_confirmed',
          message_template: 'Hi {{buyer_name}}, your order #{{order_id}} has been confirmed! Total: GHS {{total}}. Thank you for shopping on KIOSK!',
          variables: 'buyer_name,order_id,total'
        },
        {
          id: 'sms_order_preparing',
          name: 'Order Preparing',
          event_type: 'order_preparing',
          message_template: "Good news! Your order #{{order_id}} is being prepared by the vendor. We'll notify you when it's ready.",
          variables: 'order_id'
        },
        {
          id: 'sms_order_ready',
          name: 'Order Ready for Pickup',
          event_type: 'order_ready_for_pickup',
          message_template: 'Your order #{{order_id}} is ready for pickup/delivery! The vendor will arrange delivery soon.',
          variables: 'order_id'
        },
        {
          id: 'sms_order_delivered',
          name: 'Order Delivered',
          event_type: 'order_delivered',
          message_template: 'Your order #{{order_id}} has been delivered! If you have any issues, you can raise a dispute within 48 hours.',
          variables: 'order_id'
        },
        {
          id: 'sms_order_cancelled',
          name: 'Order Cancelled',
          event_type: 'order_cancelled',
          message_template: 'Your order #{{order_id}} has been cancelled. If you paid, a refund will be processed within 3-5 business days.',
          variables: 'order_id'
        },
        {
          id: 'sms_vendor_new_order',
          name: 'Vendor: New Order',
          event_type: 'vendor_new_order',
          message_template: 'New order #{{order_id}}! Amount: GHS {{amount}}. Log in to KIOSK to view and process.',
          variables: 'order_id,amount'
        },
        {
          id: 'sms_dispute_opened',
          name: 'Dispute Opened',
          event_type: 'dispute_opened',
          message_template: 'A dispute has been opened for order #{{order_id}}. Our team will review and respond within 24-48 hours.',
          variables: 'order_id'
        },
        {
          id: 'sms_welcome_buyer',
          name: 'Welcome Buyer',
          event_type: 'welcome_buyer',
          message_template: "Welcome to KIOSK, {{name}}! Ghana's trusted marketplace. Start shopping now at kiosk.gh",
          variables: 'name'
        },
        {
          id: 'sms_welcome_vendor',
          name: 'Welcome Vendor',
          event_type: 'welcome_vendor',
          message_template: 'Welcome to KIOSK, {{business_name}}! Complete your verification to start selling. Log in to your dashboard.',
          variables: 'business_name'
        }
      ];

      for (const t of templates) {
        await client.query(
          `INSERT INTO sms_templates (id, name, event_type, message_template, variables, is_active, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, 1, $6, $7)`,
          [t.id, t.name, t.event_type, t.message_template, t.variables, now, now]
        );
      }
      console.log('[DB] PHASE 13: Seeded default SMS templates');
    }
  } catch (e) {
    // Templates may already exist
  }

  // Add SMS settings to site_settings if not exist
  try {
    const smsEnabled = await client.query(
      `SELECT key FROM site_settings WHERE key = 'sms_notifications_enabled' LIMIT 1`
    );
    if (smsEnabled.rows.length === 0) {
      const now = new Date().toISOString();
      await client.query(
        `INSERT INTO site_settings (key, value, updated_at) VALUES ($1, $2, $3)`,
        ['sms_notifications_enabled', 'false', now]
      );
      console.log('[DB] PHASE 13: Added SMS notifications setting (disabled by default)');
    }
  } catch (e) {
    // Setting may already exist
  }

  // PHASE 14: Vendor Payouts System
  // Create vendor_bank_accounts table for payout destinations
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS vendor_bank_accounts (
        id TEXT PRIMARY KEY,
        vendor_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        account_type TEXT NOT NULL CHECK (account_type IN ('bank', 'mobile_money')),
        bank_code TEXT,
        bank_name TEXT,
        account_number TEXT NOT NULL,
        account_name TEXT NOT NULL,
        mobile_money_provider TEXT CHECK (mobile_money_provider IN ('MTN', 'VOD', 'ATL')),
        paystack_recipient_code TEXT,
        is_primary INTEGER DEFAULT 0,
        is_verified INTEGER DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (NOW()::TEXT),
        updated_at TEXT NOT NULL DEFAULT (NOW()::TEXT)
      );
      CREATE INDEX IF NOT EXISTS idx_vendor_bank_accounts_vendor_id ON vendor_bank_accounts(vendor_id);
      CREATE INDEX IF NOT EXISTS idx_vendor_bank_accounts_is_primary ON vendor_bank_accounts(is_primary);
    `);
    console.log('[DB] PHASE 14: Created vendor_bank_accounts table');
  } catch (e) {
    // Table may already exist
  }

  // PHASE 14B: Update mobile_money_provider constraint to use uppercase codes (Paystack requirement)
  try {
    await client.query(`
      ALTER TABLE vendor_bank_accounts DROP CONSTRAINT IF EXISTS vendor_bank_accounts_mobile_money_provider_check;
      ALTER TABLE vendor_bank_accounts ADD CONSTRAINT vendor_bank_accounts_mobile_money_provider_check 
        CHECK (mobile_money_provider IN ('MTN', 'VOD', 'ATL'));
    `);
    console.log('[DB] PHASE 14B: Updated mobile_money_provider constraint to uppercase codes');
  } catch (e) {
    // Constraint may already be correct
  }

  // Create vendor_payouts table for tracking payout transactions
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS vendor_payouts (
        id TEXT PRIMARY KEY,
        vendor_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        bank_account_id TEXT REFERENCES vendor_bank_accounts(id) ON DELETE SET NULL,
        amount REAL NOT NULL,
        currency TEXT NOT NULL DEFAULT 'GHS',
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'success', 'failed', 'reversed')),
        paystack_transfer_code TEXT,
        paystack_reference TEXT UNIQUE,
        failure_reason TEXT,
        initiated_by TEXT CHECK (initiated_by IN ('vendor', 'admin', 'system')),
        initiated_by_id TEXT,
        processed_at TEXT,
        created_at TEXT NOT NULL DEFAULT (NOW()::TEXT),
        updated_at TEXT NOT NULL DEFAULT (NOW()::TEXT)
      );
      CREATE INDEX IF NOT EXISTS idx_vendor_payouts_vendor_id ON vendor_payouts(vendor_id);
      CREATE INDEX IF NOT EXISTS idx_vendor_payouts_status ON vendor_payouts(status);
      CREATE INDEX IF NOT EXISTS idx_vendor_payouts_created_at ON vendor_payouts(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_vendor_payouts_paystack_reference ON vendor_payouts(paystack_reference);
    `);
    console.log('[DB] PHASE 14: Created vendor_payouts table');
  } catch (e) {
    // Table may already exist
  }

  // Create vendor_payout_items table to link payouts with order earnings
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS vendor_payout_items (
        id TEXT PRIMARY KEY,
        payout_id TEXT NOT NULL REFERENCES vendor_payouts(id) ON DELETE CASCADE,
        order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        order_item_id TEXT,
        amount REAL NOT NULL,
        created_at TEXT NOT NULL DEFAULT (NOW()::TEXT)
      );
      CREATE INDEX IF NOT EXISTS idx_vendor_payout_items_payout_id ON vendor_payout_items(payout_id);
      CREATE INDEX IF NOT EXISTS idx_vendor_payout_items_order_id ON vendor_payout_items(order_id);
    `);
    console.log('[DB] PHASE 14: Created vendor_payout_items table');
  } catch (e) {
    // Table may already exist
  }

  // Add payout_status column to order_items for tracking which items have been paid out
  try {
    await client.query(`
      ALTER TABLE order_items ADD COLUMN IF NOT EXISTS payout_status TEXT DEFAULT 'pending' CHECK (payout_status IN ('pending', 'processing', 'paid'));
    `);
    await client.query(`
      ALTER TABLE order_items ADD COLUMN IF NOT EXISTS payout_id TEXT REFERENCES vendor_payouts(id) ON DELETE SET NULL;
    `);
    console.log('[DB] PHASE 14: Added payout columns to order_items table');
  } catch (e) {
    // Columns may already exist
  }
  
  // PHASE 15: Disputes Resolution System enhancements
  try {
    // Add core dispute columns needed by DAL
    await client.query(`ALTER TABLE disputes ADD COLUMN IF NOT EXISTS buyer_name TEXT`);
    await client.query(`ALTER TABLE disputes ADD COLUMN IF NOT EXISTS buyer_email TEXT`);
    await client.query(`ALTER TABLE disputes ADD COLUMN IF NOT EXISTS vendor_name TEXT`);
    await client.query(`ALTER TABLE disputes ADD COLUMN IF NOT EXISTS product_id TEXT`);
    await client.query(`ALTER TABLE disputes ADD COLUMN IF NOT EXISTS product_name TEXT`);
    await client.query(`ALTER TABLE disputes ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium'`);
    await client.query(`ALTER TABLE disputes ADD COLUMN IF NOT EXISTS description TEXT`);
    await client.query(`ALTER TABLE disputes ADD COLUMN IF NOT EXISTS messages TEXT DEFAULT '[]'`);
    
    // Add resolution_type column for tracking type of resolution
    await client.query(`
      ALTER TABLE disputes ADD COLUMN IF NOT EXISTS resolution_type TEXT 
      CHECK (resolution_type IN ('full_refund', 'partial_refund', 'replacement', 'no_action', 'other'))
    `);
    
    // Add refund_amount column for tracking refund amounts
    await client.query(`
      ALTER TABLE disputes ADD COLUMN IF NOT EXISTS refund_amount REAL
    `);
    
    // Add resolved_by column to track who resolved the dispute
    await client.query(`
      ALTER TABLE disputes ADD COLUMN IF NOT EXISTS resolved_by TEXT
    `);
    
    // Add refund tracking columns
    await client.query(`
      ALTER TABLE disputes ADD COLUMN IF NOT EXISTS refund_status TEXT 
      CHECK (refund_status IN ('pending', 'processing', 'completed', 'failed'))
    `);
    await client.query(`
      ALTER TABLE disputes ADD COLUMN IF NOT EXISTS refund_reference TEXT
    `);
    await client.query(`
      ALTER TABLE disputes ADD COLUMN IF NOT EXISTS refunded_at TEXT
    `);
    
    // Add evidence column for storing photo evidence URLs
    await client.query(`
      ALTER TABLE disputes ADD COLUMN IF NOT EXISTS evidence TEXT
    `);
    
    // Add indexes for better query performance
    await client.query(`CREATE INDEX IF NOT EXISTS idx_disputes_order_id ON disputes(order_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_disputes_buyer_id ON disputes(buyer_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_disputes_vendor_id ON disputes(vendor_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_disputes_status ON disputes(status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_disputes_created_at ON disputes(created_at DESC)`);
    
    console.log('[DB] PHASE 15: Added dispute resolution columns and indexes (including evidence)');
  } catch (e) {
    // Columns may already exist
  }

  // PHASE 16: Notification Settings for Vendors and Buyers
  try {
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS store_settings JSONB DEFAULT '{}'::jsonb`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_settings JSONB DEFAULT '{}'::jsonb`);
    console.log('[DB] PHASE 16: Added store_settings and notification_settings columns');
  } catch (e) {
    // Columns may already exist
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
      id: 'cat_vehicles',
      name: 'Vehicles',
      slug: 'vehicles',
      description: 'Cars, motorcycles, and other vehicles',
      icon: '🚗',
      display_order: 1,
      form_schema: JSON.stringify([
        { key: 'vehicleType', label: 'Vehicle Type', type: 'select', required: true, options: ['Car', 'SUV/4x4', 'Pickup', 'Van/Bus', 'Motorcycle', 'Tricycle (Pragya)', 'Truck', 'Other'] },
        { key: 'make', label: 'Make', type: 'select', required: true, options: ['Toyota', 'Honda', 'Nissan', 'Hyundai', 'Kia', 'Mercedes-Benz', 'BMW', 'Volkswagen', 'Ford', 'Mazda', 'Mitsubishi', 'Peugeot', 'Suzuki', 'Chevrolet', 'Lexus', 'Audi', 'Land Rover', 'Jeep', 'Isuzu', 'Other'] },
        { key: 'model', label: 'Model', type: 'text', required: false, placeholder: 'e.g., Corolla, Civic, Camry' },
        { key: 'year', label: 'Year', type: 'select', required: true, options: ['2026', '2025', '2024', '2023', '2022', '2021', '2020', '2019', '2018', '2017', '2016', '2015', '2014', '2013', '2012', '2011', '2010', '2009', '2008', '2007', '2006', '2005', '2004', '2003', '2002', '2001', '2000', '1999', '1998', '1997', '1996', '1995', '1990-1994', 'Before 1990'] },
        { key: 'transmission', label: 'Transmission', type: 'select', required: true, options: ['Automatic', 'Manual'] },
        { key: 'fuelType', label: 'Fuel Type', type: 'select', required: true, options: ['Petrol', 'Diesel', 'Hybrid', 'Electric', 'LPG'] },
        { key: 'engineCapacity', label: 'Engine Capacity', type: 'select', required: false, options: ['Below 1.0L', '1.0L', '1.3L', '1.5L', '1.6L', '1.8L', '2.0L', '2.4L', '2.5L', '3.0L', '3.5L', '4.0L+'] },
        { key: 'condition', label: 'Condition', type: 'select', required: true, options: ['Brand New', 'Foreign Used (Tokumbo)', 'Locally Used'] },
        { key: 'mileage', label: 'Mileage', type: 'select', required: false, options: ['0 - 50,000 km', '50,000 - 100,000 km', '100,000 - 150,000 km', '150,000 - 200,000 km', '200,000+ km'] },
        { key: 'registered', label: 'Registered in Ghana', type: 'select', required: false, options: ['Yes', 'No'] },
        { key: 'color', label: 'Color', type: 'text', required: false },
      ]),
    },
    {
      id: 'cat_mobile_phones',
      name: 'Mobile Phones',
      slug: 'mobile-phones',
      description: 'Smartphones, feature phones, and accessories',
      icon: '📱',
      display_order: 2,
      form_schema: JSON.stringify([
        { key: 'brand', label: 'Brand', type: 'select', required: true, options: ['Apple', 'Samsung', 'Tecno', 'Infinix', 'Itel', 'Xiaomi', 'Oppo', 'Realme', 'Nokia', 'Huawei', 'Vivo', 'Google', 'OnePlus', 'Other'] },
        { key: 'model', label: 'Model', type: 'text', required: false, placeholder: 'e.g., iPhone 15, Galaxy S24' },
        { key: 'storage', label: 'Storage', type: 'select', required: true, options: ['16GB', '32GB', '64GB', '128GB', '256GB', '512GB', '1TB'] },
        { key: 'ram', label: 'RAM', type: 'select', required: false, options: ['1GB', '2GB', '3GB', '4GB', '6GB', '8GB', '12GB', '16GB'] },
        { key: 'condition', label: 'Condition', type: 'select', required: true, options: ['Brand New', 'UK Used', 'US Used', 'Locally Used', 'Refurbished'] },
        { key: 'network', label: 'Network', type: 'multi_select', required: false, options: ['3G', '4G LTE', '5G', 'Dual SIM'] },
        { key: 'screenSize', label: 'Screen Size', type: 'select', required: false, options: ['Below 5"', '5" - 5.5"', '5.5" - 6"', '6" - 6.5"', 'Above 6.5"'] },
        { key: 'color', label: 'Color', type: 'text', required: false },
      ]),
    },
    {
      id: 'cat_electronics',
      name: 'Electronics',
      slug: 'electronics',
      description: 'Computers, TVs, audio equipment, and gadgets',
      icon: '💻',
      display_order: 3,
      form_schema: JSON.stringify([
        { key: 'type', label: 'Type', type: 'select', required: true, options: ['Laptop', 'Desktop Computer', 'Tablet', 'TV', 'Monitor', 'Camera', 'Gaming Console', 'Audio/Speakers', 'Headphones', 'Printer', 'Projector', 'Networking', 'Storage Device', 'Accessories', 'Other'] },
        { key: 'brand', label: 'Brand', type: 'select', required: false, options: ['Samsung', 'LG', 'Sony', 'HP', 'Dell', 'Lenovo', 'Apple', 'Asus', 'Acer', 'TCL', 'Hisense', 'JBL', 'Bose', 'Canon', 'Nikon', 'Other'] },
        { key: 'condition', label: 'Condition', type: 'select', required: true, options: ['Brand New', 'UK/US Used', 'Locally Used', 'Refurbished'] },
        { key: 'warranty', label: 'Warranty', type: 'select', required: false, options: ['No Warranty', '3 Months', '6 Months', '1 Year', '2 Years', '3+ Years'] },
        { key: 'model', label: 'Model', type: 'text', required: false },
      ]),
    },
    {
      id: 'cat_furniture',
      name: 'Home Furniture & Deco',
      slug: 'home-furniture-deco',
      description: 'Furniture, home decor, and interior items',
      icon: '🛋️',
      display_order: 4,
      form_schema: JSON.stringify([
        { key: 'type', label: 'Type', type: 'select', required: true, options: ['Sofa/Couch', 'Bed/Mattress', 'Wardrobe/Closet', 'Dining Table', 'Chair', 'Desk/Office Furniture', 'Shelf/Cabinet', 'TV Stand', 'Curtains/Blinds', 'Rug/Carpet', 'Wall Art/Decor', 'Lighting', 'Mirror', 'Other'] },
        { key: 'room', label: 'Room', type: 'select', required: false, options: ['Living Room', 'Bedroom', 'Dining Room', 'Kitchen', 'Bathroom', 'Office', 'Outdoor', 'Kids Room'] },
        { key: 'material', label: 'Material', type: 'select', required: false, options: ['Wood', 'Metal', 'Fabric', 'Leather', 'Plastic', 'Glass', 'Rattan/Cane', 'Mixed'] },
        { key: 'condition', label: 'Condition', type: 'select', required: true, options: ['Brand New', 'Fairly Used', 'Needs Repair'] },
        { key: 'color', label: 'Color', type: 'text', required: false },
      ]),
    },
    {
      id: 'cat_appliances',
      name: 'Home Appliances',
      slug: 'home-appliances',
      description: 'Kitchen appliances, cleaning, and household equipment',
      icon: '🔌',
      display_order: 5,
      form_schema: JSON.stringify([
        { key: 'type', label: 'Type', type: 'select', required: true, options: ['Refrigerator', 'Freezer', 'Washing Machine', 'Dryer', 'Air Conditioner', 'Fan', 'Microwave', 'Oven/Stove', 'Blender', 'Iron', 'Vacuum Cleaner', 'Water Heater', 'Generator', 'Inverter/UPS', 'Water Dispenser', 'Gas Cooker', 'Electric Kettle', 'Other'] },
        { key: 'brand', label: 'Brand', type: 'select', required: false, options: ['Samsung', 'LG', 'Hisense', 'Midea', 'Haier', 'Nasco', 'Binatone', 'Scanfrost', 'Thermocool', 'Philips', 'Panasonic', 'Other'] },
        { key: 'condition', label: 'Condition', type: 'select', required: true, options: ['Brand New', 'UK/US Used', 'Locally Used', 'Refurbished'] },
        { key: 'warranty', label: 'Warranty', type: 'select', required: false, options: ['No Warranty', '3 Months', '6 Months', '1 Year', '2 Years', '3+ Years'] },
        { key: 'power', label: 'Power Rating', type: 'text', required: false, placeholder: 'e.g., 1.5HP, 300W' },
      ]),
    },
    {
      id: 'cat_fashion',
      name: 'Fashion',
      slug: 'fashion',
      description: 'Clothing, shoes, bags, and accessories',
      icon: '👗',
      display_order: 6,
      form_schema: JSON.stringify([
        { key: 'type', label: 'Type', type: 'select', required: true, options: ['African Traditional/Kente', 'Casual Wear', 'Formal Wear', 'Sportswear', 'Shoes/Footwear', 'Bags/Purses', 'Jewelry', 'Watches', 'Hats/Caps', 'Belts', 'Sunglasses', 'Traditional Beads', 'Other Accessories'] },
        { key: 'gender', label: 'Gender', type: 'select', required: true, options: ['Men', 'Women', 'Unisex', 'Boys', 'Girls'] },
        { key: 'size', label: 'Size', type: 'select', required: false, options: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'Free Size', 'See Description'] },
        { key: 'condition', label: 'Condition', type: 'select', required: true, options: ['Brand New', 'Fairly Used'] },
        { key: 'material', label: 'Material', type: 'text', required: false, placeholder: 'e.g., Cotton, Ankara, Kente' },
        { key: 'color', label: 'Color', type: 'text', required: false },
      ]),
    },
    {
      id: 'cat_beauty',
      name: 'Beauty & Personal Care',
      slug: 'beauty-personal-care',
      description: 'Skincare, haircare, makeup, and grooming products',
      icon: '💄',
      display_order: 7,
      form_schema: JSON.stringify([
        { key: 'category', label: 'Category', type: 'select', required: true, options: ['Skincare', 'Haircare', 'Makeup', 'Fragrance/Perfume', 'Body Care', 'Oral Care', 'Shaving/Grooming', 'Nail Care', 'Hair Extensions/Wigs', 'Personal Hygiene', 'Other'] },
        { key: 'skinType', label: 'Skin/Hair Type', type: 'select', required: false, options: ['All Types', 'Oily', 'Dry', 'Combination', 'Sensitive', 'Normal'] },
        { key: 'gender', label: 'For', type: 'select', required: false, options: ['Men', 'Women', 'Unisex', 'Children'] },
        { key: 'organic', label: 'Natural/Organic', type: 'select', required: false, options: ['Yes', 'No'] },
        { key: 'size', label: 'Size/Volume', type: 'text', required: false, placeholder: 'e.g., 100ml, 50g' },
      ]),
    },
    {
      id: 'cat_tools',
      name: 'Tools & Equipment',
      slug: 'tools-equipment',
      description: 'Power tools, hand tools, and industrial equipment',
      icon: '🔧',
      display_order: 8,
      form_schema: JSON.stringify([
        { key: 'type', label: 'Type', type: 'select', required: true, options: ['Power Tools', 'Hand Tools', 'Welding Equipment', 'Plumbing Tools', 'Electrical Tools', 'Carpentry Tools', 'Garden Tools', 'Measuring Tools', 'Safety Equipment', 'Industrial Machinery', 'Construction Equipment', 'Other'] },
        { key: 'brand', label: 'Brand', type: 'select', required: false, options: ['Bosch', 'DeWalt', 'Makita', 'Stanley', 'Black & Decker', 'Milwaukee', 'Ingco', 'Total', 'Tolsen', 'Other'] },
        { key: 'condition', label: 'Condition', type: 'select', required: true, options: ['Brand New', 'Used - Good', 'Used - Fair', 'Needs Repair'] },
        { key: 'powerSource', label: 'Power Source', type: 'select', required: false, options: ['Electric (Corded)', 'Battery/Cordless', 'Petrol/Diesel', 'Manual', 'Pneumatic'] },
      ]),
    },
    {
      id: 'cat_leisure',
      name: 'Leisure & Activities',
      slug: 'leisure-activities',
      description: 'Sports, fitness, hobbies, and entertainment',
      icon: '⚽',
      display_order: 9,
      form_schema: JSON.stringify([
        { key: 'category', label: 'Category', type: 'select', required: true, options: ['Sports Equipment', 'Fitness/Gym', 'Outdoor/Camping', 'Musical Instruments', 'Books/Magazines', 'Board Games/Toys', 'Art & Craft Supplies', 'Bicycles', 'Video Games', 'Tickets/Events', 'Other'] },
        { key: 'sport', label: 'Sport/Activity', type: 'select', required: false, options: ['Football', 'Basketball', 'Tennis', 'Running/Athletics', 'Swimming', 'Gym/Weights', 'Cycling', 'Boxing', 'Yoga/Fitness', 'Golf', 'Other'] },
        { key: 'condition', label: 'Condition', type: 'select', required: true, options: ['Brand New', 'Used - Good', 'Used - Fair'] },
        { key: 'ageGroup', label: 'Age Group', type: 'select', required: false, options: ['Kids', 'Teens', 'Adults', 'All Ages'] },
      ]),
    },
    {
      id: 'cat_babies_kids',
      name: 'Babies & Kids',
      slug: 'babies-kids',
      description: 'Baby gear, toys, clothing, and kids items',
      icon: '👶',
      display_order: 10,
      form_schema: JSON.stringify([
        { key: 'category', label: 'Category', type: 'select', required: true, options: ['Baby Clothing', 'Kids Clothing', 'Diapers/Wipes', 'Feeding/Nursing', 'Strollers/Carriers', 'Car Seats', 'Cribs/Beds', 'Toys', 'Educational/Books', 'Baby Care Products', 'Maternity', 'Other'] },
        { key: 'ageRange', label: 'Age Range', type: 'select', required: false, options: ['0-3 months', '3-6 months', '6-12 months', '1-2 years', '2-4 years', '4-6 years', '6-10 years', '10+ years'] },
        { key: 'gender', label: 'Gender', type: 'select', required: false, options: ['Boy', 'Girl', 'Unisex'] },
        { key: 'condition', label: 'Condition', type: 'select', required: true, options: ['Brand New', 'Fairly Used'] },
        { key: 'size', label: 'Size', type: 'text', required: false },
      ]),
    },
    {
      id: 'cat_food_agriculture',
      name: 'Food, Agriculture & Farming',
      slug: 'food-agriculture-farming',
      description: 'Food products, farm produce, seeds, and agricultural supplies',
      icon: '🌾',
      display_order: 11,
      form_schema: JSON.stringify([
        { key: 'category', label: 'Category', type: 'select', required: true, options: ['Fresh Produce', 'Grains/Cereals', 'Processed Foods', 'Beverages', 'Spices/Seasonings', 'Livestock Feed', 'Seeds/Seedlings', 'Fertilizers', 'Pesticides', 'Farm Tools', 'Livestock', 'Fish/Seafood', 'Other'] },
        { key: 'origin', label: 'Origin', type: 'select', required: false, options: ['Local (Ghana)', 'Imported', 'Mixed'] },
        { key: 'dietary', label: 'Dietary', type: 'multi_select', required: false, options: ['Organic', 'Halal', 'Vegetarian', 'Vegan', 'Gluten-Free'] },
        { key: 'packaging', label: 'Packaging', type: 'select', required: false, options: ['Fresh/Loose', 'Packaged', 'Frozen', 'Canned', 'Dried', 'Bulk'] },
        { key: 'weight', label: 'Weight/Quantity', type: 'text', required: false, placeholder: 'e.g., 5kg, 50 pieces' },
      ]),
    },
    {
      id: 'cat_animals_pets',
      name: 'Animals & Pets',
      slug: 'animals-pets',
      description: 'Pets, livestock, and pet supplies',
      icon: '🐕',
      display_order: 12,
      form_schema: JSON.stringify([
        { key: 'category', label: 'Category', type: 'select', required: true, options: ['Dogs', 'Cats', 'Birds', 'Fish/Aquarium', 'Rabbits', 'Poultry (Chickens/Turkeys)', 'Goats/Sheep', 'Cattle', 'Pigs', 'Pet Food', 'Pet Accessories', 'Cages/Enclosures', 'Other'] },
        { key: 'breed', label: 'Breed', type: 'text', required: false },
        { key: 'age', label: 'Age', type: 'select', required: false, options: ['Baby/Puppy/Kitten', 'Young', 'Adult', 'Senior'] },
        { key: 'gender', label: 'Gender', type: 'select', required: false, options: ['Male', 'Female', 'Unknown', 'N/A'] },
        { key: 'vaccinated', label: 'Vaccinated', type: 'select', required: false, options: ['Yes', 'No', 'Partially', 'N/A'] },
      ]),
    },
  ];

  for (const cat of defaultCategories) {
    try {
      await client.query(
        `INSERT INTO categories (id, name, slug, description, icon, parent_id, display_order, form_schema, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NULL, $6, $7, NOW()::TEXT, NOW()::TEXT)
         ON CONFLICT (id) DO NOTHING`,
        [cat.id, cat.name, cat.slug, cat.description, cat.icon, cat.display_order, cat.form_schema]
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
