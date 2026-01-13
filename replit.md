# Sabi Market V3

## Overview
MarketHub is a secure e-commerce platform for Ghana, connecting buyers with verified vendors. It supports Mobile Money payments, robust buyer protection, and an extensive admin verification system. The platform aims to deliver a reliable and safe online shopping experience, leveraging modern web technologies to enhance Ghana's e-commerce landscape.

## User Preferences
I want iterative development.
I want to be asked before you make any major changes.
I prefer detailed explanations for complex solutions.
Do not make changes to files in the `src/lib/` directory unless explicitly instructed.
I prefer clear and concise communication.

## System Architecture
The platform is built with Next.js 15, Tailwind CSS for styling, and `shadcn/ui` for UI components, ensuring a modern and responsive user experience. PostgreSQL serves as the primary database, managed with a focus on connection pooling and asynchronous data access. An API-first approach governs all major data interactions.

**UI/UX Decisions:**
- Modern and responsive design using Tailwind CSS and `shadcn/ui`.
- Admin UI includes fixed table layouts, specific Radix UI component adjustments for event handling, and consistent column widths.
- Enhanced search page UX with Radix Select for category filters, dynamic price sliders, and category attribute filters.

**Technical Implementations:**
- **Database**: PostgreSQL with a Data Access Layer (DAL) using `pg` for connection pooling. Schema enforces constraints like `UNIQUE`, `NOT NULL`, `CHECK`, and `FOREIGN KEY`.
- **Authentication**: Server-authoritative session management via `session_token` httpOnly cookie, strong password validation, and globally unique admin emails.
- **Input Validation**: Comprehensive server-side validation across all API endpoints with structured error responses, client-side feedback, and specific validations for email, phone formats, and content safety. Product forms use Zod schema and React Hook Form.
- **Governance System**: Manages vendor and product verification, product gating, category management with dynamic form schemas, and audit logging.
- **Product Contract Unification**: A canonical product data contract ensures consistent data shape and handles data conversions between database and API formats. Product conditions are integrated as category-specific attributes.
- **Admin Permissions**: Granular permissions, including master admin capabilities for managing other admin accounts and preventing self-deletion.
- **Cart System**: Secure ownership model supporting guest and authenticated users, with guest-to-user cart merging.
- **Reviews System**: Database-backed system for product reviews, vendor replies, and moderation.
- **Promotions System**: Database-backed coupons and sales management, allowing vendors to create promotions and admins to oversee them, impacting `effectivePrice`.
- **Order Pipeline**: Server-side order management with PostgreSQL, covering checkout flows (inventory decrement, audit logging), vendor fulfillment, and admin cancellation (inventory restoration). Includes real-time status updates and robust inventory reservation using atomic transactions (`SELECT FOR UPDATE`). Order status transitions through `pending_payment`, `processing`, and `fulfilled`.
- **Auth Redirect Security**: Utilizes `getSafeRedirectUrl()` to prevent open redirect vulnerabilities.
- **Buyer Orders Persistence**: Ensures buyer orders are synced with the Zustand store upon user identity changes.
- **Database-Backed Wishlist**: `wishlist_items` table with CRUD operations, API endpoints, and a store that syncs with the database for authenticated users and uses `localStorage` for guests, including guest-to-user merging.
- **Dynamic Filtering**: Price slider initializes from actual product prices, and category attribute filters dynamically appear based on selected categories, filtering products based on `categoryAttributes`.
- **Payment System**: Updates include `payment_reference`, `payment_provider`, `paid_at`, and `currency` columns in orders table. Webhook integration via `updateOrderPaymentStatus()` handles payment status updates. Checkout flow creates orders in `pending_payment` status before payment, passing `orderId` in Paystack metadata. Includes inventory restoration on payment failure, atomic inventory reservation, payment amount validation, and idempotency for webhooks. Admin payment modification is restricted to webhooks.
- **Dual-Status Fix**: Payment confirmation updates both `payment_status` and main `status` fields, introducing a 'processing' status (Payment Confirmed).
- **Order Cancellation Enhancement**: Admin can cancel 'pending_payment' and 'processing' orders; cancelling a paid order sets `payment_status` to 'refunded' and indicates `refundRequired`.

## External Dependencies
- **Paystack**: Payment gateway for Mobile Money transactions.
- **PostgreSQL**: Managed relational database service.
- **Image Storage**: Provider-agnostic abstraction for image uploads, with current local filesystem usage and a clear cloud migration path.
- **Google OAuth**: OAuth 2.0 integration for buyer and vendor sign-in (admins use password only).

## Phase 4A: API Integrations & Identity (Jan 2026)

**Google OAuth Integration:**
- Server-side OAuth URL generation at `/api/auth/google/init` (keeps client_secret secure)
- Server-side credential handling via `src/lib/db/dal/google-oauth-server.ts` - reads credentials directly from database
- OAuth callback routes at `/api/auth/google/callback` and `/api/auth/callback/google`
- OAuth user creation/linking in `auth-service.ts` with `createOrLinkOAuthUser()` and `createSessionForUser()`
- Buyers and vendors only (admins blocked from OAuth)
- Vendors get default business name "{Name}'s Store" if not provided
- OAuth respects existing email uniqueness rules (buyer+vendor can share same email)
- No role elevation through OAuth
- Credentials stored encrypted in database, managed via Admin → API Management
- Detailed error propagation for misconfiguration states (disabled, not configured, missing fields)

**Analytics Event Tracking:**
- Non-blocking, fire-and-forget analytics at `src/lib/analytics.ts`
- Tracks: page views, product views, cart actions, checkout, payments, search, auth events
- No PII leakage (only user/product IDs, no emails/names)
- Zustand store with localStorage persistence (last 100 events)
- Ready for external provider integration

**Messaging System (Complete):**
- Database schema: `conversations`, `messages`, `messaging_audit_logs` tables in PHASE 6 migration
- DAL layer at `src/lib/db/dal/messaging.ts` with role-based authorization (buyer/vendor only), cursor-based pagination, atomic unread count updates
- REST API endpoints:
  - `GET/POST /api/messaging/conversations` - List and create conversations
  - `GET/PATCH /api/messaging/conversations/[id]` - Get and update single conversation (pin, mute, archive)
  - `GET/POST /api/messaging/conversations/[id]/messages` - List and send messages
  - `POST /api/messaging/conversations/[id]/read` - Mark conversation as read
  - `GET /api/messaging/unread` - Get total unread count
- Context types: product_inquiry, order_support, general, dispute
- Conversation statuses: active, archived, flagged, closed
- Message types: text, image, file, system
- Soft deletion and audit logging for moderation
- Admin access blocked from buyer/vendor endpoints (requires separate /api/admin/messaging endpoints)
- Client-side Zustand store at `src/lib/messaging-store.ts` syncs with database via API