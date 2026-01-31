/**
 * Centralized Crypto Utility Module
 * 
 * Provides secure password hashing using bcrypt and backward-compatible
 * verification for legacy SHA-256 hashed passwords.
 * 
 * Migration strategy:
 * - New passwords: Always hash with bcrypt
 * - Legacy passwords: Verify with SHA-256, then re-hash with bcrypt on successful login
 */

import bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';

const BCRYPT_ROUNDS = 12;
const BCRYPT_PREFIX = '$2';
const LEGACY_SEPARATOR = ':';

/**
 * Hash a password using bcrypt (industry standard)
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Synchronous version for contexts that can't use async
 * Note: Prefer async version when possible
 */
export function hashPasswordSync(password: string): string {
  return bcrypt.hashSync(password, BCRYPT_ROUNDS);
}

/**
 * Verify a password against a stored hash
 * Supports both bcrypt (new) and legacy SHA-256 hashes
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  if (isBcryptHash(storedHash)) {
    return bcrypt.compare(password, storedHash);
  }
  return verifyLegacyPassword(password, storedHash);
}

/**
 * Synchronous version for contexts that can't use async
 */
export function verifyPasswordSync(password: string, storedHash: string): boolean {
  if (isBcryptHash(storedHash)) {
    return bcrypt.compareSync(password, storedHash);
  }
  return verifyLegacyPassword(password, storedHash);
}

/**
 * Check if a stored hash needs migration to bcrypt
 */
export function needsHashMigration(storedHash: string): boolean {
  return !isBcryptHash(storedHash);
}

/**
 * Check if a hash is in bcrypt format
 */
function isBcryptHash(hash: string): boolean {
  return hash.startsWith(BCRYPT_PREFIX);
}

/**
 * Verify legacy SHA-256 password hash (format: salt:hash)
 */
function verifyLegacyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(LEGACY_SEPARATOR);
  if (!salt || !hash) return false;
  const computedHash = createHash('sha256')
    .update(password + salt)
    .digest('hex');
  return computedHash === hash;
}

/**
 * Generate a cryptographically secure random token
 */
export function generateSecureToken(length: number = 32): string {
  return randomBytes(length).toString('hex');
}

/**
 * Hash a token for storage (one-way hash for tokens like session tokens)
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Hash OTP with pepper for secure storage
 * Requires OTP_SECRET_PEPPER environment variable in production
 */
export function hashOTP(otp: string): string {
  const pepper = getOTPPepper();
  return createHash('sha256').update(otp + pepper).digest('hex');
}

/**
 * Verify OTP against stored hash
 */
export function verifyOTP(otp: string, storedHash: string): boolean {
  const computedHash = hashOTP(otp);
  return computedHash === storedHash;
}

/**
 * Get OTP pepper from environment
 * In production, this MUST be set - we fail hard if not
 */
function getOTPPepper(): string {
  const pepper = process.env.OTP_SECRET_PEPPER;
  
  if (!pepper) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('CRITICAL: OTP_SECRET_PEPPER environment variable is required in production');
    }
    console.warn('[SECURITY WARNING] OTP_SECRET_PEPPER not set - using fallback for development only');
    return 'dev-only-insecure-pepper-do-not-use-in-production';
  }
  
  return pepper;
}
