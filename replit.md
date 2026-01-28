# KIOSK - Ghana's Trusted Marketplace

## Overview
KIOSK is a secure e-commerce platform for Ghana, connecting buyers with verified vendors. It supports Mobile Money payments, robust buyer protection, and an extensive admin verification system. The platform aims to deliver a reliable and safe online shopping experience, leveraging modern web technologies to enhance Ghana's e-commerce landscape. The business vision is to become the leading trusted online marketplace in Ghana, fostering economic growth for local businesses and ensuring consumer confidence through security and transparency.

## User Preferences
I want iterative development.
I want to be asked before you make any major changes.
I prefer detailed explanations for complex solutions.
Do not make changes to files in the `src/lib/` directory unless explicitly instructed.
I prefer clear and concise communication.

## Launch Roadmap

### Tier 1 - LAUNCH BLOCKERS (Must have before launch)
| Feature | Est. Days | Status |
|---------|-----------|--------|
| Commission System | 3-4 | COMPLETE |
| Vendor Payouts (Paystack Transfers) | 5-6 | PENDING |
| SMS Notifications (Arkesel) | 2-3 | PENDING |
| Dispute Resolution + Refunds | 6-8 | PENDING |

**Subtotal: ~16-21 days**

### Tier 2 - FIRST MONTH (Post-launch priorities)
| Feature | Est. Days | Notes |
|---------|-----------|-------|
| Email Notifications (Order events) | 3-4 | Bundle with SMS |
| Low Stock Alerts (Email/SMS) | 1-2 | Quick add to existing system |
| Admin Dashboard Analytics | 4-5 | Platform oversight |
| Export Functionality (CSV) | 2-3 | Quick win |
| Social Sharing (WhatsApp focus) | 1-2 | Quick win |
| Recently Viewed Products | 2-3 | Quick win |
| Real Vendor Analytics | 3-4 | Vendor satisfaction |

**Subtotal: ~16-23 days**

### Tier 3 - GROWTH PHASE (Months 2-3)
| Feature | Est. Days | Notes |
|---------|-----------|-------|
| Product Variants (Inventory per variant) | 5-7 | Important for fashion vendors |
| Saved Payment Methods (Cards only) | 3-4 | Card users only, ~20-30% benefit |
| Push Notifications (PWA Phase 2) | 3-4 | Mobile engagement |
| Bulk Order Discounts (Vendor controlled) | 3-4 | B2B potential |

**Subtotal: ~14-19 days**

## System Architecture
The platform is built with Next.js 15, Tailwind CSS for styling, and `shadcn/ui` for UI components, ensuring a modern and responsive user experience. PostgreSQL serves as the primary database, managed with a focus on connection pooling and asynchronous data access. An API-first approach governs all major data interactions.

**UI/UX Decisions:**
- Modern and responsive design using Tailwind CSS and `shadcn/ui`.
- Admin UI includes fixed table layouts and consistent column widths.
- Enhanced search page UX with Radix Select for category filters, dynamic price sliders, and category attribute filters.
- **Phase 7C Tab Navigation**: All dashboard tabs (Admin, Buyer, Vendor) use URL-synced state via `useSearchParams` + `router.push`, enabling direct linking to specific tabs (e.g., `/buyer/dashboard?tab=orders`).
- **API Performance Optimizations**: Products API defaults to limit=50 (max 200), Orders API defaults to limit=100 (max 500). Input validation prevents NaN and negative values. Database indexes on `products(category)`, `products(status)`, `orders(status)`, `orders(created_at DESC)` for faster queries.

**Technical Implementations:**
- **Database**: PostgreSQL with a Data Access Layer (DAL) using `pg` for connection pooling. Schema enforces comprehensive constraints.
- **Authentication**: Server-authoritative session management via `session_token` httpOnly cookie, strong password validation, and globally unique admin emails. Google OAuth is integrated for buyer and vendor sign-in.
- **Input Validation**: Comprehensive server-side validation across all API endpoints with structured error responses, client-side feedback, and specific validations for email, phone formats, and content safety. Product forms use Zod schema and React Hook Form.
- **Governance System**: Manages vendor and product verification, product gating, category management with dynamic form schemas, and audit logging.
- **Product Contract Unification**: A canonical product data contract ensures consistent data shape and handles data conversions, integrating product conditions as category-specific attributes.
- **Admin Permissions**: Granular permissions, including master admin capabilities.
- **Cart System**: Secure ownership model supporting guest and authenticated users, with guest-to-user cart merging.
- **Reviews System**: Database-backed system for product reviews with 15-minute edit window enforcement, vendor reply locking (edits blocked after vendor responds), single vendor reply (append-only), and admin moderation (hide/unhide/delete). No standalone buyer reviews page - buyers access reviews through product pages.
- **Promotions System**: Database-backed coupons and sales management, allowing vendors to create promotions.
- **Order Pipeline (Phase 7B Refactor)**: Server-side order management with PostgreSQL, covering checkout flows (inventory decrement, audit logging), vendor fulfillment, and admin cancellation (inventory restoration). Uses three-track status model:
  - **Order Status**: `created` → `confirmed` (payment received) → `preparing` → `ready_for_pickup` → `out_for_delivery` → `delivered` → `completed` (terminal). Also: `cancelled`, `disputed`, `delivery_failed`.
  - **Item Fulfillment**: `pending` → `packed` → `handed_to_courier` → `delivered`.
  - **Payment Status**: Separate track via Paystack webhook.
  - **48-hour Dispute Window**: Buyers can raise disputes within 48 hours after delivery. Orders auto-complete to `completed` after 48 hours with no dispute.
  - **Status Transition Guards**: `isValidStatusTransition` validates all status changes with actor permissions (system/vendor/buyer/admin), returns 409 Conflict on invalid transitions.
  - **Legacy Compatibility**: All old statuses (`pending_payment`, `processing`, `shipped`, `fulfilled`) still work via normalization functions.
  - **Migration Endpoint**: `/api/admin/migrate-orders-phase7b` adds new columns (`courier_provider`, `courier_reference`, `delivered_at`, `disputed_at`, `dispute_reason`) and optionally migrates legacy statuses.
- **Phase 7D Courier-Assisted Delivery (Multi-Vendor)**: Each vendor manages their own items' delivery independently within multi-vendor orders. Per-vendor delivery flow: Pack items → Ready for Pickup → Book Courier → Mark Delivered. New `order_items` columns: `vendor_courier_provider`, `vendor_courier_reference`, `vendor_ready_for_pickup_at`, `vendor_delivered_at`. API actions: `vendorReadyForPickup`, `vendorBookCourier`, `vendorMarkDelivered`. UI shows delivery buttons based on vendor's item status (not order status), enabling proper multi-vendor workflows. Courier selection modal supports Bolt/Uber/Yango/Qargo/Other. Mobile deep links use native app URL schemes with automatic fallback to web URLs. **Courier App Prefilling**: Uber and Yango support coordinate-based address prefill via `/api/geocode` endpoint (uses Google Maps Geocoding API). Uber deep links include pickup (vendor's current location) and dropoff (customer address with coordinates). Yango deep links include destination coordinates. Bolt does not support prefilling (opens app homepage). Admin endpoint `/api/admin/orders/auto-complete` processes orders where all vendor deliveries are complete >48h for automatic completion. All transitions use DAL functions with audit logging and buyer notifications.
- **Auth Redirect Security**: Utilizes `getSafeRedirectUrl()` to prevent open redirect vulnerabilities.
- **Buyer Orders Persistence**: Buyer orders are synced with the Zustand store upon user identity changes.
- **Database-Backed Wishlist**: `wishlist_items` table with CRUD operations, API endpoints, and a store that syncs with the database for authenticated users and uses `localStorage` for guests.
- **Dynamic Filtering**: Price slider initializes from actual product prices, and category attribute filters dynamically appear based on selected categories.
- **Payment System**: Updates include `payment_reference`, `payment_provider`, `paid_at`, and `currency` columns in orders table. Webhook integration handles payment status updates.
- **Messaging System**: Features a database schema for conversations and messages, DAL layer with role-based authorization, and REST API endpoints for full messaging functionality. Supports context types and conversation statuses.
- **In-App Notifications**: Database table `notifications` with user_id, role, type, title, message, payload, is_read fields. Append-only design with DAL and API for managing notifications.
- **Email Infrastructure**: Database table `email_templates`, DAL for provider config and templates, and Admin API endpoints for managing email settings and templates. Supports dry-run mode, rich text template editor with WYSIWYG editing and cursor-aware variable insertion, template resolution with variable extraction/validation/compilation, and graceful fallback to inline content when templates are missing or inactive. Kill-switch and dry-run checks execute before template resolution to prevent DB access when email is disabled.
- **Password Reset Flow**: Complete end-to-end password reset with `/forgot-password` (email request) and `/reset-password` (token-based confirmation) pages. Uses secure tokens (hashed, 30-min expiry, single-use), no auto-login after reset, password strength validation matching registration requirements.
- **Analytics Event Tracking**: Non-blocking, fire-and-forget analytics for tracking user interactions, ready for external provider integration.
- **Site Content Management System**: Fully database-backed site content management allowing admin control over branding (logo, site name, tagline), promotional banners (toggle, text, link), hero slideshow (carousel with 5-second auto-rotation, admin-managed slides with image/title/link at `/admin/hero-slides`), footer links (custom ordering/visibility), homepage section titles (categories, featured, stats, CTA sections), and static pages with full CRUD (create, edit, delete) accessible at `/pages/[slug]`. Static pages can be toggled published/draft and footer visibility directly from admin list. All content changes take effect without code deployment.
- **PWA Support (Phase 1 - Installability)**: Progressive Web App features implemented using `next-pwa`. Includes web app manifest (`/public/manifest.json`), 10 app icons (8 standard sizes + 2 maskable at 192x192 and 512x512), PWA meta tags in layout.tsx. Service worker caches only static assets (fonts, images, JS/CSS bundles). API routes explicitly excluded from caching using NetworkOnly strategy. PWA branding uses "KIOSK" name with green theme (#16a34a). No offline write support, no background sync - installability only.
- **Commission System (Phase 12 - COMPLETE)**: Platform revenue generation via automated commission calculation and tracking.
  - **3-Tier Priority**: Vendor-specific rate → Category rate → Default rate (8%)
  - **Database Schema**: `commission_rate` in vendors/categories tables, `platform_commission`/`vendor_earnings` in orders and order_items tables
  - **Commission DAL** (`src/lib/db/dal/commission.ts`): Full calculation logic with `calculateCommission()`, rate getters/setters, summary statistics
  - **Order Integration**: Commission calculated atomically during order creation, stored at both order and order_item level for multi-vendor support
  - **Admin UI**: `/admin/commission` page for managing default, category, and vendor-specific rates with earnings summary (wrapped in SiteLayout for consistent navigation)
  - **Vendor Dashboard**: Updated to show earnings after platform fee, with pending vs completed breakdown

## External Dependencies
- **Paystack**: Payment gateway for Mobile Money transactions.
- **PostgreSQL**: Managed relational database service.
- **Image Storage**: Supabase Storage integration for cloud image hosting, configurable via Admin > API Management. Uses service role key for secure uploads with automatic fallback to local Base64 storage when not configured.
- **Google OAuth**: OAuth 2.0 integration for buyer and vendor sign-in.
- **Google Maps Places API**: Location services for address autocompletion, with client-side API key access and HTTP referrer restrictions.
- **Smile Identity KYC Integration**: Uses the `smile-identity-core` npm SDK for secure biometric and ID verification, with webhook integration for status updates.