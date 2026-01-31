/**
 * Admin Users Data Access Layer
 *
 * Server-side only - provides CRUD operations for admin users.
 * Includes the initial master admin setup.
 */

import { query } from '../index';
import { v4 as uuidv4 } from 'uuid';
import {
  hashPassword,
  hashPasswordSync,
  verifyPassword,
  verifyPasswordSync,
  needsHashMigration,
  hashToken,
} from '@/lib/utils/crypto';

export type AdminRole = 'MASTER_ADMIN' | 'ADMIN';

export type AdminPermission =
  | 'MANAGE_API_KEYS'
  | 'MANAGE_ADMINS'
  | 'MANAGE_VENDORS'
  | 'MANAGE_USERS'
  | 'MANAGE_PRODUCTS'
  | 'MANAGE_ORDERS'
  | 'MANAGE_DISPUTES'
  | 'VIEW_AUDIT_LOGS'
  | 'MANAGE_SYSTEM_SETTINGS'
  | 'VIEW_ANALYTICS'
  | 'MANAGE_SECURITY'
  | 'FULL_SYSTEM_ACCESS';

export interface DbAdminUser {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  role: AdminRole;
  is_active: number;
  permissions: string | null;
  mfa_enabled: number;
  created_by: string | null;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateAdminInput {
  email: string;
  password: string;
  name: string;
  role: AdminRole;
  permissions?: AdminPermission[];
  createdBy?: string;
}

// All permissions for MASTER_ADMIN
export const MASTER_ADMIN_PERMISSIONS: AdminPermission[] = [
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

// Limited permissions for regular ADMIN
export const ADMIN_PERMISSIONS: AdminPermission[] = [
  'MANAGE_VENDORS',
  'MANAGE_USERS',
  'MANAGE_PRODUCTS',
  'MANAGE_ORDERS',
  'MANAGE_DISPUTES',
  'VIEW_AUDIT_LOGS',
  'VIEW_ANALYTICS',
];

// Initial Master Admin credentials (from environment or default)
const INITIAL_MASTER_ADMIN = {
  email: process.env.MASTER_ADMIN_EMAIL || 'the3rdukem@gmail.com',
  password: process.env.MASTER_ADMIN_PASSWORD || '123asdqweX$',
  name: 'System Administrator',
};

/**
 * Initialize the system with the initial master admin
 */
export async function initializeAdminSystem(): Promise<void> {
  // Check if any admin exists
  const result = await query(
    "SELECT id FROM admin_users WHERE role = 'MASTER_ADMIN' LIMIT 1"
  );
  const existingAdmin = result.rows[0];

  if (!existingAdmin) {
    // Create initial master admin
    await createAdminUser({
      email: INITIAL_MASTER_ADMIN.email,
      password: INITIAL_MASTER_ADMIN.password,
      name: INITIAL_MASTER_ADMIN.name,
      role: 'MASTER_ADMIN',
      permissions: MASTER_ADMIN_PERMISSIONS,
    });
    console.log('[DB] Initial Master Admin created:', INITIAL_MASTER_ADMIN.email);
  }
}

/**
 * Create a new admin user
 */
export async function createAdminUser(input: CreateAdminInput): Promise<DbAdminUser> {
  const id = `admin_${uuidv4().replace(/-/g, '').substring(0, 16)}`;
  const now = new Date().toISOString();
  const passwordHash = await hashPassword(input.password);
  const permissions = input.permissions ||
    (input.role === 'MASTER_ADMIN' ? MASTER_ADMIN_PERMISSIONS : ADMIN_PERMISSIONS);

  await query(`
    INSERT INTO admin_users (
      id, email, password_hash, name, role, is_active,
      permissions, created_by, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
  `, [
    id,
    input.email.toLowerCase(),
    passwordHash,
    input.name,
    input.role,
    1,
    JSON.stringify(permissions),
    input.createdBy || null,
    now,
    now
  ]);

  const admin = await getAdminById(id);
  return admin!;
}

/**
 * Get admin by ID
 */
export async function getAdminById(id: string): Promise<DbAdminUser | null> {
  const result = await query<DbAdminUser>('SELECT * FROM admin_users WHERE id = $1', [id]);
  return result.rows[0] || null;
}

/**
 * Get admin by email
 */
export async function getAdminByEmail(email: string): Promise<DbAdminUser | null> {
  // PostgreSQL uses ILIKE for case-insensitive comparison or Lower()
  const result = await query<DbAdminUser>('SELECT * FROM admin_users WHERE LOWER(email) = LOWER($1)', [email]);
  return result.rows[0] || null;
}

/**
 * Get all admins
 */
export async function getAllAdmins(): Promise<DbAdminUser[]> {
  const result = await query<DbAdminUser>('SELECT * FROM admin_users ORDER BY created_at ASC');
  return result.rows;
}

/**
 * Get master admins
 */
export async function getMasterAdmins(): Promise<DbAdminUser[]> {
  const result = await query<DbAdminUser>("SELECT * FROM admin_users WHERE role = 'MASTER_ADMIN'");
  return result.rows;
}

/**
 * Authenticate admin
 */
export async function authenticateAdmin(email: string, password: string): Promise<{
  success: boolean;
  admin?: DbAdminUser;
  error?: string;
}> {
  const admin = await getAdminByEmail(email);

  if (!admin) {
    return { success: false, error: 'Invalid credentials' };
  }

  if (!admin.is_active) {
    return { success: false, error: 'Account is disabled' };
  }

  const passwordValid = await verifyPassword(password, admin.password_hash);
  if (!passwordValid) {
    return { success: false, error: 'Invalid credentials' };
  }

  // Update last login
  await updateAdminLastLogin(admin.id);

  return { success: true, admin };
}

/**
 * Update admin last login
 */
export async function updateAdminLastLogin(id: string): Promise<void> {
  const now = new Date().toISOString();
  await query('UPDATE admin_users SET last_login_at = $1 WHERE id = $2', [now, id]);
}

/**
 * Update admin
 */
export async function updateAdmin(id: string, updates: {
  name?: string;
  isActive?: boolean;
  permissions?: AdminPermission[];
}): Promise<DbAdminUser | null> {
  const now = new Date().toISOString();

  const fields: string[] = ['updated_at = $1'];
  const values: unknown[] = [now];
  let paramIndex = 2;

  if (updates.name !== undefined) {
    fields.push(`name = $${paramIndex++}`);
    values.push(updates.name);
  }
  if (updates.isActive !== undefined) {
    fields.push(`is_active = $${paramIndex++}`);
    values.push(updates.isActive ? 1 : 0);
  }
  if (updates.permissions !== undefined) {
    fields.push(`permissions = $${paramIndex++}`);
    values.push(JSON.stringify(updates.permissions));
  }

  values.push(id);
  const sql = `UPDATE admin_users SET ${fields.join(', ')} WHERE id = $${paramIndex}`;
  const result = await query(sql, values);

  if ((result.rowCount ?? 0) === 0) return null;
  return getAdminById(id);
}

/**
 * Change admin password
 */
export async function changeAdminPassword(id: string, newPassword: string): Promise<boolean> {
  if (newPassword.length < 8) return false;

  const passwordHash = await hashPassword(newPassword);
  const now = new Date().toISOString();

  const result = await query(`
    UPDATE admin_users SET password_hash = $1, updated_at = $2 WHERE id = $3
  `, [passwordHash, now, id]);

  return (result.rowCount ?? 0) > 0;
}

/**
 * Revoke admin access (deactivate)
 */
export async function revokeAdminAccess(id: string): Promise<boolean> {
  const now = new Date().toISOString();

  const result = await query(`
    UPDATE admin_users SET is_active = 0, updated_at = $1 WHERE id = $2
  `, [now, id]);

  return (result.rowCount ?? 0) > 0;
}

/**
 * Delete admin (permanent)
 */
export async function deleteAdmin(id: string): Promise<boolean> {
  // Prevent deleting the last master admin
  const masterAdmins = await getMasterAdmins();
  const targetAdmin = await getAdminById(id);

  if (targetAdmin?.role === 'MASTER_ADMIN' && masterAdmins.length <= 1) {
    return false;
  }

  const result = await query('DELETE FROM admin_users WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
}

/**
 * Check if admin has permission
 */
export function hasAdminPermission(admin: DbAdminUser, permission: AdminPermission): boolean {
  if (!admin.permissions) return false;
  const permissions = JSON.parse(admin.permissions) as AdminPermission[];
  return permissions.includes('FULL_SYSTEM_ACCESS') || permissions.includes(permission);
}

/**
 * Check if admin is master admin
 */
export function isMasterAdmin(admin: DbAdminUser): boolean {
  return admin.role === 'MASTER_ADMIN';
}

/**
 * Validate admin session token
 * Returns the admin user if session is valid, null otherwise
 */
export async function validateAdminSession(sessionToken: string): Promise<DbAdminUser | null> {
  if (!sessionToken) {
    return null;
  }

  const tokenHash = hashToken(sessionToken);
  const now = new Date().toISOString();

  // Check sessions table for admin session
  // Admin sessions are stored with user_role = 'admin' or 'master_admin'
  const sessionResult = await query<{
    user_id: string;
    user_role: string;
    expires_at: string;
  }>(
    `SELECT user_id, user_role, expires_at 
     FROM sessions 
     WHERE token_hash = $1 
       AND user_role IN ('admin', 'master_admin')
       AND expires_at > $2`,
    [tokenHash, now]
  );

  if (sessionResult.rows.length === 0) {
    return null;
  }

  const session = sessionResult.rows[0];

  // Get admin user record
  const adminResult = await query<DbAdminUser>(
    `SELECT * FROM admin_users WHERE id = $1 AND is_active = 1`,
    [session.user_id]
  );

  if (adminResult.rows.length === 0) {
    return null;
  }

  return adminResult.rows[0];
}
