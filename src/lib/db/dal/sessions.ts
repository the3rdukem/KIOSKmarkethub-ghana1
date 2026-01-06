/**
 * Sessions Data Access Layer - PostgreSQL
 *
 * Server-side session management for authentication.
 * Sessions are stored in database, not localStorage.
 */

import { query } from '../index';
import { v4 as uuidv4 } from 'uuid';
import { createHash, randomBytes } from 'crypto';

export interface DbSession {
  id: string;
  user_id: string;
  user_role: string;
  token_hash: string;
  ip_address: string | null;
  user_agent: string | null;
  expires_at: string;
  created_at: string;
}

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

const DEBUG = process.env.NODE_ENV === 'development';
function debugLog(action: string, details: Record<string, unknown>): void {
  if (DEBUG) {
    console.log(`[SESSION:${action}]`, JSON.stringify(details, null, 2));
  }
}

export function generateSessionToken(): string {
  return randomBytes(32).toString('hex');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function createSession(
  userId: string,
  userRole: string,
  options?: {
    ipAddress?: string;
    userAgent?: string;
    durationMs?: number;
  }
): Promise<{ session: DbSession; token: string }> {
  debugLog('CREATE_START', { userId, userRole, hasOptions: !!options });

  const id = `sess_${uuidv4().replace(/-/g, '').substring(0, 24)}`;
  const token = generateSessionToken();
  const tokenHash = hashToken(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + (options?.durationMs || SESSION_DURATION_MS));

  debugLog('CREATE_DETAILS', {
    sessionId: id,
    tokenHashPrefix: tokenHash.substring(0, 8),
    expiresAt: expiresAt.toISOString()
  });

  try {
    await query(
      `INSERT INTO sessions (id, user_id, user_role, token_hash, ip_address, user_agent, expires_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        id,
        userId,
        userRole,
        tokenHash,
        options?.ipAddress || null,
        options?.userAgent || null,
        expiresAt.toISOString(),
        now.toISOString()
      ]
    );

    const session = await getSessionById(id);

    debugLog('CREATE_SUCCESS', {
      sessionId: id,
      userId: session?.user_id,
      role: session?.user_role
    });

    return { session: session!, token };
  } catch (error) {
    debugLog('CREATE_ERROR', {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

export async function getSessionById(id: string): Promise<DbSession | null> {
  const result = await query<DbSession>('SELECT * FROM sessions WHERE id = $1', [id]);
  return result.rows[0] || null;
}

export async function validateSession(token: string): Promise<DbSession | null> {
  debugLog('VALIDATE_START', { tokenPrefix: token.substring(0, 8) });

  const tokenHash = hashToken(token);
  const now = new Date().toISOString();

  debugLog('VALIDATE_QUERY', {
    hashPrefix: tokenHash.substring(0, 8),
    currentTime: now
  });

  const result = await query<DbSession>(
    'SELECT * FROM sessions WHERE token_hash = $1 AND expires_at > $2',
    [tokenHash, now]
  );

  const session = result.rows[0] || null;

  if (session) {
    debugLog('VALIDATE_SUCCESS', {
      sessionId: session.id,
      userId: session.user_id,
      role: session.user_role,
      expiresAt: session.expires_at
    });
  } else {
    const expiredResult = await query<DbSession>(
      'SELECT * FROM sessions WHERE token_hash = $1',
      [tokenHash]
    );
    const expiredSession = expiredResult.rows[0];

    if (expiredSession) {
      debugLog('VALIDATE_EXPIRED', {
        sessionId: expiredSession.id,
        expiresAt: expiredSession.expires_at,
        currentTime: now
      });
    } else {
      debugLog('VALIDATE_NOT_FOUND', { hashPrefix: tokenHash.substring(0, 8) });
    }
  }

  return session;
}

export async function extendSession(sessionId: string, durationMs?: number): Promise<boolean> {
  const expiresAt = new Date(Date.now() + (durationMs || SESSION_DURATION_MS));

  const result = await query(
    'UPDATE sessions SET expires_at = $1 WHERE id = $2',
    [expiresAt.toISOString(), sessionId]
  );

  const success = (result.rowCount ?? 0) > 0;
  debugLog('EXTEND', { sessionId, newExpiresAt: expiresAt.toISOString(), success });

  return success;
}

export async function deleteSession(sessionId: string): Promise<boolean> {
  const result = await query('DELETE FROM sessions WHERE id = $1', [sessionId]);
  const success = (result.rowCount ?? 0) > 0;

  debugLog('DELETE', { sessionId, success });

  return success;
}

export async function deleteSessionByToken(token: string): Promise<boolean> {
  const tokenHash = hashToken(token);
  const result = await query('DELETE FROM sessions WHERE token_hash = $1', [tokenHash]);
  const success = (result.rowCount ?? 0) > 0;

  debugLog('DELETE_BY_TOKEN', { hashPrefix: tokenHash.substring(0, 8), success });

  return success;
}

export async function deleteUserSessions(userId: string): Promise<number> {
  const result = await query('DELETE FROM sessions WHERE user_id = $1', [userId]);
  const deletedCount = result.rowCount ?? 0;

  debugLog('DELETE_USER_SESSIONS', { userId, deletedCount });

  return deletedCount;
}

export async function getUserSessions(userId: string): Promise<DbSession[]> {
  const now = new Date().toISOString();

  const result = await query<DbSession>(
    'SELECT * FROM sessions WHERE user_id = $1 AND expires_at > $2 ORDER BY created_at DESC',
    [userId, now]
  );

  return result.rows;
}

export async function cleanupExpiredSessions(): Promise<number> {
  const now = new Date().toISOString();

  const result = await query('DELETE FROM sessions WHERE expires_at <= $1', [now]);
  const deletedCount = result.rowCount ?? 0;

  debugLog('CLEANUP', { deletedCount });

  return deletedCount;
}

export async function getSessionStats(): Promise<{
  activeSessionCount: number;
  expiredSessionCount: number;
}> {
  const now = new Date().toISOString();

  const activeResult = await query<{ count: string }>(
    'SELECT COUNT(*) as count FROM sessions WHERE expires_at > $1',
    [now]
  );
  const expiredResult = await query<{ count: string }>(
    'SELECT COUNT(*) as count FROM sessions WHERE expires_at <= $1',
    [now]
  );

  return {
    activeSessionCount: parseInt(activeResult.rows[0]?.count || '0'),
    expiredSessionCount: parseInt(expiredResult.rows[0]?.count || '0'),
  };
}
