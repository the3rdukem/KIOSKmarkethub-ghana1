# Sabi Market V3

## Overview
MarketHub is a secure marketplace platform for Ghana, designed to connect buyers with verified vendors. It features Mobile Money payments, robust buyer protection, and a comprehensive admin verification system. The platform aims to provide a reliable and safe e-commerce experience, leveraging modern web technologies for scalability and performance, enhancing Ghana's e-commerce landscape.

## User Preferences
I want iterative development.
I want to be asked before you make any major changes.
I prefer detailed explanations for complex solutions.
Do not make changes to files in the `src/lib/` directory unless explicitly instructed.
I prefer clear and concise communication.

## System Architecture
The platform is built with Next.js 15, Tailwind CSS for styling, and `shadcn/ui` for UI components, ensuring a modern and responsive user experience. PostgreSQL is used as the primary database, managed by Replit, with a focus on connection pooling and async data access. An API-first approach underpins all major data interactions.

**Key Technical Implementations:**
- **Database**: PostgreSQL with a dedicated Data Access Layer (DAL) using `pg` for connection pooling. Schema enforces constraints like UNIQUE, NOT NULL, CHECK, and FOREIGN KEY.
- **Authentication**: Server-authoritative session management via a single `session_token` httpOnly cookie. Strong password validation and differentiated error codes for secure debugging. Email uniqueness allows separate buyer/vendor accounts, but admin emails are globally unique.
- **Input Validation**: Comprehensive server-side validation across all API endpoints with structured error responses. Client-side feedback (e.g., password strength). Features like email garbage detection, content safety filtering, Ghana phone format validation, and field-specific error attribution are implemented. Product form validation uses Zod schema and React Hook Form. Dynamic category attributes are managed with a reconciliation effect and proper field registration. Admin forms utilize a sentinel pattern (`ADMIN_UNSET`) to prevent UI crashes with uninitialized Select fields.
- **Governance System**: Comprehensive system for vendor and product management, including verification, product gating, category management with dynamic form schema, and audit logging for administrative actions. This includes robust handling of Radix Select components to prevent crashes, and database sanitization for category data.
- **Product Contract Unification**: A canonical product data contract (`src/lib/contracts/product.contract.ts`) ensures consistent data shape and handles conversions between database (snake_case) and API (camelCase) formats. Product conditions are now category-specific attributes, managed within `categoryAttributes`.
- **Admin Permissions**: Granular permissions for admin accounts, including the ability for master admins to manage other admin accounts and restrict self-deletion.
- **Admin Product Editing**: Product editing is handled via an inline dialog that fetches fresh data and supports all fields, including dynamic category attributes.
- **Validation Relaxation**: Configurable validation rules for specific fields (e.g., `simpleOptionalTextField()` for color/brand) and improved regex patterns for social media handles. Description minimum length is relaxed for drafts.
- **Phone Uniqueness**: Enhanced phone number uniqueness checks in the DAL to account for various format variants (local and E.164) for legacy data consistency.
- **Cart System**: Secure cart ownership model supporting both guest and authenticated users, with guest-to-user cart merging upon login.
- **Reviews System**: A database-backed system for product reviews, vendor replies, and administrative moderation.
- **Promotions System**: Database-backed coupons and sales management, allowing vendors to create promotions and admins to oversee them. Sales impact product pricing, displayed with badges and `effectivePrice` calculations.
- **Order Pipeline**: Server-side order management via PostgreSQL, defining order schemas, checkout flows (inventory decrement, audit logging), vendor fulfillment processes (item-level), and admin cancellation (inventory restoration). UI pages exist for buyers, vendors, and admins to manage orders. The system prioritizes `orderItems` from the database table for operations requiring IDs, and includes normalization for legacy data. Order status transitions from `pending_payment` to `fulfilled` or `cancelled`. Order pages include polling for real-time status updates.
- **Auth Redirect Security**: Implemented `getSafeRedirectUrl()` utility to prevent open redirect vulnerabilities by validating redirect URLs to only allow same-origin relative paths.
- **Buyer Orders Persistence**: Ensures buyer orders are refetched and synced with the Zustand store upon user identity changes (login/logout) to maintain data consistency.
- **Admin UI Fixes**: Specific UI adjustments for Radix UI components in admin pages to ensure proper event handling, dialog functionality, and consistent column widths in tables.
- **Admin Table Actions (Jan 2026)**: 
  - **Admin Orders** (`src/app/admin/orders/page.tsx`): Fixed table using `table-fixed w-full` layout with explicit column widths to ensure Actions column with 3-dot dropdown is always visible.
  - **Admin Dashboard Orders** (`src/app/admin/page.tsx`): Updated Orders table on dashboard to match dedicated page with 7 columns (Order ID, Customer, Items, Total, Status, Date, Actions). Added 3-dot dropdown with View Details and Cancel Order options. Added "View All Orders" button and Quick Actions link to `/admin/orders`.
  - **Admin Management** (`src/app/admin/page.tsx`): 3-dot DropdownMenu now contains "Revoke Access", "Activate", and "Delete Admin" options with confirmation dialogs.
  - **Admin Delete API** (`src/app/api/admin/admins/[id]/route.ts`): Added DELETE method for permanently deleting admin accounts with master-admin-only authorization, self-deletion prevention, and audit logging.

## External Dependencies
- **Paystack**: Payment gateway for Mobile Money transactions.
- **PostgreSQL**: Managed relational database service.
- **Image Storage**: Provider-agnostic abstraction for image uploads, currently using local filesystem with a cloud migration path.