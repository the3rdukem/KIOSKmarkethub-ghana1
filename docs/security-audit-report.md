# KIOSK Comprehensive Security & Code Audit Report

## Executive Summary
KIOSK is a well-architected multi-vendor marketplace with strong security foundations. However, this deep audit reveals several critical gaps, security concerns, incomplete implementations, and redundancies that should be addressed before scaling in the Ghanaian market.

---

## 🔴 CRITICAL SECURITY ISSUES

### 1. **Password Hashing Uses SHA-256 Instead of bcrypt/Argon2**
- **Location**: `src/lib/db/dal/users.ts`, `src/lib/db/dal/auth-service.ts`, `src/lib/db/dal/admin.ts`
- **Issue**: SHA-256 with salt is used for password hashing (`createHash('sha256').update(password + salt)`). This is cryptographically weak for password storage.
- **Risk**: HIGH - SHA-256 is fast and susceptible to GPU-based brute-force attacks. Industry standard requires bcrypt, Argon2, or scrypt.
- **Recommendation**: Migrate to bcrypt with cost factor 12+ or Argon2id. Implement gradual migration during user login.
- **Status**: ✅ FIXED (2026-01-31)
  - Created centralized crypto utility: `src/lib/utils/crypto.ts`
  - bcrypt with cost factor 12 now used for all new passwords
  - Automatic migration of legacy SHA-256 passwords on login
  - Consolidated duplicate password hashing across all files

### 2. **No CSRF Protection**
- **Location**: Entire API layer
- **Issue**: No CSRF tokens or `SameSite=strict` cookie enforcement found. Current cookies use `sameSite: 'lax'`.
- **Risk**: MEDIUM-HIGH - State-changing operations via POST could be exploited by malicious sites.
- **Recommendation**: Implement CSRF tokens for all state-changing operations or upgrade to `SameSite=strict` where applicable.
- **Status**: ⏳ Pending

### 3. **Webhook Secret Verification is Optional**
- **Location**: `src/app/api/webhooks/paystack/route.ts` (lines 73-78)
- **Issue**: Paystack webhook signature verification is conditional: `if (credentials.webhookSecret) { ... }`. Without a secret, webhooks are accepted without verification.
- **Risk**: HIGH - Attackers could forge payment success webhooks, marking unpaid orders as paid.
- **Recommendation**: REQUIRE webhook secret and reject all webhooks without valid signatures.
- **Status**: ✅ FIXED (2026-01-31)
  - Webhook secret is now REQUIRED
  - Returns 503 if webhook secret not configured
  - All webhooks must pass signature verification

### 4. **OTP Pepper Environment Variable Warning Only in Development**
- **Location**: `src/app/api/vendor/payouts/otp/route.ts`, `src/app/api/vendor/profile/phone-change/otp/route.ts`, `src/lib/db/dal/phone-auth.ts`
- **Issue**: When `OTP_SECRET_PEPPER` is missing in production, code only logs a warning but continues with a weak fallback.
- **Risk**: HIGH - OTP hashing without proper pepper could be vulnerable to rainbow table attacks.
- **Recommendation**: Fail hard if `OTP_SECRET_PEPPER` is not set in production.
- **Status**: ✅ ALREADY FIXED (verified 2026-01-31)
  - All OTP files already throw errors in production if pepper not set
  - Centralized crypto utility (`src/lib/utils/crypto.ts`) also enforces this

### 5. **dangerouslySetInnerHTML Without Sanitization**
- **Location**: `src/app/pages/[slug]/page.tsx` (line 83), `src/components/admin/email-template-editor.tsx` (line 340)
- **Issue**: HTML content from database rendered directly without sanitization.
- **Risk**: HIGH - Stored XSS attacks possible if admin accounts are compromised or content injection occurs.
- **Recommendation**: Implement DOMPurify or similar sanitization library before rendering.
- **Status**: ✅ FIXED (2026-01-31)
  - Created sanitization utility: `src/lib/utils/sanitize.ts`
  - Installed isomorphic-dompurify for server-side compatible sanitization
  - Both files now use sanitizeHTML/sanitizeEmailHTML before rendering

---

## 🟠 MODERATE SECURITY CONCERNS

### 6. **Rate Limiting is In-Memory Only**
- **Location**: `src/lib/services/arkesel-otp.ts` (line 60), `src/app/api/messaging/conversations/[id]/messages/route.ts` (line 21)
- **Issue**: Rate limiting uses `Map<string, ...>` which is lost on server restart and doesn't work across multiple instances.
- **Risk**: MEDIUM - Attackers could bypass rate limits by timing requests around restarts or across load-balanced instances.
- **Recommendation**: Use Redis or database-backed rate limiting for production deployments.
- **Status**: ✅ FIXED (2026-01-31)
  - Created `rate_limits` database table (PHASE 18)
  - Created DAL: `src/lib/db/dal/rate-limits.ts` with configurable limits
  - Created utility: `src/lib/utils/rate-limiter.ts` for easy endpoint integration
  - Applied to: login, admin login, OTP send/verify, password reset, messaging
  - Updated arkesel-otp.ts to use database-backed rate limiting
  - Rate limits now persist across restarts and work in multi-instance deployments

### 7. **Session Token Exposed in Logs During Debug Mode**
- **Location**: `src/lib/db/dal/sessions.ts` (lines 26-29, 57-60)
- **Issue**: Debug mode logs token hash prefixes. While not the full token, this could aid attacks.
- **Recommendation**: Remove session token logging even in debug mode, or ensure debug mode is never enabled in production.
- **Status**: ⏳ Pending

### 8. **Master Admin Default Password**
- **Location**: `src/lib/db/dal/admin.ts` (line 87)
- **Issue**: Default master admin password `123asdqweX$` is hardcoded as fallback when `MASTER_ADMIN_PASSWORD` env var is not set.
- **Risk**: MEDIUM - If env var is forgotten, weak default password could be used.
- **Recommendation**: Require `MASTER_ADMIN_PASSWORD` to be set; fail initialization if missing.
- **Status**: ✅ FIXED (2026-01-31)
  - Added production check in `src/lib/db/index.ts` 
  - Fails hard if `MASTER_ADMIN_PASSWORD` not set in production
  - Shows warning in development mode

### 9. **No CORS Headers Configuration**
- **Location**: Entire API
- **Issue**: No explicit CORS configuration found. Next.js defaults may not be sufficient for production.
- **Recommendation**: Explicitly configure CORS in `next.config.js` or middleware for API routes.
- **Status**: ⏳ Pending

---

## 🟡 CODE QUALITY & REDUNDANCY ISSUES

### 10. **DUPLICATE: Two Google OAuth Callback Endpoints**
- **Locations**: 
  - `src/app/api/auth/google/callback/route.ts` (152 lines)
  - `src/app/api/auth/callback/google/route.ts` (148 lines) **DELETED**
- **Issue**: Nearly identical files (same content, same functionality). This is a maintenance nightmare and security risk if one is updated and the other isn't.
- **Recommendation**: Delete one endpoint and update OAuth configuration to use a single callback URL.
- **Status**: ✅ FIXED (2026-01-31)
  - Removed duplicate: `src/app/api/auth/callback/google/route.ts`
  - Single callback endpoint remains at `/api/auth/google/callback`

### 11. **Duplicate Password Hashing Functions**
- **Locations**: 
  - `src/lib/db/dal/users.ts` (hashPassword, verifyPassword)
  - `src/lib/db/dal/auth-service.ts` (hashPassword, verifyPassword)
  - `src/lib/db/index.ts` (inline hash creation)
- **Issue**: Same password hashing logic duplicated across 3 files.
- **Recommendation**: Consolidate into single crypto utility module.
- **Status**: ✅ FIXED (2026-01-31)
  - Created centralized `src/lib/utils/crypto.ts` module
  - All files now import from this single source
  - users.ts and auth-service.ts re-export for backward compatibility

### 12. **Duplicate OTP Hashing Functions**
- **Locations**:
  - `src/app/api/vendor/payouts/otp/route.ts`
  - `src/app/api/vendor/payouts/otp/verify/route.ts`
  - `src/app/api/vendor/profile/phone-change/otp/route.ts`
  - `src/app/api/vendor/profile/phone-change/otp/verify/route.ts`
  - `src/lib/db/dal/phone-auth.ts`
- **Issue**: `hashOTP()` function is duplicated across 5+ files.
- **Recommendation**: Create shared OTP utility module.
- **Status**: ⏳ Pending

### 13. **Very Large Files**
- **Files exceeding 1000 lines**:
  - `src/app/admin/page.tsx` (2,423 lines)
  - `src/lib/db/index.ts` (2,162 lines)
  - `src/components/admin/product-management.tsx` (1,590 lines)
  - `src/lib/db/dal/orders.ts` (1,495 lines)
  - `src/lib/db/dal/auth-service.ts` (1,362 lines)
- **Recommendation**: Refactor into smaller, focused modules. Admin page should be split into components.
- **Status**: ⏳ Pending (Low priority - functional but maintainability concern)

---

## 🔵 INCOMPLETE IMPLEMENTATIONS

### 14. **Email Verification Flow Started But Not Finished**
- **Location**: `src/lib/db/dal/users.ts` (lines 73, 286-295), `src/app/api/users/[id]/route.ts` (line 297)
- **Evidence**: 
  - `pendingEmail` field exists in schema
  - `email_verification_token` and `email_verification_expires` fields exist
  - TODO comment: `// TODO: When verification is enabled, set pendingEmail instead of email`
- **Status**: Foundation laid but flow never completed.
- **Impact**: Users can change login email without verification, potential account takeover vector.
- **Status**: ⏳ Pending

### 15. **Commission Earnings Calculation Incomplete**
- **Location**: `src/lib/db/dal/commission.ts` (lines 400-401)
- **Evidence**: TODO comments:
  ```typescript
  pendingEarnings: totalEarnings, // TODO: Subtract paid payouts
  paidEarnings: 0 // TODO: Get from payouts table
  ```
- **Status**: Commission is tracked but paid/pending distinction not implemented.
- **Status**: ⏳ Pending

### 16. **Pending Features Per Roadmap**
From `replit.md`:
- Email Fallback for OTP (when SMS fails)
- Payout Analytics Dashboard
- Bulk Payout Processing
- Scheduled Payouts
- Multi-Currency Support (USD)
- Advanced Fraud Detection
- **Status**: ⏳ Pending (Roadmap items)

---

## 🟣 GHANA MARKET-SPECIFIC RECOMMENDATIONS

### 17. **Phone Number Validation is Solid** ✅
- Ghana phone format validation (`0XX XXX XXXX`, `+233 XX XXX XXXX`) is correctly implemented.
- E.164 normalization present.
- **Status**: ✅ Complete

### 18. **Mobile Money Integration Gaps**
- **Current**: Only Paystack Mobile Money is integrated.
- **Gap**: No direct MTN MoMo, Vodafone Cash, or AirtelTigo Money API integrations.
- **Recommendation**: For better UX in Ghana, consider adding direct operator APIs as fallbacks when Paystack is unavailable.
- **Status**: ⏳ Future consideration

### 19. **Ghana Post GPS (Digital Address) Support**
- **Current**: Digital address field exists in buyer profile (`e.g., GA-XXX-XXXX`).
- **Gap**: No validation of Ghana Post GPS format.
- **Recommendation**: Add regex validation for Ghana Post GPS format.
- **Status**: ⏳ Pending

### 20. **Currency Display Inconsistency**
- Found 182 references to GH₵/GHS/cedi across codebase.
- Some places use `GH₵`, others use `GHS`.
- **Recommendation**: Standardize on single format, preferably `GH₵` for display and `GHS` for API/storage.
- **Status**: ⏳ Low priority

### 21. **Offline-First Considerations**
- No Service Worker caching for offline access (PWA manifest exists but limited caching).
- Ghana's internet connectivity is inconsistent.
- **Recommendation**: Implement offline data caching for critical user flows.
- **Status**: ⏳ Future consideration

---

## 🟢 POSITIVE SECURITY FINDINGS

1. **Session Management** ✅ - Server-authoritative sessions with httpOnly cookies, proper token hashing.
2. **Input Validation** ✅ - Comprehensive validation library with content safety checks.
3. **SQL Injection Protection** ✅ - Parameterized queries used throughout (`$1`, `$2`, etc.).
4. **Open Redirect Protection** ✅ - `getSafeRedirectUrl()` properly validates redirects.
5. **Password Policy** ✅ - 8+ characters, uppercase, lowercase, number required.
6. **Audit Logging** ✅ - Comprehensive admin action logging.
7. **Transaction Safety** ✅ - `SELECT FOR UPDATE` used for inventory to prevent race conditions.
8. **Webhook Signature Verification** ✅ (when configured) - SHA-512 HMAC verification.

---

## 📊 SUMMARY TABLE

| Category | Critical | Moderate | Low |
|----------|----------|----------|-----|
| Security | 5 | 4 | 3 |
| Code Quality | 0 | 4 | 6 |
| Incomplete | 0 | 3 | 3 |
| **Total** | **5** | **11** | **12** |

---

## 🎯 PRIORITIZED ACTION ITEMS

### Immediate (Before Production Launch)
1. ✅ Migrate password hashing to bcrypt/Argon2 (DONE)
2. ✅ Require Paystack webhook secret (fail if not configured) (DONE)
3. ✅ Implement DOMPurify for HTML sanitization (DONE)
4. ✅ Remove duplicate Google OAuth callback endpoint (DONE)
5. ✅ Set `OTP_SECRET_PEPPER` as required in production (ALREADY DONE)

### Short-term (First Month)
6. ✅ Implement database-backed rate limiting (DONE - 2026-01-31)
7. ✅ Add CSRF protection (DONE - 2026-01-31)
   - Double Submit Cookie pattern implemented
   - Middleware-based validation for state-changing requests (POST/PUT/DELETE/PATCH)
   - CSRF token generated on login/registration and stored in non-httpOnly cookie
   - Frontend utilities: `getCsrfHeaders()` from `@/lib/utils/csrf-client`
   - **Currently Protected Endpoints**:
     - `/api/auth/change-password`
     - `/api/vendor/payouts/*` (payout requests, OTP)
     - `/api/vendor/bank-accounts/*` (add/delete accounts)
     - `/api/vendor/profile/*`
     - `/api/admin/*` (all admin operations)
     - `/api/buyer/disputes/*`
   - **Exempt Endpoints** (public, authentication, or lower-risk):
     - All authentication flows (login, register, OTP, password reset)
     - Webhooks (Paystack)
     - Cart, wishlist, reviews, messaging, notifications, orders
   - **Note**: Full rollout requires updating additional frontend components
8. ⏳ Complete email verification flow
9. ✅ Consolidate duplicate crypto functions (DONE - 2026-01-31)
10. ⏳ Refactor large files

### Medium-term (3 Months)
11. ⏳ Add direct Mobile Money operator APIs
12. ⏳ Implement offline-first PWA features
13. ⏳ Complete pending roadmap features
14. ⏳ Add Ghana Post GPS validation
15. ⏳ Standardize currency display

---

*Last Updated: January 31, 2026*
*Audit conducted without making any changes to the codebase. All findings are based on static code analysis and pattern matching.*
