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
- **Database**: PostgreSQL with a dedicated Data Access Layer (DAL) using `pg` for connection pooling and async operations.
- **Authentication**: Server-authoritative session management via a single `session_token` httpOnly cookie, centralizing authentication logic.
- **Governance System**: Comprehensive system for vendor and product management, including vendor verification, product gating, category management with dynamic form schema, and detailed audit logging for critical administrative actions.
- **Cart System**: Secure cart ownership model with guest and user carts, including guest-to-user cart merging on authentication and persistence for user carts.
- **Reviews System**: Full-fledged database-backed review system allowing buyers to rate products, vendors to reply, and administrators to moderate content.
- **API-First Approach**: All major data interactions, including product listings, search, vendor analytics, and administrative functions, are handled via dedicated API endpoints, moving away from client-side state management for data consistency.
- **UI/UX**: Utilizes `shadcn/ui` for consistent and accessible components. The platform is designed to be intuitive for buyers, vendors, and administrators, with distinct dashboards for each user type.

## External Dependencies
- **Paystack**: For Mobile Money payment processing.
- **PostgreSQL**: Managed database service.
- **Image Storage**: Provider-agnostic storage abstraction for handling image uploads (currently local filesystem with cloud migration path).