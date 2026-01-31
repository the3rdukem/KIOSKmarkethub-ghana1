# KIOSK - Ghana's Trusted Marketplace

## Overview
KIOSK is a secure e-commerce platform for Ghana, connecting buyers with verified vendors. It supports Mobile Money payments, robust buyer protection, and an extensive admin verification system. The platform aims to deliver a reliable and safe online shopping experience, leveraging modern web technologies to enhance Ghana's e-commerce landscape. The business vision is to become the leading trusted online marketplace in Ghana, fostering economic growth for local businesses and ensuring consumer confidence through security and transparency.

## User Preferences
I want iterative development.
I want to be asked before you make any major changes.
I prefer detailed explanations for complex solutions.
Do not make changes to files in the `src/lib/` directory unless explicitly instructed.
I prefer clear and concise communication.
**ALL fixes and features MUST be Render.com deploy friendly** - no Replit-specific dependencies.

## System Architecture
The platform is built with Next.js 15, Tailwind CSS for styling, and `shadcn/ui` for UI components, ensuring a modern and responsive user experience. PostgreSQL serves as the primary database, managed with a focus on connection pooling and asynchronous data access. An API-first approach governs all major data interactions.

**UI/UX Decisions:**
- Modern and responsive design using Tailwind CSS and `shadcn/ui`.
- Admin UI includes fixed table layouts and consistent column widths.
- Enhanced search page UX with Radix Select for category filters, dynamic price sliders, and category attribute filters.
- Dashboard tabs (Admin, Buyer, Vendor) use URL-synced state for direct linking.

**Technical Implementations:**
- **Database**: PostgreSQL with a Data Access Layer (DAL) using `pg` for connection pooling and comprehensive schema constraints.
- **Authentication**: Server-authoritative session management via `session_token` httpOnly cookie, strong password validation, globally unique admin emails, and Google OAuth for buyer/vendor sign-in.
- **Input Validation**: Comprehensive server-side validation across all API endpoints with structured error responses, client-side feedback, and specific validations for various data types.
- **Governance System**: Manages vendor/product verification, product gating, category management with dynamic form schemas, and audit logging.
- **Product Contract Unification**: Ensures consistent product data shape and handles data conversions.
- **Admin Permissions**: Granular permissions, including master admin capabilities.
- **Cart System**: Secure ownership model supporting guest and authenticated users, with guest-to-user cart merging.
- **Reviews System**: Database-backed system for product reviews with edit windows, vendor reply locking, and admin moderation.
- **Promotions System**: Database-backed coupons and sales management, allowing vendors to create promotions.
- **Order Pipeline**: Server-side order management covering checkout (inventory decrement, audit logging), vendor fulfillment, and admin cancellation (inventory restoration). Features a three-track status model (Order, Item Fulfillment, Payment), a 48-hour dispute window, and `isValidStatusTransition` for status changes with actor permissions.
- **Courier-Assisted Delivery (Multi-Vendor)**: Supports independent delivery management by each vendor within multi-vendor orders, including courier booking and status updates. Integrates with courier apps for address prefilling.
- **Auth Redirect Security**: Utilizes `getSafeRedirectUrl()` to prevent open redirect vulnerabilities.
- **Buyer Orders Persistence**: Buyer orders are synced with Zustand store upon user identity changes.
- **Database-Backed Wishlist**: `wishlist_items` table with CRUD operations, API endpoints, and store synchronization.
- **Dynamic Filtering**: Price slider and category attribute filters dynamically appear based on product data.
- **Payment System**: Updates include `payment_reference`, `payment_provider`, `paid_at`, and `currency` columns in orders table, with webhook integration.
- **Messaging System**: Database schema for conversations and messages, DAL with role-based authorization, and REST API endpoints.
- **In-App Notifications**: Database table `notifications` with append-only design, DAL, and API.
- **Email Infrastructure**: Database table `email_templates`, DAL for provider config and templates, and Admin API for management. Supports dry-run, rich text editor, and variable compilation. Order event emails: confirmation, payment received, shipped, delivered, cancelled (to buyers); new order notifications (to vendors).
- **Password Reset Flow**: End-to-end password reset with secure tokens, expiry, and strength validation.
- **Analytics Event Tracking**: Non-blocking, fire-and-forget analytics for user interactions, ready for external integration.
- **Site Content Management System**: Database-backed admin control over branding, promotional banners, hero slideshow, footer links, homepage sections, and static pages with full CRUD.
- **PWA Support**: Progressive Web App features implemented using `next-pwa` for installability, including web app manifest and service worker for static asset caching.
- **Commission System**: Automated commission calculation with 3-tier priority (vendor, category, default). Stored at order and order_item level. Admin UI for management and vendor dashboard for earnings.
- **Vendor Payouts System**: Database-backed system using Paystack Transfers API. Manages vendor bank accounts, payout requests, and balance calculation. Vendor/Admin UIs for withdrawals and history. Webhook handlers for payout status.
- **Dispute Resolution + Refunds System**: Full dispute lifecycle with DAL (disputes table with refund tracking), Admin/Buyer APIs, Paystack refund integration, commission reversal logic, and notification triggers. Supports dispute creation within 48-hour window, investigation workflow, resolution types (full/partial refund, replacement, no action), and async refund status tracking via webhooks.
- **Vendor Profile Management**: Separate "My Profile" page (`/vendor/profile`) for account-level settings distinct from Store Settings. Supports login email change (with validation, uniqueness check, lowercase normalization) and password change. Foundation laid for email verification flow (pendingEmail, emailVerificationToken fields in DAL).
- **Admin Dashboard Analytics**: Comprehensive platform metrics with date range filtering (7d/30d/90d/1y/all) and time bucketing (day/week/month). Tracks revenue, orders, users, products, vendors, fulfillment rates, commissions, and payouts. Includes trend charts (recharts), pie charts for status distributions, and top vendor leaderboard.

## External Dependencies
- **Paystack**: Payment gateway for Mobile Money transactions and vendor payouts.
- **PostgreSQL**: Primary relational database.
- **Supabase Storage**: Cloud image hosting, with fallback to local Base64 storage.
- **Google OAuth**: OAuth 2.0 integration for user authentication.
- **Google Maps Places API**: Location services for address autocompletion and geocoding.
- **Smile Identity KYC Integration**: SDK and webhook for biometric and ID verification.
- **Arkesel SMS Notifications**: Transactional SMS for order events, template management, and delivery tracking.

## Development Roadmap

### Tier 1: Launch-Blocking Features (COMPLETED ✅)

| Feature | Status | Description |
|---------|--------|-------------|
| Vendor Payouts - Database Schema | ✅ Complete | `vendor_bank_accounts` and `vendor_payouts` tables with full constraints |
| Vendor Payouts - DAL | ✅ Complete | Data access layer with balance calculation, CRUD operations |
| Vendor Payouts - Bank Account Management | ✅ Complete | Add/verify bank accounts and mobile money with Paystack |
| Vendor Payouts - Mobile Money Support | ✅ Complete | MTN, Vodafone/Telecel, AirtelTigo with uppercase provider codes |
| Vendor Payouts - Withdrawal Flow | ✅ Complete | Request payouts from available balance |
| Vendor Payouts - Admin Management | ✅ Complete | Admin UI to approve/reject/process payouts |
| Vendor Payouts - Paystack Integration | ✅ Complete | Transfer recipients and transfers via Paystack API (demo mode) |
| Vendor Payouts - Webhook Handlers | ✅ Complete | Handle `transfer.success`, `transfer.failed`, `transfer.reversed` events |
| Commission System | ✅ Complete | 3-tier priority (vendor, category, default), stored at order level |
| Dispute Resolution - Database Schema | ✅ Complete | `disputes` table with refund tracking columns (refund_status, refund_amount, resolution_type) |
| Dispute Resolution - DAL | ✅ Complete | Full CRUD operations, message threading, statistics aggregation |
| Dispute Resolution - Admin API | ✅ Complete | List, view, update status, resolve disputes with resolution types |
| Dispute Resolution - Buyer API | ✅ Complete | Create disputes (48h window), view own disputes and status |
| Dispute Resolution - Refund Execution | ✅ Complete | Paystack refund integration with async status, commission reversal, validation guards |
| Dispute Resolution - Admin UI | ✅ Complete | Dashboard with stats, list view, detail dialogs, status updates, refund processing |
| Dispute Resolution - Buyer UI | ✅ Complete | View disputes, status tracking, resolution details, refund status |
| Dispute Resolution - Vendor UI | ✅ Complete | View disputes against orders, evidence photos, status tracking |
| Dispute Resolution - Evidence Upload | ✅ Complete | Photo evidence upload (up to 5 images) via Supabase Storage |
| Dispute Resolution - Notifications | ✅ Complete | Event notifications for resolution, refund initiation, refund completion |

### Tier 2: First Month Post-Launch

| Feature | Est. Days | Status | Notes |
|---------|-----------|--------|-------|
| Email Notifications (Order events) | 3-4 | ✅ Complete | Order confirmation, payment received, shipped, delivered, cancelled emails to buyers; new order emails to vendors |
| Low Stock Alerts (Email/SMS) | 1-2 | ✅ Complete | Integrated into order processing, configurable threshold in vendor settings |
| Admin Dashboard Analytics | 4-5 | ✅ Complete | Revenue, users, products, vendors, orders, financials with charts and date range filtering |
| Export Functionality (CSV) | 2-3 | ✅ Complete | Vendor products/orders, admin orders/payouts with formatted exports |
| Social Sharing (WhatsApp focus) | 1-2 | ✅ Complete | Product pages, order confirmation, vendor store pages |
| Recently Viewed Products | 2-3 | ✅ Complete | localStorage-backed tracking, displayed on product pages |
| Real Vendor Analytics | 3-4 | ✅ Complete | Sales trends, product performance, order metrics, rating distribution with charts |
| **Subtotal** | **~16-23** | | |

### Tier 2: Security Enhancements

| Feature | Status | Description |
|---------|--------|-------------|
| Verified Phone Requirement | ✅ Complete | Backend check requiring phone_verified=true before adding payout accounts, frontend warning banner |
| OTP Security for Payout Accounts | ✅ Complete | OTP verification via SMS before adding payout accounts, 15-minute token expiry, single-use tokens |
| OTP Security for Phone Changes | ✅ Complete | OTP required via current phone before changing profile phone number, 10-minute token expiry, single-use tokens, phone_verified reset after change |
| bcrypt Password Hashing | ✅ Complete | Migrated from SHA-256 to bcrypt (10 rounds), backward-compatible verification |
| Database-Backed Rate Limiting | ✅ Complete | Atomic UPSERT operations, fail-closed error handling, configurable limits per action |
| CSRF Protection | ✅ Complete | Double Submit Cookie pattern, middleware validation, protected: payouts, admin, password change |
| XSS Prevention | ✅ Complete | DOMPurify sanitization for HTML content |
| Paystack Webhook Security | ✅ Complete | Secret enforcement in production |
| Email Fallback for OTP | ⏳ Pending | Allow email OTP as fallback when SMS delivery fails |
| Payout Analytics Dashboard | ⏳ Pending | Visual reports for payout trends, vendor earnings over time |
| Bulk Payout Processing | ⏳ Pending | Admin ability to approve/process multiple payouts at once |
| Scheduled Payouts | ⏳ Pending | Automatic weekly/monthly payout processing |
| Payout Export (CSV/PDF) | ⏳ Pending | Export payout history for accounting purposes |

### Tier 3: Future Considerations

| Feature | Status | Description |
|---------|--------|-------------|
| Multi-Currency Support | ⏳ Pending | Support for USD alongside GHS |
| International Transfers | ⏳ Pending | Cross-border payout support |
| Vendor Payout Preferences | ⏳ Pending | Minimum payout threshold, preferred schedule |
| Advanced Fraud Detection | ⏳ Pending | ML-based detection of suspicious payout patterns |