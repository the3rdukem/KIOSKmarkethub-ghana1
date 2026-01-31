/**
 * Unified Auth Service - SINGLE CANONICAL AUTHENTICATION
 *
 * ALL authentication operations go through this service.
 * ALL user creation goes through createUser().
 * ALL login attempts check ALL user sources.
 *
 * RULES:
 * 1. ONE password hashing strategy (bcrypt with cost factor 12)
 * 2. ONE session creation mechanism
 * 3. ONE user creation pipeline
 * 4. Login is ROLE-AGNOSTIC - role determines redirect, not auth method
 * 5. Automatic migration of legacy SHA-256 passwords to bcrypt on login
 */

import { query, runTransaction } from '../index';
import { v4 as uuidv4 } from 'uuid';
import { randomBytes } from 'crypto';
import { getPhoneVariants } from './users';
import {
  hashPassword,
  hashPasswordSync,
  verifyPassword,
  verifyPasswordSync,
  needsHashMigration,
  generateSecureToken,
  hashToken,
} from '@/lib/utils/crypto';

// ============================================
// TYPES
// ============================================

export type UserRole = 'buyer' | 'vendor' | 'admin' | 'master_admin';
export type UserStatus = 'active' | 'suspended' | 'pending' | 'banned' | 'deleted';
export type VerificationStatus = 'pending' | 'under_review' | 'verified' | 'rejected' | 'suspended';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  phone: string | null;
  location: string | null;
  businessName: string | null;
  businessType: string | null;
  verificationStatus: VerificationStatus | null;
  avatar: string | null;
  storeDescription: string | null;
  storeBanner: string | null;
  storeLogo: string | null;
  createdAt: string;
  // Admin-specific fields (populated when role is admin/master_admin)
  adminRole?: 'ADMIN' | 'MASTER_ADMIN';
  permissions?: string[];
}

export interface AuthSession {
  id: string;
  userId: string;
  userRole: UserRole;
  token: string;
  expiresAt: string;
}

export interface AuthResult<T> {
  success: boolean;
  data?: T;
  error?: AuthError;
}

export interface AuthError {
  code: AuthErrorCode;
  message: string;
  details?: string;
}

export type AuthErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'USER_NOT_FOUND'
  | 'USER_SUSPENDED'
  | 'USER_BANNED'
  | 'USER_DELETED'
  | 'EMAIL_EXISTS'
  | 'ROLE_ASSIGNMENT_FAILED'
  | 'SESSION_CREATION_FAILED'
  | 'VERIFICATION_STATE_MISSING'
  | 'PASSWORD_HASH_FAILED'
  | 'TRANSACTION_FAILED'
  | 'INVALID_INPUT'
  | 'ADMIN_NOT_FOUND'
  | 'ADMIN_DISABLED';

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ============================================
// PASSWORD VALIDATION
// ============================================

export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
}

export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = [];
  
  if (!password || password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
}

// ============================================
// PASSWORD HASHING - NOW USES BCRYPT (via crypto utility)
// ============================================
// hashPassword, verifyPassword, hashToken imported from @/lib/utils/crypto
// Re-export for backward compatibility with existing code
export { hashPassword, hashPasswordSync, verifyPassword, verifyPasswordSync } from '@/lib/utils/crypto';

function generateSessionToken(): string {
  return generateSecureToken(32);
}

// ============================================
// SINGLE CANONICAL USER CREATION
// ============================================

export interface CreateUserInput {
  email: string;
  password: string;
  name: string;
  role: UserRole;
  phone?: string;
  location?: string;
  businessName?: string;
  businessType?: string;
  // Admin-specific
  permissions?: string[];
  createdBy?: string;
}

/**
 * CANONICAL USER CREATION FUNCTION
 *
 * ALL user creation MUST go through this function:
 * - Buyer registration
 * - Vendor registration
 * - Admin-created users
 * - Admin/Master admin accounts
 *
 * This ensures:
 * - Same password hashing
 * - Same role assignment
 * - Same verification state initialization
 * - Same database table (users)
 */
export async function createUser(
  input: CreateUserInput,
  options?: { ipAddress?: string; userAgent?: string; createSession?: boolean }
): Promise<AuthResult<{ user: AuthUser; session?: AuthSession }>> {
  console.log('[AUTH_SERVICE:CREATE_USER] Starting canonical user creation', {
    email: input.email,
    role: input.role,
  });

  // Validate input
  if (!input.email || !input.password || !input.name || !input.role) {
    return {
      success: false,
      error: { code: 'INVALID_INPUT', message: 'Email, password, name, and role are required' },
    };
  }
  
  // Validate email format (RFC-compliant check)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(input.email)) {
    return { success: false, error: { code: 'INVALID_INPUT', message: 'Invalid email format' } };
  }
  
  // Strong password validation (8+ chars, 1 uppercase, 1 lowercase, 1 number)
  const passwordValidation = validatePassword(input.password);
  if (!passwordValidation.isValid) {
    return {
      success: false,
      error: { 
        code: 'INVALID_INPUT', 
        message: passwordValidation.errors[0],
        details: passwordValidation.errors.join('; ')
      },
    };
  }
  
  if (!['buyer', 'vendor', 'admin', 'master_admin'].includes(input.role)) {
    return {
      success: false,
      error: { code: 'INVALID_INPUT', message: 'Invalid role' },
    };
  }
  if (input.role === 'vendor' && !input.businessName) {
    return {
      success: false,
      error: { code: 'INVALID_INPUT', message: 'Business name is required for vendor accounts' },
    };
  }

  try {
    const result = await runTransaction(async (client) => {
      const now = new Date().toISOString();
      const normalizedEmail = input.email.toLowerCase().trim();

      // Check email uniqueness with role-specific logic
      // RULE: Same email allowed for buyer + vendor, but NOT for same role twice
      // Admin emails must be globally unique
      
      // Check admin_users table first (admin emails must be globally unique)
      const existingAdminResult = await client.query(
        'SELECT id FROM admin_users WHERE LOWER(email) = LOWER($1)',
        [normalizedEmail]
      );
      if (existingAdminResult.rows[0]) {
        throw { code: 'EMAIL_EXISTS' as AuthErrorCode, message: 'This email is already registered as an admin' };
      }
      
      // If registering as admin, check that email doesn't exist anywhere
      if (input.role === 'admin' || input.role === 'master_admin') {
        const existingUserResult = await client.query(
          'SELECT id, role FROM users WHERE LOWER(email) = LOWER($1)',
          [normalizedEmail]
        );
        if (existingUserResult.rows[0]) {
          throw { code: 'EMAIL_EXISTS' as AuthErrorCode, message: 'This email is already registered' };
        }
      } else {
        // For buyer/vendor: check if email exists with the SAME role
        const existingUserResult = await client.query(
          'SELECT id, role FROM users WHERE LOWER(email) = LOWER($1) AND is_deleted = 0',
          [normalizedEmail]
        );
        
        if (existingUserResult.rows.length > 0) {
          // Build a set of existing roles for this email
          const existingRoles = new Set(existingUserResult.rows.map(row => row.role));
          
          // Check for admin/master_admin in users table - globally unique
          if (existingRoles.has('admin') || existingRoles.has('master_admin')) {
            throw { 
              code: 'EMAIL_EXISTS' as AuthErrorCode, 
              message: 'This email is already registered as an admin' 
            };
          }
          
          // Check for duplicate role - can't have two accounts with same role
          if (existingRoles.has(input.role)) {
            const roleLabel = input.role === 'buyer' ? 'buyer' : 'vendor';
            throw { 
              code: 'EMAIL_EXISTS' as AuthErrorCode, 
              message: `This email is already registered as a ${roleLabel}` 
            };
          }
          
          // If existing has both buyer AND vendor already, reject
          if (existingRoles.has('buyer') && existingRoles.has('vendor')) {
            throw { 
              code: 'EMAIL_EXISTS' as AuthErrorCode, 
              message: 'This email already has both buyer and vendor accounts' 
            };
          }
        }
      }

      // Hash password using bcrypt (industry standard)
      const passwordHash = await hashPassword(input.password);

      // Create user with role
      const userId = `user_${uuidv4().replace(/-/g, '').substring(0, 16)}`;

      // Determine status based on role
      let status: UserStatus;
      if (input.role === 'vendor') {
        status = 'pending'; // Vendors start pending until verified
      } else {
        status = 'active'; // Buyers, admins are active immediately
      }

      // Determine verification status
      const verificationStatus: VerificationStatus | null = input.role === 'vendor' ? 'pending' : null;

      const insertResult = await client.query(
        `INSERT INTO users (
          id, email, password_hash, name, role, status,
          phone, location, business_name, business_type,
          verification_status, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          userId,
          input.email.toLowerCase(),
          passwordHash,
          input.name,
          input.role,
          status,
          input.phone || null,
          input.location || null,
          input.businessName || null,
          input.businessType || null,
          verificationStatus,
          now,
          now
        ]
      );

      if ((insertResult.rowCount ?? 0) === 0) {
        throw { code: 'ROLE_ASSIGNMENT_FAILED' as AuthErrorCode, message: 'Failed to create user' };
      }

      // Verify user was created
      const createdUserResult = await client.query('SELECT * FROM users WHERE id = $1', [userId]);
      const createdUser = createdUserResult.rows[0] as Record<string, unknown>;
      if (!createdUser || !createdUser.role) {
        throw { code: 'ROLE_ASSIGNMENT_FAILED' as AuthErrorCode, message: 'User creation verification failed' };
      }

      // Verify vendor verification state
      if (input.role === 'vendor' && !createdUser.verification_status) {
        throw {
          code: 'VERIFICATION_STATE_MISSING' as AuthErrorCode,
          message: 'Vendor verification state was not initialized',
        };
      }

      // Create vendor entity if vendor role
      if (input.role === 'vendor') {
        const vendorId = `vendor_${uuidv4().replace(/-/g, '').substring(0, 16)}`;
        const vendorInsertResult = await client.query(
          `INSERT INTO vendors (
            id, user_id, business_name, business_type, phone, email,
            verification_status, store_status, created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, 'pending', 'inactive', $7, $8)`,
          [
            vendorId,
            userId,
            input.businessName || input.name,
            input.businessType || null,
            input.phone || null,
            input.email.toLowerCase(),
            now,
            now
          ]
        );

        if ((vendorInsertResult.rowCount ?? 0) === 0) {
          throw { code: 'ROLE_ASSIGNMENT_FAILED' as AuthErrorCode, message: 'Failed to create vendor entity' };
        }

        console.log('[AUTH_SERVICE:CREATE_USER] Vendor entity created', { vendorId, userId });
      }

      // Build user object
      const user: AuthUser = {
        id: createdUser.id as string,
        email: createdUser.email as string,
        name: createdUser.name as string,
        role: createdUser.role as UserRole,
        status: createdUser.status as UserStatus,
        phone: createdUser.phone as string | null,
        location: createdUser.location as string | null,
        businessName: createdUser.business_name as string | null,
        businessType: createdUser.business_type as string | null,
        verificationStatus: createdUser.verification_status as VerificationStatus | null,
        avatar: createdUser.avatar as string | null,
        storeDescription: createdUser.store_description as string | null,
        storeBanner: createdUser.store_banner as string | null,
        storeLogo: createdUser.store_logo as string | null,
        createdAt: createdUser.created_at as string,
      };

      // Add admin-specific fields if admin role
      if (input.role === 'admin' || input.role === 'master_admin') {
        user.adminRole = input.role === 'master_admin' ? 'MASTER_ADMIN' : 'ADMIN';
        user.permissions = input.permissions || getDefaultPermissions(input.role);
      }

      // Create session if requested
      let session: AuthSession | undefined;
      if (options?.createSession !== false) {
        const sessionId = `sess_${uuidv4().replace(/-/g, '').substring(0, 24)}`;
        const token = generateSessionToken();
        const tokenHash = hashToken(token);
        const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();

        const sessionResult = await client.query(
          `INSERT INTO sessions (id, user_id, user_role, token_hash, ip_address, user_agent, expires_at, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            sessionId,
            userId,
            createdUser.role,
            tokenHash,
            options?.ipAddress || null,
            options?.userAgent || null,
            expiresAt,
            now
          ]
        );

        if ((sessionResult.rowCount ?? 0) === 0) {
          throw { code: 'SESSION_CREATION_FAILED' as AuthErrorCode, message: 'Failed to create session' };
        }

        session = {
          id: sessionId,
          userId,
          userRole: createdUser.role as UserRole,
          token,
          expiresAt,
        };
      }

      console.log('[AUTH_SERVICE:CREATE_USER] Success', { userId, role: createdUser.role });

      return { user, session };
    });

    return { success: true, data: result };
  } catch (error: unknown) {
    console.error('[AUTH_SERVICE:CREATE_USER] Error:', error);
    if (typeof error === 'object' && error !== null && 'code' in error && 'message' in error) {
      return { success: false, error: error as AuthError };
    }
    return {
      success: false,
      error: {
        code: 'TRANSACTION_FAILED',
        message: 'User creation failed',
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

function getDefaultPermissions(role: UserRole): string[] {
  if (role === 'master_admin') {
    return [
      'FULL_SYSTEM_ACCESS',
      'MANAGE_API_KEYS',
      'MANAGE_ADMINS',
      'MANAGE_VENDORS',
      'MANAGE_USERS',
      'MANAGE_PRODUCTS',
      'MANAGE_ORDERS',
      'MANAGE_DISPUTES',
      'VIEW_AUDIT_LOGS',
      'MANAGE_SYSTEM_SETTINGS',
      'VIEW_ANALYTICS',
      'MANAGE_SECURITY',
    ];
  }
  if (role === 'admin') {
    return [
      'MANAGE_VENDORS',
      'MANAGE_USERS',
      'MANAGE_PRODUCTS',
      'MANAGE_ORDERS',
      'MANAGE_DISPUTES',
      'VIEW_AUDIT_LOGS',
      'VIEW_ANALYTICS',
    ];
  }
  return [];
}

// ============================================
// REGISTRATION (wrapper around createUser)
// ============================================

export interface RegisterInput {
  email: string;
  password: string;
  name: string;
  role: 'buyer' | 'vendor';
  phone?: string;
  location?: string;
  businessName?: string;
  businessType?: string;
}

/**
 * Register a new user (buyer or vendor)
 * Uses canonical createUser() internally
 */
export async function registerUser(
  input: RegisterInput,
  options?: { ipAddress?: string; userAgent?: string }
): Promise<AuthResult<{ user: AuthUser; session: AuthSession }>> {
  // Only allow buyer/vendor registration through this endpoint
  if (input.role !== 'buyer' && input.role !== 'vendor') {
    return {
      success: false,
      error: { code: 'INVALID_INPUT', message: 'Registration is only for buyers and vendors' },
    };
  }

  const result = await createUser(
    {
      email: input.email,
      password: input.password,
      name: input.name,
      role: input.role,
      phone: input.phone,
      location: input.location,
      businessName: input.businessName,
      businessType: input.businessType,
    },
    { ...options, createSession: true }
  );

  if (!result.success || !result.data?.session) {
    return result as AuthResult<{ user: AuthUser; session: AuthSession }>;
  }

  return {
    success: true,
    data: {
      user: result.data.user,
      session: result.data.session!,
    },
  };
}

// ============================================
// UNIFIED LOGIN - CHECKS ALL USER SOURCES
// ============================================

export interface LoginInput {
  email?: string;
  phone?: string;
  password: string;
}

/**
 * UNIFIED LOGIN - Role-agnostic authentication
 *
 * Checks in order:
 * 1. users table (buyers, vendors, new admins)
 * 2. admin_users table (legacy admins)
 *
 * Returns the same AuthUser format regardless of source.
 * Role determines redirect AFTER successful login, not auth method.
 */
export async function loginUser(
  input: LoginInput,
  options?: { ipAddress?: string; userAgent?: string }
): Promise<AuthResult<{ user: AuthUser; session: AuthSession }>> {
  const identifier = input.email || input.phone;
  const loginByPhone = !input.email && !!input.phone;
  
  console.log('[AUTH_SERVICE:LOGIN] Starting unified login', { 
    email: input.email, 
    phone: input.phone ? '***' : undefined,
    loginByPhone 
  });

  if (!identifier || !input.password) {
    return { success: false, error: { code: 'INVALID_INPUT', message: 'Email or phone and password are required' } };
  }

  try {
    const result = await runTransaction(async (client) => {
      const now = new Date().toISOString();
      let user: Record<string, unknown> | undefined;
      let isLegacyAdmin = false;

      // Step 1: Look up user by email or phone
      if (loginByPhone) {
        // Phone login - normalize and search with variants
        const normalizedPhone = input.phone!.replace(/\D/g, '');
        const phoneVariants = getPhoneVariants(normalizedPhone);
        const placeholders = phoneVariants.map((_, i) => `$${i + 1}`).join(', ');
        
        const userResult = await client.query(
          `SELECT * FROM users WHERE phone IN (${placeholders}) AND is_deleted = 0`,
          phoneVariants
        );
        user = userResult.rows[0] as Record<string, unknown> | undefined;
        
        // Phone login doesn't check admin_users (admins use email)
      } else {
        // Email login - check users table first
        const userResult = await client.query(
          'SELECT * FROM users WHERE LOWER(email) = LOWER($1) AND is_deleted = 0',
          [input.email!.toLowerCase()]
        );
        user = userResult.rows[0] as Record<string, unknown> | undefined;

        // Step 2: If not found in users, check admin_users table
        if (!user) {
          const adminResult = await client.query(
            'SELECT * FROM admin_users WHERE LOWER(email) = LOWER($1)',
            [input.email!.toLowerCase()]
          );
          const admin = adminResult.rows[0] as Record<string, unknown> | undefined;

          if (admin) {
            // Found in admin_users table
            if (admin.is_active !== 1) {
              throw { code: 'ADMIN_DISABLED' as AuthErrorCode, message: 'Admin account is disabled' };
            }
            const adminPasswordValid = await verifyPassword(input.password, admin.password_hash as string);
            if (!adminPasswordValid) {
              throw { code: 'INVALID_CREDENTIALS' as AuthErrorCode, message: 'Invalid email or password' };
            }

            // Migrate legacy SHA-256 password to bcrypt if needed
            if (needsHashMigration(admin.password_hash as string)) {
              const newHash = await hashPassword(input.password);
              await client.query(
                'UPDATE admin_users SET password_hash = $1, updated_at = $2 WHERE id = $3',
                [newHash, new Date().toISOString(), admin.id]
              );
              console.log('[AUTH_SERVICE] Migrated admin password to bcrypt:', admin.id);
            }

            isLegacyAdmin = true;

            // Create a unified user object from admin
            user = {
              id: admin.id,
              email: admin.email,
              name: admin.name,
              role: admin.role === 'MASTER_ADMIN' ? 'master_admin' : 'admin',
              status: 'active',
              password_hash: admin.password_hash,
              phone: null,
              location: null,
              business_name: null,
              business_type: null,
              verification_status: null,
              avatar: null,
              store_description: null,
              store_banner: null,
              store_logo: null,
              created_at: admin.created_at,
              // Admin-specific
              admin_role: admin.role,
              permissions: admin.permissions,
            };
          }
        }
      }

      // Step 3: No user found anywhere
      if (!user) {
        const notFoundMsg = loginByPhone ? 'No account found with this phone number' : 'No account found with this email';
        throw { code: 'USER_NOT_FOUND' as AuthErrorCode, message: notFoundMsg };
      }

      // Step 4: Verify password (only if not already verified for legacy admin)
      if (!isLegacyAdmin) {
        if (!user.password_hash) {
          throw { code: 'INVALID_CREDENTIALS' as AuthErrorCode, message: 'Invalid email or password' };
        }
        const passwordValid = await verifyPassword(input.password, user.password_hash as string);
        if (!passwordValid) {
          throw { code: 'INVALID_CREDENTIALS' as AuthErrorCode, message: 'Invalid email or password' };
        }

        // Migrate legacy SHA-256 password to bcrypt if needed
        if (needsHashMigration(user.password_hash as string)) {
          const newHash = await hashPassword(input.password);
          await client.query(
            'UPDATE users SET password_hash = $1, updated_at = $2 WHERE id = $3',
            [newHash, new Date().toISOString(), user.id]
          );
          console.log('[AUTH_SERVICE] Migrated user password to bcrypt:', user.id);
        }
      }

      // Step 5: Check user status (for regular users)
      if (!isLegacyAdmin) {
        const status = user.status as string;
        if (status === 'suspended') {
          throw {
            code: 'USER_SUSPENDED' as AuthErrorCode,
            message: 'Your account has been suspended. Please contact support.',
          };
        }
        if (status === 'banned') {
          throw {
            code: 'USER_BANNED' as AuthErrorCode,
            message: 'Your account has been banned. Please contact support.',
          };
        }
        if (status === 'deleted') {
          throw { code: 'USER_DELETED' as AuthErrorCode, message: 'This account has been deleted.' };
        }
      }

      // Step 6: Verify role exists
      if (!user.role) {
        throw { code: 'ROLE_ASSIGNMENT_FAILED' as AuthErrorCode, message: 'User account is missing role assignment' };
      }

      // Step 7: Fix missing vendor verification status
      if (user.role === 'vendor' && !user.verification_status && !isLegacyAdmin) {
        await client.query('UPDATE users SET verification_status = $1 WHERE id = $2', ['pending', user.id]);
        user.verification_status = 'pending';
      }

      // Step 8: Create session
      const sessionId = `sess_${uuidv4().replace(/-/g, '').substring(0, 24)}`;
      const token = generateSessionToken();
      const tokenHash = hashToken(token);
      const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();

      const sessionResult = await client.query(
        `INSERT INTO sessions (id, user_id, user_role, token_hash, ip_address, user_agent, expires_at, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          sessionId,
          user.id,
          user.role,
          tokenHash,
          options?.ipAddress || null,
          options?.userAgent || null,
          expiresAt,
          now
        ]
      );

      if ((sessionResult.rowCount ?? 0) === 0) {
        throw { code: 'SESSION_CREATION_FAILED' as AuthErrorCode, message: 'Failed to create session' };
      }

      // Step 9: Update last login and set activity checkpoint
      // last_activity_checkpoint_at = the old last_login_at (when admin previously logged in)
      // This means "activity since last login" = items created after that previous login
      // The checkpoint stays stable for the session, eliminating race conditions
      // For first-time login (last_login_at IS NULL): leave checkpoint NULL so API uses created_at fallback
      if (isLegacyAdmin) {
        await client.query(
          'UPDATE admin_users SET last_activity_checkpoint_at = last_login_at, previous_login_at = last_login_at, last_login_at = $1, updated_at = $2 WHERE id = $3',
          [now, now, user.id]
        );
      } else {
        await client.query(
          'UPDATE users SET last_activity_checkpoint_at = last_login_at, previous_login_at = last_login_at, last_login_at = $1, updated_at = $2 WHERE id = $3',
          [now, now, user.id]
        );
      }

      console.log('[AUTH_SERVICE:LOGIN] Success', { userId: user.id, role: user.role, isLegacyAdmin });

      // Build auth user
      const authUser: AuthUser = {
        id: user.id as string,
        email: user.email as string,
        name: user.name as string,
        role: user.role as UserRole,
        status: (user.status as UserStatus) || 'active',
        phone: user.phone as string | null,
        location: user.location as string | null,
        businessName: user.business_name as string | null,
        businessType: user.business_type as string | null,
        verificationStatus: user.verification_status as VerificationStatus | null,
        avatar: user.avatar as string | null,
        storeDescription: user.store_description as string | null,
        storeBanner: user.store_banner as string | null,
        storeLogo: user.store_logo as string | null,
        createdAt: user.created_at as string,
      };

      // Add admin fields if admin
      if (user.role === 'admin' || user.role === 'master_admin') {
        if (isLegacyAdmin) {
          authUser.adminRole = user.admin_role as 'ADMIN' | 'MASTER_ADMIN';
          try {
            authUser.permissions = user.permissions ? JSON.parse(user.permissions as string) : [];
          } catch {
            authUser.permissions = [];
          }
        } else {
          authUser.adminRole = user.role === 'master_admin' ? 'MASTER_ADMIN' : 'ADMIN';
          authUser.permissions = getDefaultPermissions(user.role as UserRole);
        }
      }

      return {
        user: authUser,
        session: {
          id: sessionId,
          userId: user.id as string,
          userRole: user.role as UserRole,
          token,
          expiresAt,
        },
      };
    });

    return { success: true, data: result };
  } catch (error: unknown) {
    console.error('[AUTH_SERVICE:LOGIN] Error:', error);
    if (typeof error === 'object' && error !== null && 'code' in error && 'message' in error) {
      return { success: false, error: error as AuthError };
    }
    return {
      success: false,
      error: {
        code: 'TRANSACTION_FAILED',
        message: 'Login failed',
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

// ============================================
// LEGACY ADMIN LOGIN (for backward compatibility)
// Now just calls unified loginUser()
// ============================================

export async function loginAdmin(
  input: { email: string; password: string },
  options?: { ipAddress?: string; userAgent?: string }
): Promise<AuthResult<{ admin: AuthUser; session: AuthSession }>> {
  const result = await loginUser(input, options);

  if (!result.success || !result.data) {
    // Map error for admin context
    const errorCode = result.error?.code === 'USER_NOT_FOUND' ? 'ADMIN_NOT_FOUND' : result.error?.code;
    return {
      success: false,
      error: {
        code: errorCode || 'TRANSACTION_FAILED',
        message: result.error?.message || 'Invalid credentials',
        details: result.error?.details,
      },
    };
  }

  // Verify it's actually an admin
  const { user, session } = result.data;
  if (user.role !== 'admin' && user.role !== 'master_admin') {
    return {
      success: false,
      error: { code: 'ADMIN_NOT_FOUND', message: 'This account does not have admin access' },
    };
  }

  return {
    success: true,
    data: {
      admin: user,
      session,
    },
  };
}

// ============================================
// SESSION VALIDATION
// ============================================

export async function validateSessionToken(token: string): Promise<AuthResult<{
  session: { id: string; userId: string; userRole: UserRole; expiresAt: string };
  user?: AuthUser;
}>> {
  if (!token) {
    return { success: false, error: { code: 'INVALID_INPUT', message: 'Session token is required' } };
  }

  try {
    const tokenHash = hashToken(token);
    const now = new Date().toISOString();

    const sessionResult = await query<Record<string, unknown>>(
      'SELECT * FROM sessions WHERE token_hash = $1 AND expires_at > $2',
      [tokenHash, now]
    );
    const session = sessionResult.rows[0];

    if (!session) {
      return { success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Session is invalid or expired' } };
    }

    const userRole = session.user_role as UserRole;

    // Check for admin in admin_users table first (legacy)
    if (userRole === 'admin' || userRole === 'master_admin') {
      const adminResult = await query<Record<string, unknown>>(
        'SELECT * FROM admin_users WHERE id = $1',
        [session.user_id]
      );
      const admin = adminResult.rows[0];

      if (admin) {
        if (admin.is_active !== 1) {
          return { success: false, error: { code: 'ADMIN_DISABLED', message: 'Admin account is disabled' } };
        }

        // Extend session
        const newExpiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();
        await query('UPDATE sessions SET expires_at = $1 WHERE id = $2', [newExpiresAt, session.id]);

        let permissions: string[] = [];
        try {
          permissions = admin.permissions ? JSON.parse(admin.permissions as string) : [];
        } catch {
          permissions = [];
        }

        const authUser: AuthUser = {
          id: admin.id as string,
          email: admin.email as string,
          name: admin.name as string,
          role: userRole,
          status: 'active',
          phone: null,
          location: null,
          businessName: null,
          businessType: null,
          verificationStatus: null,
          avatar: null,
          storeDescription: null,
          storeBanner: null,
          storeLogo: null,
          createdAt: admin.created_at as string,
          adminRole: admin.role as 'ADMIN' | 'MASTER_ADMIN',
          permissions,
        };

        return {
          success: true,
          data: {
            session: {
              id: session.id as string,
              userId: session.user_id as string,
              userRole,
              expiresAt: newExpiresAt,
            },
            user: authUser,
          },
        };
      }
    }

    // Check users table
    const userResult = await query<Record<string, unknown>>(
      'SELECT * FROM users WHERE id = $1 AND is_deleted = 0',
      [session.user_id]
    );
    const user = userResult.rows[0];

    if (!user) {
      return { success: false, error: { code: 'USER_NOT_FOUND', message: 'User account not found' } };
    }

    const status = user.status as string;
    if (status === 'suspended') {
      return { success: false, error: { code: 'USER_SUSPENDED', message: 'Your account has been suspended' } };
    }
    if (status === 'banned') {
      return { success: false, error: { code: 'USER_BANNED', message: 'Your account has been banned' } };
    }
    if (status === 'deleted') {
      return { success: false, error: { code: 'USER_DELETED', message: 'This account has been deleted' } };
    }

    // Extend session
    const newExpiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();
    await query('UPDATE sessions SET expires_at = $1 WHERE id = $2', [newExpiresAt, session.id]);

    const authUser: AuthUser = {
      id: user.id as string,
      email: user.email as string,
      name: user.name as string,
      role: user.role as UserRole,
      status: user.status as UserStatus,
      phone: user.phone as string | null,
      location: user.location as string | null,
      businessName: user.business_name as string | null,
      businessType: user.business_type as string | null,
      verificationStatus: user.verification_status as VerificationStatus | null,
      avatar: user.avatar as string | null,
      storeDescription: user.store_description as string | null,
      storeBanner: user.store_banner as string | null,
      storeLogo: user.store_logo as string | null,
      createdAt: user.created_at as string,
    };

    // Add admin fields if admin role
    if (user.role === 'admin' || user.role === 'master_admin') {
      authUser.adminRole = user.role === 'master_admin' ? 'MASTER_ADMIN' : 'ADMIN';
      authUser.permissions = getDefaultPermissions(user.role as UserRole);
    }

    return {
      success: true,
      data: {
        session: {
          id: session.id as string,
          userId: session.user_id as string,
          userRole: user.role as UserRole,
          expiresAt: newExpiresAt,
        },
        user: authUser,
      },
    };
  } catch (error) {
    console.error('[AUTH_SERVICE:VALIDATE] Error:', error);
    return {
      success: false,
      error: {
        code: 'TRANSACTION_FAILED',
        message: 'Session validation failed',
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

// ============================================
// LOGOUT
// ============================================

export async function logoutByToken(token: string): Promise<boolean> {
  if (!token) return false;
  try {
    const tokenHash = hashToken(token);
    const result = await query('DELETE FROM sessions WHERE token_hash = $1', [tokenHash]);
    return (result.rowCount ?? 0) > 0;
  } catch (error) {
    console.error('[AUTH_SERVICE:LOGOUT] Error:', error);
    return false;
  }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

export function getRouteForRole(role: UserRole): string {
  switch (role) {
    case 'master_admin':
      return '/admin';
    case 'admin':
      return '/admin';
    case 'vendor':
      return '/vendor';
    case 'buyer':
    default:
      return '/buyer/dashboard';
  }
}

export function canVendorSell(verificationStatus: VerificationStatus | null): boolean {
  return verificationStatus === 'verified';
}

/**
 * Create an admin user (uses canonical createUser)
 * For use by master admins to create other admins
 */
export async function createAdminUser(
  input: {
    email: string;
    password: string;
    name: string;
    role: 'admin' | 'master_admin';
    permissions?: string[];
  },
  options?: { createdBy?: string }
): Promise<AuthResult<{ user: AuthUser }>> {
  const result = await createUser(
    {
      email: input.email,
      password: input.password,
      name: input.name,
      role: input.role,
      permissions: input.permissions,
      createdBy: options?.createdBy,
    },
    { createSession: false }
  );

  if (!result.success || !result.data) {
    return result as AuthResult<{ user: AuthUser }>;
  }

  return {
    success: true,
    data: { user: result.data.user },
  };
}

// ============================================
// OAUTH USER CREATION & LINKING
// Phase 4A: Google OAuth for buyers and vendors only
// ============================================

export interface OAuthUserInput {
  email: string;
  name: string;
  avatar?: string;
  oauthProvider: 'google';
  oauthId: string;
  intendedRole: 'buyer' | 'vendor';
  businessName?: string;
  businessType?: string;
}

/**
 * Create or link an OAuth user
 * 
 * RULES:
 * - OAuth is for buyers and vendors ONLY (admins use email/password)
 * - If user exists with matching email AND role, link and log in
 * - If user exists with different role, create new account with intended role
 * - If no user exists, create new account
 * - Does not auto-elevate roles
 * - Respects existing email uniqueness rules
 */
export async function createOrLinkOAuthUser(
  input: OAuthUserInput
): Promise<AuthResult<{ user: AuthUser; isNewUser: boolean }>> {
  console.log('[AUTH_SERVICE:OAUTH] Processing OAuth login', {
    email: input.email,
    provider: input.oauthProvider,
    intendedRole: input.intendedRole,
  });

  // Validate role - only buyers and vendors can use OAuth
  if (input.intendedRole !== 'buyer' && input.intendedRole !== 'vendor') {
    return {
      success: false,
      error: {
        code: 'INVALID_INPUT',
        message: 'OAuth is only available for buyers and vendors',
      },
    };
  }

  // For new vendors without businessName, we'll create a pending account
  // They can complete registration later with business details
  // Existing vendors can link without providing businessName again

  try {
    const normalizedEmail = input.email.toLowerCase().trim();
    const now = new Date().toISOString();

    // Check if user exists with this email and role
    const existingUserResult = await query<{
      id: string;
      email: string;
      name: string;
      role: UserRole;
      status: UserStatus;
      avatar: string | null;
      phone: string | null;
      location: string | null;
      business_name: string | null;
      business_type: string | null;
      verification_status: VerificationStatus | null;
      store_description: string | null;
      store_banner: string | null;
      store_logo: string | null;
      created_at: string;
    }>(
      'SELECT * FROM users WHERE LOWER(email) = LOWER($1) AND role = $2 AND is_deleted = 0',
      [normalizedEmail, input.intendedRole]
    );

    if (existingUserResult.rows[0]) {
      // User exists with matching role - link and log in
      const dbUser = existingUserResult.rows[0];
      
      // Check if user is active
      if (dbUser.status === 'suspended') {
        return {
          success: false,
          error: { code: 'USER_SUSPENDED', message: 'Account is suspended' },
        };
      }
      if (dbUser.status === 'banned') {
        return {
          success: false,
          error: { code: 'USER_BANNED', message: 'Account is banned' },
        };
      }
      if (dbUser.status === 'deleted') {
        return {
          success: false,
          error: { code: 'USER_DELETED', message: 'Account has been deleted' },
        };
      }

      // Update last login and avatar if changed
      await query(
        `UPDATE users SET last_login_at = $1, avatar = COALESCE($2, avatar), updated_at = $1 WHERE id = $3`,
        [now, input.avatar, dbUser.id]
      );

      console.log('[AUTH_SERVICE:OAUTH] Linked existing user', { userId: dbUser.id });

      return {
        success: true,
        data: {
          user: {
            id: dbUser.id,
            email: dbUser.email,
            name: dbUser.name,
            role: dbUser.role,
            status: dbUser.status,
            phone: dbUser.phone,
            location: dbUser.location,
            businessName: dbUser.business_name,
            businessType: dbUser.business_type,
            verificationStatus: dbUser.verification_status,
            avatar: input.avatar || dbUser.avatar,
            storeDescription: dbUser.store_description,
            storeBanner: dbUser.store_banner,
            storeLogo: dbUser.store_logo,
            createdAt: dbUser.created_at,
          },
          isNewUser: false,
        },
      };
    }

    // Check if email exists as admin (block OAuth)
    const adminCheck = await query<{ id: string }>(
      'SELECT id FROM admin_users WHERE LOWER(email) = LOWER($1)',
      [normalizedEmail]
    );
    if (adminCheck.rows[0]) {
      return {
        success: false,
        error: {
          code: 'EMAIL_EXISTS',
          message: 'This email is registered as an admin. Please use password login.',
        },
      };
    }

    // Create new user with OAuth
    const userId = `user_${uuidv4().replace(/-/g, '').substring(0, 16)}`;
    const status: UserStatus = input.intendedRole === 'vendor' ? 'pending' : 'active';
    const verificationStatus: VerificationStatus | null = input.intendedRole === 'vendor' ? 'pending' : null;
    
    // For vendors, use default business name if not provided
    const businessName = input.intendedRole === 'vendor' 
      ? (input.businessName || `${input.name}'s Store`)
      : (input.businessName || null);

    await query(
      `INSERT INTO users (
        id, email, password_hash, name, role, status, avatar, 
        business_name, business_type, verification_status,
        last_login_at, created_at, updated_at
      ) VALUES ($1, $2, NULL, $3, $4, $5, $6, $7, $8, $9, $10, $10, $10)`,
      [
        userId,
        normalizedEmail,
        input.name,
        input.intendedRole,
        status,
        input.avatar || null,
        businessName,
        input.businessType || null,
        verificationStatus,
        now,
      ]
    );

    // If vendor, create vendor record (even without businessName for OAuth flow)
    if (input.intendedRole === 'vendor') {
      const vendorId = `vendor_${uuidv4().replace(/-/g, '').substring(0, 16)}`;
      const businessName = input.businessName || `${input.name}'s Store`;
      await query(
        `INSERT INTO vendors (
          id, user_id, business_name, business_type, description,
          verification_status, store_status, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, 'pending', 'inactive', $6, $6)`,
        [vendorId, userId, businessName, input.businessType || 'general', '', now]
      );
    }

    console.log('[AUTH_SERVICE:OAUTH] Created new OAuth user', { userId, role: input.intendedRole });

    return {
      success: true,
      data: {
        user: {
          id: userId,
          email: normalizedEmail,
          name: input.name,
          role: input.intendedRole,
          status,
          phone: null,
          location: null,
          businessName: businessName,
          businessType: input.businessType || null,
          verificationStatus,
          avatar: input.avatar || null,
          storeDescription: null,
          storeBanner: null,
          storeLogo: null,
          createdAt: now,
        },
        isNewUser: true,
      },
    };
  } catch (error) {
    console.error('[AUTH_SERVICE:OAUTH] Error:', error);
    return {
      success: false,
      error: {
        code: 'TRANSACTION_FAILED',
        message: 'Failed to create or link OAuth account',
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

/**
 * Create a session for a user (used after OAuth authentication)
 */
export async function createSessionForUser(
  userId: string,
  userRole: UserRole
): Promise<AuthResult<AuthSession>> {
  try {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_DURATION_MS);
    const token = generateSessionToken();
    const tokenHash = hashToken(token);
    const sessionId = `sess_${uuidv4().replace(/-/g, '').substring(0, 24)}`;

    await query(
      `INSERT INTO sessions (id, user_id, user_role, token_hash, expires_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $6)`,
      [sessionId, userId, userRole, tokenHash, expiresAt.toISOString(), now.toISOString()]
    );

    console.log('[AUTH_SERVICE:SESSION] Created session', { sessionId, userId });

    return {
      success: true,
      data: {
        id: sessionId,
        userId,
        userRole,
        token,
        expiresAt: expiresAt.toISOString(),
      },
    };
  } catch (error) {
    console.error('[AUTH_SERVICE:SESSION] Error:', error);
    return {
      success: false,
      error: {
        code: 'SESSION_CREATION_FAILED',
        message: 'Failed to create session',
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}
