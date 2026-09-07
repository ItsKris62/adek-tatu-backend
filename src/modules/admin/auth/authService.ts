import crypto from 'node:crypto'
import { eq } from 'drizzle-orm'
import { getDb } from '../../../db/client'
import { adminUsers, type AdminUser } from '../../../db/schema/admins'
import { normalizeEmail } from '../../../utils/normalize'
import { verifyPassword } from '../../../security/passwords'
import { createAdminSession, revokeSessionToken } from '../../../security/sessions'
import { decryptTotpSecret, verifyTotpCode } from '../../../security/totp'
import { createAuditLog } from '../audit/auditService'
import { AuthenticationError, ValidationError } from '../../../utils/errors'
import type { LoginInput, MfaVerifyInput } from './authSchemas'

type PreAuthChallenge = {
  adminUserId: string
  expiresAt: number
}

// In-memory ephemeral pre-auth challenge cache (TTL: 5 minutes)
const preAuthChallenges = new Map<string, PreAuthChallenge>()

// Periodically clean expired challenges
setInterval(() => {
  const now = Date.now()
  for (const [token, challenge] of preAuthChallenges.entries()) {
    if (challenge.expiresAt < now) {
      preAuthChallenges.delete(token)
    }
  }
}, 60000)

export async function loginAdmin(
  input: LoginInput,
  meta?: { ipAddress?: string; userAgent?: string }
): Promise<
  | { mfaRequired: false; sessionToken: string; user: { id: string; email: string; role: string } }
  | { mfaRequired: true; preAuthToken: string }
> {
  const db = getDb()
  const normalizedEmail = normalizeEmail(input.email)

  const users = await db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.normalizedEmail, normalizedEmail))
    .limit(1)

  const user = users[0]

  if (!user || !user.isActive) {
    // Audit failed attempt without revealing if email exists
    await createAuditLog({
      action: 'ADMIN_LOGIN_FAILURE',
      entityType: 'AUTH',
      entityId: normalizedEmail,
      metadata: { reason: 'INVALID_CREDENTIALS' },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    })
    throw new AuthenticationError('Invalid email or password.')
  }

  const validPassword = await verifyPassword(input.password, user.passwordHash)
  if (!validPassword) {
    await createAuditLog({
      actorAdminId: user.id,
      action: 'ADMIN_LOGIN_FAILURE',
      entityType: 'AUTH',
      entityId: user.id,
      metadata: { reason: 'INVALID_PASSWORD' },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    })
    throw new AuthenticationError('Invalid email or password.')
  }

  // Check if user has MFA enabled
  if (user.mfaEnabled && user.mfaSecretEncrypted) {
    const preAuthToken = crypto.randomBytes(32).toString('hex')
    preAuthChallenges.set(preAuthToken, {
      adminUserId: user.id,
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 min TTL
    })

    return {
      mfaRequired: true,
      preAuthToken,
    }
  }

  // Create full session
  const { token } = await createAdminSession(user.id, meta)
  await db
    .update(adminUsers)
    .set({ lastLoginAt: new Date(), updatedAt: new Date() })
    .where(eq(adminUsers.id, user.id))

  await createAuditLog({
    actorAdminId: user.id,
    action: 'ADMIN_LOGIN_SUCCESS',
    entityType: 'AUTH',
    entityId: user.id,
    metadata: { mfaUsed: false },
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
  })

  return {
    mfaRequired: false,
    sessionToken: token,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
    },
  }
}

export async function verifyMfaAndLogin(
  input: MfaVerifyInput,
  meta?: { ipAddress?: string; userAgent?: string }
): Promise<{ sessionToken: string; user: { id: string; email: string; role: string } }> {
  const challenge = preAuthChallenges.get(input.preAuthToken)
  if (!challenge || challenge.expiresAt < Date.now()) {
    preAuthChallenges.delete(input.preAuthToken)
    throw new AuthenticationError('MFA challenge expired or invalid. Please log in again.')
  }

  const db = getDb()
  const users = await db.select().from(adminUsers).where(eq(adminUsers.id, challenge.adminUserId)).limit(1)
  const user = users[0]

  if (!user || !user.isActive || !user.mfaSecretEncrypted) {
    preAuthChallenges.delete(input.preAuthToken)
    throw new AuthenticationError('MFA verification failed.')
  }

  const secretBase32 = decryptTotpSecret(user.mfaSecretEncrypted)
  const isValid = verifyTotpCode(input.totpCode, secretBase32)

  if (!isValid) {
    await createAuditLog({
      actorAdminId: user.id,
      action: 'ADMIN_MFA_FAILURE',
      entityType: 'AUTH',
      entityId: user.id,
      metadata: { reason: 'INVALID_TOTP' },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    })
    throw new ValidationError('Invalid 6-digit verification code.')
  }

  // Consume challenge token
  preAuthChallenges.delete(input.preAuthToken)

  const { token } = await createAdminSession(user.id, meta)
  await db
    .update(adminUsers)
    .set({ lastLoginAt: new Date(), updatedAt: new Date() })
    .where(eq(adminUsers.id, user.id))

  await createAuditLog({
    actorAdminId: user.id,
    action: 'ADMIN_LOGIN_SUCCESS',
    entityType: 'AUTH',
    entityId: user.id,
    metadata: { mfaUsed: true },
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
  })

  return {
    sessionToken: token,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
    },
  }
}

export async function logoutAdmin(
  sessionToken: string,
  adminUser: AdminUser,
  meta?: { ipAddress?: string; userAgent?: string }
): Promise<void> {
  await revokeSessionToken(sessionToken)
  await createAuditLog({
    actorAdminId: adminUser.id,
    action: 'ADMIN_LOGOUT',
    entityType: 'AUTH',
    entityId: adminUser.id,
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
  })
}
