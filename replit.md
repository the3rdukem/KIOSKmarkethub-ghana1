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
- **Email Infrastructure**: Database table `email_templates`, DAL for provider config and templates, and Admin API for management. Supports dry-run, rich text editor, and variable compilation.
- **Password Reset Flow**: End-to-end password reset with secure tokens, expiry, and strength validation.
- **Analytics Event Tracking**: Non-blocking, fire-and-forget analytics for user interactions, ready for external integration.
- **Site Content Management System**: Database-backed admin control over branding, promotional banners, hero slideshow, footer links, homepage sections, and static pages with full CRUD.
- **PWA Support**: Progressive Web App features implemented using `next-pwa` for installability, including web app manifest and service worker for static asset caching.
- **Commission System**: Automated commission calculation with 3-tier priority (vendor, category, default). Stored at order and order_item level. Admin UI for management and vendor dashboard for earnings.
- **Vendor Payouts System**: Database-backed system using Paystack Transfers API. Manages vendor bank accounts, payout requests, and balance calculation. Vendor/Admin UIs for withdrawals and history. Webhook handlers for payout status.

## External Dependencies
- **Paystack**: Payment gateway for Mobile Money transactions and vendor payouts.
- **PostgreSQL**: Primary relational database.
- **Supabase Storage**: Cloud image hosting, with fallback to local Base64 storage.
- **Google OAuth**: OAuth 2.0 integration for user authentication.
- **Google Maps Places API**: Location services for address autocompletion and geocoding.
- **Smile Identity KYC Integration**: SDK and webhook for biometric and ID verification.
- **Arkesel SMS Notifications**: Transactional SMS for order events, template management, and delivery tracking.