import crypto from 'node:crypto'
import { eq, and, isNull, gt } from 'drizzle-orm'
import { getDb } from '../db/client'
import { adminSessions } from '../db/schema/adminSessions'
import { adminUsers, type AdminUser } from '../db/schema/admins'
import { hashToken } from './hashing'
import { getEnv } from '../config/env'

export type ValidatedSession = {
  session: typeof adminSessions.$inferSelect
  user: AdminUser
}

/**
 * Generates an opaque cryptographically secure 32-byte session token (64 hex characters).
 */
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

/**
 * Creates a new database-backed session for an admin user.
 */
export async function createAdminSession(
  adminUserId: string,
  meta?: { ipAddress?: string; userAgent?: string }
): Promise<{ token: string; expiresAt: Date }> {
  const db = getDb()
  const env = getEnv()
  const token = generateSessionToken()
  const tokenHash = hashToken(token)
  
  const expiresAt = new Date(Date.now() + env.SESSION_TTL_HOURS * 60 * 60 * 1000)

  await db.insert(adminSessions).values({
    adminUserId,
    tokenHash,
    expiresAt,
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
  })

  return { token, expiresAt }
}

/**
 * Validates a session token, returning the session record and admin user if active.
 */
export async function validateSessionToken(token: string): Promise<ValidatedSession | null> {
  const db = getDb()
  const tokenHash = hashToken(token)
  const now = new Date()

  const results = await db
    .select({
      session: adminSessions,
      user: adminUsers,
    })
    .from(adminSessions)
    .innerJoin(adminUsers, eq(adminSessions.adminUserId, adminUsers.id))
    .where(
      and(
        eq(adminSessions.tokenHash, tokenHash),
        isNull(adminSessions.revokedAt),
        gt(adminSessions.expiresAt, now),
        eq(adminUsers.isActive, true)
      )
    )
    .limit(1)

  const row = results[0]
  if (!row) {
    return null
  }

  // Update lastUsedAt in the background
  db.update(adminSessions)
    .set({ lastUsedAt: now })
    .where(eq(adminSessions.id, row.session.id))
    .catch((err) => console.error('Failed to update session lastUsedAt', err))

  return row
}

/**
 * Revokes a session token.
 */
export async function revokeSessionToken(token: string): Promise<void> {
  const db = getDb()
  const tokenHash = hashToken(token)
  await db
    .update(adminSessions)
    .set({ revokedAt: new Date() })
    .where(eq(adminSessions.tokenHash, tokenHash))
}
