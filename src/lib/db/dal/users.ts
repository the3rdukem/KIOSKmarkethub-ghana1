/**
 * Users Data Access Layer - PostgreSQL
 *
 * Server-side only - provides CRUD operations for users.
 * All data persistence happens here, not in client stores.
 */

import { query } from '../index';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';

export type UserRole = 'buyer' | 'vendor' | 'admin' | 'master_admin';
export type UserStatus = 'active' | 'suspended' | 'pending' | 'banned' | 'deleted';
export type VerificationStatus = 'pending' | 'under_review' | 'verified' | 'rejected' | 'suspended';

export interface DbUser {
  id: string;
  email: string;
  password_hash: string | null;
  name: string;
  role: UserRole;
  status: UserStatus;
  avatar: string | null;
  phone: string | null;
  phone_verified: boolean;
  phone_otp_hash: string | null;
  phone_otp_expires: string | null;
  phone_otp_attempts: number;
  phone_otp_last_sent: string | null;
  payout_auth_token: string | null;
  payout_auth_expires: string | null;
  phone_change_token: string | null;
  phone_change_token_expires: string | null;
  location: string | null;
  business_name: string | null;
  business_type: string | null;
  verification_status: VerificationStatus | null;
  verification_documents: string | null;
  verification_notes: string | null;
  verified_at: string | null;
  verified_by: string | null;
  store_description: string | null;
  store_banner: string | null;
  store_logo: string | null;
  store_settings: string | null;
  notification_settings: string | null;
  is_deleted: number;
  last_login_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateUserInput {
  email: string;
  password?: string;
  name: string;
  role: UserRole;
  status?: UserStatus;
  phone?: string;
  location?: string;
  businessName?: string;
  businessType?: string;
  verificationStatus?: VerificationStatus;
}

export interface UpdateUserInput {
  name?: string;
  email?: string;
  emailVerified?: boolean;
  emailVerificationToken?: string;
  emailVerificationExpires?: string;
  pendingEmail?: string;
  status?: UserStatus;
  avatar?: string;
  phone?: string;
  location?: string;
  businessName?: string;
  businessType?: string;
  verificationStatus?: VerificationStatus;
  verificationNotes?: string;
  verifiedAt?: string;
  verifiedBy?: string;
  storeDescription?: string;
  storeBanner?: string;
  storeLogo?: string;
  storeStatus?: 'open' | 'closed' | 'vacation';
  storeVacationMessage?: string;
  storeContactEmail?: string;
  storeContactPhone?: string;
  storeWebsite?: string;
  storeBusinessHours?: string;
  storeReturnPolicy?: string;
  storeShippingPolicy?: string;
  storeResponseTime?: string;
  storeSocialLinks?: string;
  storeSettings?: Record<string, unknown>;
  notificationSettings?: Record<string, unknown>;
  isDeleted?: boolean;
  lastLoginAt?: string;
  createdBy?: string;
}

export function hashPassword(password: string): string {
  const salt = uuidv4().substring(0, 16);
  const hash = createHash('sha256')
    .update(password + salt)
    .digest('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(':');
  if (!salt || !hash) return false;
  const computedHash = createHash('sha256')
    .update(password + salt)
    .digest('hex');
  return computedHash === hash;
}

export async function createUser(input: CreateUserInput): Promise<DbUser> {
  const id = `user_${uuidv4().replace(/-/g, '').substring(0, 16)}`;
  const now = new Date().toISOString();
  const passwordHash = input.password ? hashPassword(input.password) : null;

  await query(
    `INSERT INTO users (
      id, email, password_hash, name, role, status, phone, location,
      business_name, business_type, verification_status, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
    [
      id,
      input.email.toLowerCase(),
      passwordHash,
      input.name,
      input.role,
      input.status || (input.role === 'vendor' ? 'pending' : 'active'),
      input.phone || null,
      input.location || null,
      input.businessName || null,
      input.businessType || null,
      input.role === 'vendor' ? (input.verificationStatus || 'pending') : null,
      now,
      now
    ]
  );

  return (await getUserById(id))!;
}

export async function getUserById(id: string): Promise<DbUser | null> {
  const result = await query<DbUser>('SELECT * FROM users WHERE id = $1', [id]);
  return result.rows[0] || null;
}

export async function getUserByEmail(email: string): Promise<DbUser | null> {
  const result = await query<DbUser>(
    'SELECT * FROM users WHERE LOWER(email) = LOWER($1)',
    [email]
  );
  return result.rows[0] || null;
}

/**
 * Generate all possible phone format variants for matching
 * This handles the mismatch between stored formats (0244...) and normalized formats (+233244...)
 */
export function getPhoneVariants(phone: string): string[] {
  const cleaned = phone.replace(/[\s\-\(\)]/g, '');
  const variants: string[] = [cleaned];
  
  // If it's E.164 format (+233...), also check local format (0...)
  if (cleaned.startsWith('+233') && cleaned.length === 13) {
    variants.push('0' + cleaned.substring(4)); // +233244... → 0244...
  }
  
  // If it's local format (0...), also check E.164 format (+233...)
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    variants.push('+233' + cleaned.substring(1)); // 0244... → +233244...
  }
  
  // If it's 9 digits (without leading 0), add both formats
  if (!cleaned.startsWith('+') && !cleaned.startsWith('0') && cleaned.length === 9) {
    variants.push('0' + cleaned);         // 244... → 0244...
    variants.push('+233' + cleaned);      // 244... → +233244...
  }
  
  return [...new Set(variants)]; // Remove duplicates
}

/**
 * Check if a phone number is already in use by any user
 * Checks all possible format variants to handle legacy data inconsistencies
 * Returns true if phone exists, false otherwise
 */
export async function isPhoneInUse(phone: string): Promise<boolean> {
  const variants = getPhoneVariants(phone);
  
  // Build parameterized query with all variants
  const placeholders = variants.map((_, i) => `$${i + 1}`).join(', ');
  const result = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM users WHERE phone IN (${placeholders}) AND is_deleted = 0`,
    variants
  );
  return parseInt(result.rows[0]?.count || '0', 10) > 0;
}

/**
 * Get user by phone number
 * Checks all possible format variants to handle legacy data inconsistencies
 */
export async function getUserByPhone(phone: string): Promise<DbUser | null> {
  const variants = getPhoneVariants(phone);
  const placeholders = variants.map((_, i) => `$${i + 1}`).join(', ');
  const result = await query<DbUser>(
    `SELECT * FROM users WHERE phone IN (${placeholders}) AND is_deleted = 0 LIMIT 1`,
    variants
  );
  return result.rows[0] || null;
}

export async function getUsers(options?: {
  role?: UserRole;
  status?: UserStatus;
  includeDeleted?: boolean;
  limit?: number;
  offset?: number;
}): Promise<DbUser[]> {
  let sql = 'SELECT * FROM users WHERE 1=1';
  const params: unknown[] = [];
  let paramIndex = 1;

  if (!options?.includeDeleted) {
    sql += ' AND is_deleted = 0';
  }

  if (options?.role) {
    sql += ` AND role = $${paramIndex++}`;
    params.push(options.role);
  }

  if (options?.status) {
    sql += ` AND status = $${paramIndex++}`;
    params.push(options.status);
  }

  sql += ' ORDER BY created_at DESC';

  if (options?.limit) {
    sql += ` LIMIT $${paramIndex++}`;
    params.push(options.limit);
  }

  if (options?.offset) {
    sql += ` OFFSET $${paramIndex++}`;
    params.push(options.offset);
  }

  const result = await query<DbUser>(sql, params);
  return result.rows;
}

export async function updateUser(id: string, updates: UpdateUserInput): Promise<DbUser | null> {
  const now = new Date().toISOString();

  const fields: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  fields.push(`updated_at = $${paramIndex++}`);
  values.push(now);

  if (updates.name !== undefined) {
    fields.push(`name = $${paramIndex++}`);
    values.push(updates.name);
  }
  if (updates.email !== undefined) {
    fields.push(`email = $${paramIndex++}`);
    values.push(updates.email);
  }
  if (updates.emailVerified !== undefined) {
    fields.push(`email_verified = $${paramIndex++}`);
    values.push(updates.emailVerified);
  }
  if (updates.emailVerificationToken !== undefined) {
    fields.push(`email_verification_token = $${paramIndex++}`);
    values.push(updates.emailVerificationToken);
  }
  if (updates.emailVerificationExpires !== undefined) {
    fields.push(`email_verification_expires = $${paramIndex++}`);
    values.push(updates.emailVerificationExpires);
  }
  if (updates.pendingEmail !== undefined) {
    fields.push(`pending_email = $${paramIndex++}`);
    values.push(updates.pendingEmail);
  }
  if (updates.status !== undefined) {
    fields.push(`status = $${paramIndex++}`);
    values.push(updates.status);
  }
  if (updates.avatar !== undefined) {
    fields.push(`avatar = $${paramIndex++}`);
    values.push(updates.avatar);
  }
  if (updates.phone !== undefined) {
    fields.push(`phone = $${paramIndex++}`);
    values.push(updates.phone);
  }
  if (updates.location !== undefined) {
    fields.push(`location = $${paramIndex++}`);
    values.push(updates.location);
  }
  if (updates.businessName !== undefined) {
    fields.push(`business_name = $${paramIndex++}`);
    values.push(updates.businessName);
  }
  if (updates.businessType !== undefined) {
    fields.push(`business_type = $${paramIndex++}`);
    values.push(updates.businessType);
  }
  if (updates.verificationStatus !== undefined) {
    fields.push(`verification_status = $${paramIndex++}`);
    values.push(updates.verificationStatus);
  }
  if (updates.verificationNotes !== undefined) {
    fields.push(`verification_notes = $${paramIndex++}`);
    values.push(updates.verificationNotes);
  }
  if (updates.verifiedAt !== undefined) {
    fields.push(`verified_at = $${paramIndex++}`);
    values.push(updates.verifiedAt);
  }
  if (updates.verifiedBy !== undefined) {
    fields.push(`verified_by = $${paramIndex++}`);
    values.push(updates.verifiedBy);
  }
  if (updates.storeDescription !== undefined) {
    fields.push(`store_description = $${paramIndex++}`);
    values.push(updates.storeDescription);
  }
  if (updates.storeBanner !== undefined) {
    fields.push(`store_banner = $${paramIndex++}`);
    values.push(updates.storeBanner);
  }
  if (updates.storeLogo !== undefined) {
    fields.push(`store_logo = $${paramIndex++}`);
    values.push(updates.storeLogo);
  }
  if (updates.storeStatus !== undefined) {
    fields.push(`store_status = $${paramIndex++}`);
    values.push(updates.storeStatus);
  }
  if (updates.storeVacationMessage !== undefined) {
    fields.push(`store_vacation_message = $${paramIndex++}`);
    values.push(updates.storeVacationMessage);
  }
  if (updates.storeContactEmail !== undefined) {
    fields.push(`store_contact_email = $${paramIndex++}`);
    values.push(updates.storeContactEmail);
  }
  if (updates.storeContactPhone !== undefined) {
    fields.push(`store_contact_phone = $${paramIndex++}`);
    values.push(updates.storeContactPhone);
  }
  if (updates.storeWebsite !== undefined) {
    fields.push(`store_website = $${paramIndex++}`);
    values.push(updates.storeWebsite);
  }
  if (updates.storeBusinessHours !== undefined) {
    fields.push(`store_business_hours = $${paramIndex++}`);
    values.push(updates.storeBusinessHours);
  }
  if (updates.storeReturnPolicy !== undefined) {
    fields.push(`store_return_policy = $${paramIndex++}`);
    values.push(updates.storeReturnPolicy);
  }
  if (updates.storeShippingPolicy !== undefined) {
    fields.push(`store_shipping_policy = $${paramIndex++}`);
    values.push(updates.storeShippingPolicy);
  }
  if (updates.storeResponseTime !== undefined) {
    fields.push(`store_response_time = $${paramIndex++}`);
    values.push(updates.storeResponseTime);
  }
  if (updates.storeSocialLinks !== undefined) {
    fields.push(`store_social_links = $${paramIndex++}`);
    values.push(updates.storeSocialLinks);
  }
  if (updates.storeSettings !== undefined) {
    fields.push(`store_settings = $${paramIndex++}`);
    values.push(JSON.stringify(updates.storeSettings));
  }
  if (updates.notificationSettings !== undefined) {
    fields.push(`notification_settings = $${paramIndex++}`);
    values.push(JSON.stringify(updates.notificationSettings));
  }
  if (updates.isDeleted !== undefined) {
    fields.push(`is_deleted = $${paramIndex++}`);
    values.push(updates.isDeleted ? 1 : 0);
  }
  if (updates.lastLoginAt !== undefined) {
    fields.push(`last_login_at = $${paramIndex++}`);
    values.push(updates.lastLoginAt);
  }
  if (updates.createdBy !== undefined) {
    fields.push(`created_by = $${paramIndex++}`);
    values.push(updates.createdBy);
  }

  values.push(id);

  const result = await query(
    `UPDATE users SET ${fields.join(', ')} WHERE id = $${paramIndex}`,
    values
  );

  if ((result.rowCount ?? 0) === 0) return null;
  return getUserById(id);
}

export async function softDeleteUser(id: string, deletedBy: string, reason: string): Promise<boolean> {
  const now = new Date().toISOString();

  const result = await query(
    `UPDATE users SET
      status = 'deleted',
      is_deleted = 1,
      deleted_at = $1,
      deleted_by = $2,
      deletion_reason = $3,
      updated_at = $4
    WHERE id = $5`,
    [now, deletedBy, reason, now, id]
  );

  return (result.rowCount ?? 0) > 0;
}

export async function deleteUser(id: string): Promise<boolean> {
  const result = await query('DELETE FROM users WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
}

export async function verifyUserCredentials(email: string, password: string): Promise<DbUser | null> {
  const user = await getUserByEmail(email);
  if (!user || !user.password_hash) return null;
  if (!verifyPassword(password, user.password_hash)) return null;
  const allowedStatuses: UserStatus[] = ['active', 'pending'];
  if (!allowedStatuses.includes(user.status)) return null;
  return user;
}

export async function searchUsers(searchQuery: string, options?: {
  role?: UserRole;
  limit?: number;
}): Promise<DbUser[]> {
  const searchTerm = `%${searchQuery.toLowerCase()}%`;
  let sql = `
    SELECT * FROM users
    WHERE is_deleted = 0
    AND (
      LOWER(name) LIKE $1
      OR LOWER(email) LIKE $1
      OR LOWER(phone) LIKE $1
      OR LOWER(business_name) LIKE $1
    )
  `;

  const params: unknown[] = [searchTerm];
  let paramIndex = 2;

  if (options?.role) {
    sql += ` AND role = $${paramIndex++}`;
    params.push(options.role);
  }

  sql += ' ORDER BY name ASC';

  if (options?.limit) {
    sql += ` LIMIT $${paramIndex++}`;
    params.push(options.limit);
  }

  const result = await query<DbUser>(sql, params);
  return result.rows;
}

export async function getPendingVendors(): Promise<DbUser[]> {
  const result = await query<DbUser>(`
    SELECT * FROM users
    WHERE role = 'vendor'
    AND verification_status IN ('pending', 'under_review')
    AND is_deleted = 0
    ORDER BY created_at ASC
  `);
  return result.rows;
}

export async function getUserStats(): Promise<{
  totalBuyers: number;
  totalVendors: number;
  verifiedVendors: number;
  pendingVendors: number;
  activeUsers: number;
  suspendedUsers: number;
}> {
  const result = await query<{
    totalbuyers: string;
    totalvendors: string;
    verifiedvendors: string;
    pendingvendors: string;
    activeusers: string;
    suspendedusers: string;
  }>(`
    SELECT
      SUM(CASE WHEN role = 'buyer' AND is_deleted = 0 THEN 1 ELSE 0 END) as totalBuyers,
      SUM(CASE WHEN role = 'vendor' AND is_deleted = 0 THEN 1 ELSE 0 END) as totalVendors,
      SUM(CASE WHEN role = 'vendor' AND verification_status = 'verified' AND is_deleted = 0 THEN 1 ELSE 0 END) as verifiedVendors,
      SUM(CASE WHEN role = 'vendor' AND verification_status IN ('pending', 'under_review') AND is_deleted = 0 THEN 1 ELSE 0 END) as pendingVendors,
      SUM(CASE WHEN status = 'active' AND is_deleted = 0 THEN 1 ELSE 0 END) as activeUsers,
      SUM(CASE WHEN status = 'suspended' AND is_deleted = 0 THEN 1 ELSE 0 END) as suspendedUsers
    FROM users
  `);

  const row = result.rows[0];

  return {
    totalBuyers: parseInt(row?.totalbuyers || '0'),
    totalVendors: parseInt(row?.totalvendors || '0'),
    verifiedVendors: parseInt(row?.verifiedvendors || '0'),
    pendingVendors: parseInt(row?.pendingvendors || '0'),
    activeUsers: parseInt(row?.activeusers || '0'),
    suspendedUsers: parseInt(row?.suspendedusers || '0'),
  };
}

export async function updateUserPassword(id: string, newPassword: string): Promise<boolean> {
  const passwordHash = hashPassword(newPassword);
  const now = new Date().toISOString();

  const result = await query(
    'UPDATE users SET password_hash = $1, updated_at = $2 WHERE id = $3',
    [passwordHash, now, id]
  );

  return (result.rowCount ?? 0) > 0;
}
