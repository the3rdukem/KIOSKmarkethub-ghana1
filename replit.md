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

## Recent Changes (January 2026)
- **Database Migration**: Migrated from better-sqlite3 to PostgreSQL using pg package
- **Async DAL**: All 12+ Data Access Layer files converted to async/await with Promise-based APIs
- **API Routes Updated**: All API routes updated to use async patterns for DAL function calls
- **Connection Pooling**: Implemented PostgreSQL connection pool with 20 max connections
- **Environment Lock**: Database connection prefers Replit PostgreSQL env vars (PGHOST, etc.)
- **Schema Migration**: PostgreSQL schema with all tables, indexes, foreign keys, and category seeding
- Implemented comprehensive governance system with vendor verification gating
- Added CategoryManagement component with database-backed API integration
- Added audit logging to product CRUD, vendor verification, user creation
