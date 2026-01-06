# Sabi Market V3

## Overview
MarketHub is a secure marketplace platform for Ghana with verified vendors, Mobile Money payments, and buyer protection. Built with Next.js 15, Tailwind CSS, shadcn/ui components, and better-sqlite3 for local database storage.

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
- **Database**: SQLite via better-sqlite3 (stored locally)

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

## Recent Changes (January 2026)
- Fixed logout and session termination for Firefox compatibility
- Removed localStorage persistence from auth store
- Consolidated to single session_token cookie (removed user_role and is_authenticated cookies)
- Made logout await server response before redirecting
