-- MarketHub Database Schema
-- SQLite database for Replit-ready persistence

-- Enable foreign keys
PRAGMA foreign_keys = ON;

-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT, -- NULL for OAuth users
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('buyer', 'vendor', 'admin', 'master_admin')),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'suspended', 'pending', 'banned', 'deleted')),
  avatar TEXT,
  phone TEXT,
  location TEXT,

  -- Vendor fields
  business_name TEXT,
  business_type TEXT,
  verification_status TEXT CHECK(verification_status IN ('pending', 'under_review', 'verified', 'rejected', 'suspended')),
  verification_documents TEXT, -- JSON
  verification_notes TEXT,
  verified_at TEXT,
  verified_by TEXT,

  -- Store fields (for vendors)
  store_description TEXT,
  store_banner TEXT,
  store_logo TEXT,
  store_website TEXT,
  store_business_hours TEXT,
  store_return_policy TEXT,
  store_shipping_policy TEXT,
  store_specialties TEXT, -- JSON array
  store_certifications TEXT, -- JSON array
  store_rating REAL,
  store_response_time TEXT,
  store_status TEXT CHECK(store_status IN ('open', 'closed', 'vacation')),
  store_vacation_message TEXT,
  store_contact_email TEXT,
  store_contact_phone TEXT,
  store_social_links TEXT, -- JSON

  -- Stats
  total_orders INTEGER DEFAULT 0,
  total_spent REAL DEFAULT 0,
  total_sales REAL DEFAULT 0,
  total_products INTEGER DEFAULT 0,

  -- Soft delete
  is_deleted INTEGER DEFAULT 0,
  deleted_at TEXT,
  deleted_by TEXT,
  deletion_reason TEXT,

  -- Timestamps
  last_login_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- ============================================
-- ADMIN USERS TABLE (System Config)
-- ============================================
CREATE TABLE IF NOT EXISTS admin_users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('MASTER_ADMIN', 'ADMIN')),
  is_active INTEGER NOT NULL DEFAULT 1,
  permissions TEXT, -- JSON array
  mfa_enabled INTEGER DEFAULT 0,
  created_by TEXT,
  last_login_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================
-- PRODUCTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  vendor_id TEXT NOT NULL,
  vendor_name TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  condition TEXT, -- Top-level condition field (New, Like New, Good, Fair, Used)
  price REAL NOT NULL,
  compare_price REAL,
  cost_per_item REAL,
  sku TEXT,
  barcode TEXT,
  quantity INTEGER DEFAULT 0,
  track_quantity INTEGER DEFAULT 1,
  images TEXT, -- JSON array
  weight REAL,
  dimensions TEXT, -- JSON
  tags TEXT, -- JSON array
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'draft', 'archived', 'pending_approval', 'rejected', 'suspended')),
  category_attributes TEXT, -- JSON (must NOT contain condition - condition is top-level)

  -- Moderation
  approval_status TEXT CHECK(approval_status IN ('pending', 'approved', 'rejected')),
  approved_by TEXT,
  approved_at TEXT,
  rejection_reason TEXT,
  suspended_by TEXT,
  suspended_at TEXT,
  suspension_reason TEXT,
  is_featured INTEGER DEFAULT 0,
  featured_at TEXT,
  featured_by TEXT,

  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (vendor_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_products_vendor ON products(vendor_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);

-- ============================================
-- ORDERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  buyer_id TEXT NOT NULL,
  buyer_name TEXT NOT NULL,
  buyer_email TEXT NOT NULL,
  items TEXT NOT NULL, -- JSON array
  subtotal REAL NOT NULL,
  shipping_fee REAL DEFAULT 0,
  tax REAL DEFAULT 0,
  total REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded')),
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK(payment_status IN ('pending', 'paid', 'failed', 'refunded')),
  payment_method TEXT,
  shipping_address TEXT NOT NULL, -- JSON
  tracking_number TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (buyer_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_orders_buyer ON orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);

-- ============================================
-- CATEGORIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  icon TEXT,
  image TEXT,
  parent_id TEXT,
  is_active INTEGER DEFAULT 1,
  order_index INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (parent_id) REFERENCES categories(id)
);

-- ============================================
-- REVIEWS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  buyer_id TEXT NOT NULL,
  buyer_name TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
  title TEXT,
  comment TEXT,
  images TEXT, -- JSON array
  is_verified_purchase INTEGER DEFAULT 0,
  is_visible INTEGER DEFAULT 1,
  vendor_response TEXT,
  vendor_response_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (buyer_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id);

-- ============================================
-- MESSAGES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  sender_role TEXT NOT NULL,
  recipient_id TEXT NOT NULL,
  recipient_name TEXT NOT NULL,
  content TEXT NOT NULL,
  is_read INTEGER DEFAULT 0,
  attachments TEXT, -- JSON array
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(recipient_id);

-- ============================================
-- CONVERSATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  participant_ids TEXT NOT NULL, -- JSON array
  participant_names TEXT NOT NULL, -- JSON
  last_message TEXT,
  last_message_at TEXT,
  unread_count INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================
-- VERIFICATION SUBMISSIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS verification_submissions (
  id TEXT PRIMARY KEY,
  vendor_id TEXT NOT NULL,
  vendor_name TEXT NOT NULL,
  vendor_email TEXT NOT NULL,
  id_document TEXT,
  id_document_type TEXT,
  facial_image TEXT,
  facial_match_score REAL,
  business_license TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'under_review', 'approved', 'rejected', 'needs_info')),
  reviewer_id TEXT,
  reviewer_name TEXT,
  review_notes TEXT,
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (vendor_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_verification_vendor ON verification_submissions(vendor_id);
CREATE INDEX IF NOT EXISTS idx_verification_status ON verification_submissions(status);

-- ============================================
-- DISPUTES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS disputes (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  buyer_id TEXT NOT NULL,
  buyer_name TEXT NOT NULL,
  buyer_email TEXT NOT NULL,
  vendor_id TEXT NOT NULL,
  vendor_name TEXT NOT NULL,
  product_id TEXT,
  product_name TEXT,
  amount REAL,
  type TEXT NOT NULL CHECK(type IN ('refund', 'quality', 'delivery', 'fraud', 'other')),
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'investigating', 'resolved', 'escalated', 'closed')),
  priority TEXT DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high', 'urgent')),
  description TEXT,
  resolution TEXT,
  assigned_to TEXT,
  messages TEXT, -- JSON array
  resolved_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (order_id) REFERENCES orders(id)
);

-- ============================================
-- AUDIT LOGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('vendor', 'user', 'product', 'order', 'api', 'system', 'auth', 'admin', 'security')),
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
  severity TEXT DEFAULT 'info' CHECK(severity IN ('info', 'warning', 'critical')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_category ON audit_logs(category);
CREATE INDEX IF NOT EXISTS idx_audit_admin ON audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);

-- ============================================
-- INTEGRATIONS TABLE (API Configurations)
-- ============================================
CREATE TABLE IF NOT EXISTS integrations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  provider TEXT NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('auth', 'maps', 'payment', 'otp', 'storage', 'ai', 'verification')),
  is_enabled INTEGER DEFAULT 0,
  is_configured INTEGER DEFAULT 0,
  environment TEXT DEFAULT 'demo' CHECK(environment IN ('demo', 'live')),
  status TEXT DEFAULT 'not_configured' CHECK(status IN ('connected', 'error', 'disconnected', 'not_configured')),
  credentials TEXT, -- JSON (encrypted in production)
  last_tested_at TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================
-- SITE SETTINGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_by TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================
-- SYSTEM SETTINGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_by TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================
-- PROMOTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS promotions (
  id TEXT PRIMARY KEY,
  vendor_id TEXT,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('discount', 'coupon', 'flash_sale', 'bundle')),
  discount_type TEXT CHECK(discount_type IN ('percentage', 'fixed')),
  discount_value REAL,
  coupon_code TEXT,
  min_purchase REAL,
  max_uses INTEGER,
  current_uses INTEGER DEFAULT 0,
  applicable_products TEXT, -- JSON array
  applicable_categories TEXT, -- JSON array
  start_date TEXT,
  end_date TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================
-- BANNERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS banners (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  subtitle TEXT,
  description TEXT,
  image_url TEXT,
  link_url TEXT,
  position TEXT DEFAULT 'top' CHECK(position IN ('top', 'sidebar', 'footer', 'popup', 'hero')),
  background_color TEXT,
  text_color TEXT,
  cta_text TEXT,
  start_date TEXT,
  end_date TEXT,
  is_active INTEGER DEFAULT 1,
  order_index INTEGER DEFAULT 0,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================
-- STATIC PAGES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS static_pages (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  meta_title TEXT,
  meta_description TEXT,
  is_published INTEGER DEFAULT 0,
  show_in_footer INTEGER DEFAULT 0,
  show_in_header INTEGER DEFAULT 0,
  order_index INTEGER DEFAULT 0,
  created_by TEXT,
  updated_by TEXT,
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================
-- WISHLIST TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS wishlist_items (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),

  UNIQUE(user_id, product_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

-- ============================================
-- CART TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS cart_items (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  variations TEXT, -- JSON
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),

  UNIQUE(user_id, product_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

-- ============================================
-- ADDRESSES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS addresses (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  label TEXT,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address_line1 TEXT NOT NULL,
  address_line2 TEXT,
  city TEXT NOT NULL,
  region TEXT NOT NULL,
  postal_code TEXT,
  digital_address TEXT,
  is_default INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ============================================
-- NOTIFICATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data TEXT, -- JSON
  is_read INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);

-- ============================================
-- PAYOUTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS payouts (
  id TEXT PRIMARY KEY,
  vendor_id TEXT NOT NULL,
  amount REAL NOT NULL,
  fee REAL DEFAULT 0,
  net_amount REAL NOT NULL,
  payment_method TEXT NOT NULL,
  payment_details TEXT, -- JSON
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  reference TEXT,
  notes TEXT,
  processed_by TEXT,
  processed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (vendor_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_payouts_vendor ON payouts(vendor_id);
CREATE INDEX IF NOT EXISTS idx_payouts_status ON payouts(status);

-- ============================================
-- SESSIONS TABLE (for server-side auth)
-- ============================================
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_role TEXT NOT NULL,
  token_hash TEXT UNIQUE NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
