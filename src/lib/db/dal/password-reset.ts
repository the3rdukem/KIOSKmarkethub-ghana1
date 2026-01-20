/**
 * Password Reset Data Access Layer
 * 
 * Handles secure password reset token generation, validation, and password updates.
 * Tokens are hashed before storage and are single-use with expiration.
 */

import { query } from '../index';
import { randomBytes, createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { hashPassword, validatePassword } from './auth-service';
import { getUserByEmail } from './users';

const TOKEN_EXPIRY_MINUTES = 30;

interface PasswordResetToken {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
}

interface DbTokenRow {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  used_at: string | null;
  created_at: string;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function generateSecureToken(): string {
  return randomBytes(32).toString('hex');
}

export async function createPasswordResetToken(email: string): Promise<{
  success: boolean;
  token?: string;
  expiresAt?: string;
  userId?: string;
  userName?: string;
}> {
  const user = await getUserByEmail(email);
  
  if (!user || !user.password_hash) {
    return { success: false };
  }

  if (user.status === 'banned' || user.status === 'deleted') {
    return { success: false };
  }

  await query(
    `DELETE FROM password_reset_tokens WHERE user_id = $1`,
    [user.id]
  );

  const token = generateSecureToken();
  const tokenHash = hashToken(token);
  const tokenId = `prt_${uuidv4().replace(/-/g, '').substring(0, 16)}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + TOKEN_EXPIRY_MINUTES * 60 * 1000);

  await query(
    `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, created_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [tokenId, user.id, tokenHash, expiresAt.toISOString(), now.toISOString()]
  );

  console.log('[PASSWORD_RESET] Token created for user:', user.id);

  return {
    success: true,
    token,
    expiresAt: expiresAt.toISOString(),
    userId: user.id,
    userName: user.name || user.email?.split('@')[0] || 'User',
  };
}

export async function validateResetToken(token: string): Promise<{
  valid: boolean;
  userId?: string;
  error?: string;
}> {
  const tokenHash = hashToken(token);
  
  const result = await query<DbTokenRow>(
    `SELECT * FROM password_reset_tokens WHERE token_hash = $1`,
    [tokenHash]
  );

  if (result.rows.length === 0) {
    return { valid: false, error: 'Invalid or expired reset link' };
  }

  const tokenRow = result.rows[0];

  if (tokenRow.used_at) {
    return { valid: false, error: 'This reset link has already been used' };
  }

  const expiresAt = new Date(tokenRow.expires_at);
  if (new Date() > expiresAt) {
    return { valid: false, error: 'This reset link has expired' };
  }

  return { valid: true, userId: tokenRow.user_id };
}

export async function resetPassword(token: string, newPassword: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const validation = validatePassword(newPassword);
  if (!validation.isValid) {
    return { success: false, error: validation.errors.join('. ') };
  }

  const tokenValidation = await validateResetToken(token);
  if (!tokenValidation.valid || !tokenValidation.userId) {
    return { success: false, error: tokenValidation.error };
  }

  const tokenHash = hashToken(token);
  const passwordHash = hashPassword(newPassword);
  const now = new Date().toISOString();

  await query(
    `UPDATE users SET password_hash = $1, updated_at = $2 WHERE id = $3`,
    [passwordHash, now, tokenValidation.userId]
  );

  await query(
    `UPDATE password_reset_tokens SET used_at = $1 WHERE token_hash = $2`,
    [now, tokenHash]
  );

  console.log('[PASSWORD_RESET] Password updated for user:', tokenValidation.userId);

  return { success: true };
}

export async function cleanupExpiredTokens(): Promise<number> {
  const result = await query(
    `DELETE FROM password_reset_tokens WHERE expires_at < $1 OR used_at IS NOT NULL`,
    [new Date().toISOString()]
  );
  
  return result.rowCount || 0;
}
