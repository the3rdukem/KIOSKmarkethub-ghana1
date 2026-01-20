# Sabi Market V3

## Overview
MarketHub is a secure e-commerce platform for Ghana, connecting buyers with verified vendors. It supports Mobile Money payments, robust buyer protection, and an extensive admin verification system. The platform aims to deliver a reliable and safe online shopping experience, leveraging modern web technologies to enhance Ghana's e-commerce landscape. The business vision is to become the leading trusted online marketplace in Ghana, fostering economic growth for local businesses and ensuring consumer confidence through security and transparency.

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
- Admin UI includes fixed table layouts and consistent column widths.
- Enhanced search page UX with Radix Select for category filters, dynamic price sliders, and category attribute filters.

**Technical Implementations:**
- **Database**: PostgreSQL with a Data Access Layer (DAL) using `pg` for connection pooling. Schema enforces comprehensive constraints.
- **Authentication**: Server-authoritative session management via `session_token` httpOnly cookie, strong password validation, and globally unique admin emails. Google OAuth is integrated for buyer and vendor sign-in.
- **Input Validation**: Comprehensive server-side validation across all API endpoints with structured error responses, client-side feedback, and specific validations for email, phone formats, and content safety. Product forms use Zod schema and React Hook Form.
- **Governance System**: Manages vendor and product verification, product gating, category management with dynamic form schemas, and audit logging.
- **Product Contract Unification**: A canonical product data contract ensures consistent data shape and handles data conversions, integrating product conditions as category-specific attributes.
- **Admin Permissions**: Granular permissions, including master admin capabilities.
- **Cart System**: Secure ownership model supporting guest and authenticated users, with guest-to-user cart merging.
- **Reviews System**: Database-backed system for product reviews, vendor replies, and moderation.
- **Promotions System**: Database-backed coupons and sales management, allowing vendors to create promotions.
- **Order Pipeline**: Server-side order management with PostgreSQL, covering checkout flows (inventory decrement, audit logging), vendor fulfillment, and admin cancellation (inventory restoration). Includes real-time status updates and robust inventory reservation using atomic transactions.
- **Auth Redirect Security**: Utilizes `getSafeRedirectUrl()` to prevent open redirect vulnerabilities.
- **Buyer Orders Persistence**: Buyer orders are synced with the Zustand store upon user identity changes.
- **Database-Backed Wishlist**: `wishlist_items` table with CRUD operations, API endpoints, and a store that syncs with the database for authenticated users and uses `localStorage` for guests.
- **Dynamic Filtering**: Price slider initializes from actual product prices, and category attribute filters dynamically appear based on selected categories.
- **Payment System**: Updates include `payment_reference`, `payment_provider`, `paid_at`, and `currency` columns in orders table. Webhook integration handles payment status updates.
- **Messaging System**: Features a database schema for conversations and messages, DAL layer with role-based authorization, and REST API endpoints for full messaging functionality. Supports context types and conversation statuses.
- **In-App Notifications**: Database table `notifications` with user_id, role, type, title, message, payload, is_read fields. Append-only design with DAL and API for managing notifications.
- **Email Infrastructure**: Database table `email_templates`, DAL for provider config and templates, and Admin API endpoints for managing email settings and templates. Supports dry-run mode, rich text template editor with WYSIWYG editing and cursor-aware variable insertion, template resolution with variable extraction/validation/compilation, and graceful fallback to inline content when templates are missing or inactive. Kill-switch and dry-run checks execute before template resolution to prevent DB access when email is disabled.
- **Analytics Event Tracking**: Non-blocking, fire-and-forget analytics for tracking user interactions, ready for external provider integration.

## External Dependencies
- **Paystack**: Payment gateway for Mobile Money transactions.
- **PostgreSQL**: Managed relational database service.
- **Image Storage**: Provider-agnostic abstraction for image uploads, with a clear cloud migration path.
- **Google OAuth**: OAuth 2.0 integration for buyer and vendor sign-in.
- **Google Maps Places API**: Location services for address autocompletion, with client-side API key access and HTTP referrer restrictions.
- **Smile Identity KYC Integration**: Uses the `smile-identity-core` npm SDK for secure biometric and ID verification, with webhook integration for status updates.