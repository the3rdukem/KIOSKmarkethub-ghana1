# Sabi Market V3

## Overview
MarketHub is a secure marketplace platform for Ghana with verified vendors, Mobile Money payments, and buyer protection. Built with Next.js 15, Tailwind CSS, shadcn/ui components, and PostgreSQL for database storage.

## Project Structure
- `src/app/` - Next.js App Router pages and API routes
  - `admin/` - Admin dashboard pages
  - `api/` - API endpoints for auth, products, orders, vendors, etc.
  - `auth/` - Authentication pages (login, register)
  - `buyer/` - Buyer dashboard and features
  - `vendor/` - Vendor dashboard and product management
- `src/components/` - React components
  - `ui/` - shadcn/ui base components
  - `layout/` - Site layout components (nav, footer)
  - `integrations/` - Third-party service integrations
- `src/lib/` - Utilities and business logic
  - `db/` - Database schema and data access layer
  - `services/` - External service integrations (Paystack, SMS, etc.)
  - `*-store.ts` - Zustand state management stores

## Development
- **Dev Server**: `npm run dev` (runs on port 5000)
- **Build**: `npm run build`
- **Database**: PostgreSQL via Replit's managed database (PGHOST, PGDATABASE, PGUSER, PGPASSWORD)

## Database Architecture
- **PostgreSQL-Only**: Database has been migrated from SQLite to PostgreSQL
- **Connection Pool**: Uses `pg` package with connection pooling (max 20 connections)
- **Async DAL**: All Data Access Layer functions are async/await with Promise return types
- **Query Pattern**: Uses `await query<Type>(sql, [params])` with `.rows[0]` or `.rows` access
- **Placeholders**: PostgreSQL uses `$1, $2, $3...` instead of SQLite's `?`
- **Environment Priority**: Prefers PGHOST/PGUSER/etc env vars over DATABASE_URL

## Key Features
- Multi-vendor marketplace
- Admin verification system
- Mobile Money payments via Paystack
- Order tracking
- Buyer protection
- Real-time chat/messaging

## Authentication Architecture
- **Single Canonical Cookie**: Only `session_token` (httpOnly) is used for authentication
- **Server-Authoritative**: No client-side storage (localStorage/sessionStorage) for auth state
- **Firefox-Safe Logout**: Cookie deletion uses empty value + maxAge=0 with identical attributes
- **Unified Logout**: All user types (Buyer, Vendor, Admin) use `/api/auth/logout` endpoint
- **Session Validation**: Role derived from server-side session, not separate cookies

## Governance System
- **Vendor Product Gating**: Unverified vendors can create drafts but cannot publish (auto-downgraded to 'draft' with 403)
- **Category Management**: Database-backed CRUD with dynamic form schema builder (src/components/admin/category-management.tsx)
- **Admin Product Creation**: Admins can create products on behalf of vendors via vendorId parameter
- **Admin User Creation**: Uses canonical createUser() for all user types (src/app/api/admin/users/route.ts)
- **Audit Logging**: All critical actions logged to audit_logs table with admin metadata (src/lib/db/dal/audit.ts)

## Admin Components
- `VendorManagement` - Vendor verification, approve/reject/suspend with audit trail
- `UserManagement` - User CRUD, role management, status actions
- `CategoryManagement` - Category CRUD with dynamic form field builder
- `AuditLogs` - View audit trail for all governance actions

## Master Admin Account
- **Email**: the3rdukem@gmail.com
- **Default Password**: 123asdqweX$
- **Auto-Seeding**: Master admin is automatically created during database initialization if none exists
- **Override**: Set MASTER_ADMIN_EMAIL and MASTER_ADMIN_PASSWORD env vars to customize
- **Password Format**: salt:hash using SHA256 (compatible with users.ts hashPassword/verifyPassword)

## Recent Changes (January 2026)
- **Master Admin Seeding**: Added seedMasterAdmin() to database initialization with idempotent creation
- **Database Migration**: Migrated from better-sqlite3 to PostgreSQL using pg package
- **Async DAL**: All 12+ Data Access Layer files converted to async/await with Promise-based APIs
- **API Routes Updated**: All API routes updated to use async patterns for DAL function calls
- **Connection Pooling**: Implemented PostgreSQL connection pool with 20 max connections
- **Environment Lock**: Database connection prefers Replit PostgreSQL env vars (PGHOST, etc.)
- **Schema Migration**: PostgreSQL schema with all tables, indexes, foreign keys, and category seeding
- Implemented comprehensive governance system with vendor verification gating
- Added CategoryManagement component with database-backed API integration
- Added audit logging to product CRUD, vendor verification, user creation
- **Vendor Publish UX Fix**: Publish button disabled for unverified vendors, shows amber warning, toast messages check actual vs requested status
- **Audit Logs Page Rewrite**: Now fetches from PostgreSQL API `/api/admin/audit-logs` instead of Zustand store
- **Admin User Creation Flow**: Verified canonical createUser() works correctly for all user types
- **Admin Stats API**: Confirmed getUserStats() uses correct lowercase column names for PostgreSQL
- **Admin Product Image Upload**: Added MultiImageUpload component to admin product creation form, replacing URL-only input with full file upload support (drag-and-drop, multiple images up to 5, base64 encoding)
- **Admin Stats Revenue Fix**: Fixed orders revenue calculation to use correct `total` column instead of non-existent `total_amount`
- **Admin Dashboard Audit Tab Fix**: Dashboard audit tab now fetches from `/api/admin/audit-logs` instead of empty Zustand store
- **Admin Creation API Fix**: Create Admin dialog now POSTs to `/api/admin/users` for database persistence (was only updating client store)
- **Public Vendor API**: Added `/api/vendors/[id]` for public vendor store pages (only active vendors, no sensitive data)
- **Vendor Store Page**: Now fetches vendor and products from database APIs instead of client-side Zustand stores
- **Admin Admins API**: Created `/api/admin/admins` endpoint for fetching admin users from database (not Zustand)
- **Admin Management Refactor**: AdminManagementSection now fetches from API, refreshes after create, uses database as source of truth
- **Product Management DB-First**: ProductManagement component now fetches products from `/api/products` API instead of Zustand store
- **Draft Product Visibility**: Added Draft status card to product management quick stats, all product statuses visible to admin
- **Admin Revoke API**: Created `/api/admin/admins/[id]` endpoint for revoking/activating admin access
- **Product Actions API**: Added PATCH handler to `/api/products/[id]` for admin actions (approve, reject, suspend, unsuspend, feature, unfeature)
- **Vendor Product Delete API-First**: Vendor product delete now uses DELETE API with fetchVendorProducts() refresh
- **Null-Safe Product Edit Form**: All product fields use nullish coalescing for safe defaults, arrays checked with Array.isArray()
- **Draft Save Validation**: Draft saves only require product name, full validation only for publish
- **Duplicate Product**: Added handleDuplicateProduct with unique SKU generation, creates draft and redirects to edit page
- **API-First Product Updates**: Vendor edit page now uses PUT /api/products/[id] instead of Zustand store
- **Admin Product Edit Page**: Created `/admin/products/edit/[id]` for admin to edit any product
- **Admin Publish/Unpublish Actions**: Added publish/unpublish actions to PATCH API and admin product dropdown
- **Product Count Labels**: Admin product stats now show "Published (X)", "Drafts (Y)", "Suspended (Z)" format
- **Admin Product Dropdown**: Added Edit, Publish, and Unpublish menu items for full admin control
- **Vendor Edit API-First**: Vendor product edit page now fetches from `/api/products/[id]` instead of Zustand store (fixes duplicate product navigation)
- **Admin Activity Tracking**: Added `previous_login_at` column to users/admin_users tables with migration, login rotates timestamps (previous = last, last = now), `/api/admin/activity-summary` counts new items since last login, admin tabs show blue "+X" badges for new products/orders/vendors/disputes
- **Vendor Stats API**: Created `/api/vendor/stats` endpoint that calculates vendor-specific metrics by parsing order items JSON and filtering by vendorId. Revenue is calculated from vendor's items only (price × quantity), not full order totals. Orders stored as JSON array in orders.items column.
- **Vendor Dashboard DB-First**: Vendor dashboard now fetches stats from `/api/vendor/stats` API instead of Zustand stores, with loading state indicator
- **Cache Invalidation Fix**: All dashboard APIs (`/api/admin/activity-summary`, `/api/admin/stats`, `/api/vendor/stats`) now use `dynamic = 'force-dynamic'`, `revalidate = 0`, and no-store cache headers to ensure immediate DB reads without caching
- **Activity Badge Race Condition Fix**: Replaced `previous_login_at` with `last_activity_checkpoint_at` column for stable session-scoped activity counts. Checkpoint is set ONCE at login (to the previous login timestamp) and stays stable for the entire session. Eliminates race conditions by fetching activity counts once on mount (empty `[]` dependency) instead of on `user?.id` changes. Fallback chain: checkpoint -> previous_login -> created_at for first-time admins.
- **Admin Tab Consistency Fix**: USERS tab now shows only activity count (removed Zustand system total). ORDERS tab now fetches from database API `/api/orders` instead of Zustand store, with activity count working regardless of system total.
- **User Management Stat Tiles**: Added 6 stat cards to UserManagement component (Total Users, Buyers, Vendors, Active, Suspended, Deleted) with clickable filters matching Vendor/Product management pattern.
- **Order Management Stat Tiles**: Added 6 stat cards to Orders tab (Total Orders, Pending, Processing, Delivered, Cancelled, Revenue) computed from database orders, matching the admin dashboard pattern.
