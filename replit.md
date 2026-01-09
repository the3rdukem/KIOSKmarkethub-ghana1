# Sabi Market V3

## Overview
MarketHub is a secure marketplace platform for Ghana, designed to connect buyers with verified vendors. It features Mobile Money payments, robust buyer protection, and a comprehensive admin verification system. The platform aims to provide a reliable and safe e-commerce experience, leveraging modern web technologies for scalability and performance.

## User Preferences
I want iterative development.
I want to be asked before you make any major changes.
I prefer detailed explanations for complex solutions.
Do not make changes to files in the `src/lib/` directory unless explicitly instructed.
I prefer clear and concise communication.

## System Architecture
The platform is built with Next.js 15, Tailwind CSS for styling, and `shadcn/ui` for UI components, ensuring a modern and responsive user experience. PostgreSQL is used as the primary database, managed by Replit, with a focus on connection pooling and async data access.

**Key Technical Implementations:**
- **Database**: PostgreSQL with a dedicated Data Access Layer (DAL) using `pg` for connection pooling and async operations. Schema includes proper constraints (UNIQUE, NOT NULL, CHECK, FOREIGN KEY).
- **Authentication**: Server-authoritative session management via a single `session_token` httpOnly cookie. Strong password validation (8+ chars, 1 uppercase, 1 lowercase, 1 number). Email uniqueness allows same email for buyer+vendor accounts, but admin emails are globally unique. Login provides differentiated error codes for debugging while maintaining secure user-facing messages.
- **Input Validation**: Comprehensive server-side validation across all API endpoints with structured error responses including code, message, details, and validationErrors array. Client-side password strength indicator on registration form provides real-time feedback.
- **Governance System**: Comprehensive system for vendor and product management, including vendor verification, product gating, category management with dynamic form schema, and detailed audit logging for critical administrative actions.
- **Cart System**: Secure cart ownership model with guest and user carts, including guest-to-user cart merging on authentication and persistence for user carts.
- **Reviews System**: Full-fledged database-backed review system allowing buyers to rate products, vendors to reply, and administrators to moderate content.
- **Promotions System**: Database-backed coupons and sales management. Vendors create/manage their own promotions via `/vendor/promotions`. Admins view all promotions read-only at `/admin/promotions`. Coupons are validated at checkout with vendor scoping enforcement (coupons only apply to vendor's products in cart using `eligibleSubtotal`). Sales support multiple products via `sale_products` join table with discount type (percentage/fixed) and date ranges. Active sales are displayed across all product views (homepage, search, product detail) with animated discount badges and struck-through original prices. Products API returns `effectivePrice` computed from active sales and `activeSale` metadata. Cart uses effective prices when adding products with active sales.
- **API-First Approach**: All major data interactions, including product listings, search, vendor analytics, and administrative functions, are handled via dedicated API endpoints, moving away from client-side state management for data consistency.
- **UI/UX**: Utilizes `shadcn/ui` for consistent and accessible components. The platform is designed to be intuitive for buyers, vendors, and administrators, with distinct dashboards for each user type.

## External Dependencies
- **Paystack**: For Mobile Money payment processing.
- **PostgreSQL**: Managed database service.
- **Image Storage**: Provider-agnostic storage abstraction for handling image uploads (currently local filesystem with cloud migration path).