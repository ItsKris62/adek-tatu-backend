import { eq } from 'drizzle-orm'
import { getDb } from '../../../db/client'
import { adminUsers, type AdminUser } from '../../../db/schema/admins'
import { hashPassword } from '../../../security/passwords'
import { normalizeEmail } from '../../../utils/normalize'
import { generateTotpSecret, encryptTotpSecret, generateTotpUri } from '../../../security/totp'
import { createAuditLog } from '../audit/auditService'
import { ConflictError, NotFoundError } from '../../../utils/errors'
import type { CreateAdminUserInput } from '../auth/authSchemas'

export async function listAdminUsers() {
  const db = getDb()
  return await db
    .select({
      id: adminUsers.id,
      email: adminUsers.email,
      role: adminUsers.role,
      isActive: adminUsers.isActive,
      mfaEnabled: adminUsers.mfaEnabled,
      lastLoginAt: adminUsers.lastLoginAt,
      createdAt: adminUsers.createdAt,
    })
    .from(adminUsers)
    .orderBy(adminUsers.createdAt)
}

export async function createAdminUser(
  input: CreateAdminUserInput,
  actorAdmin?: AdminUser,
  meta?: { ipAddress?: string; userAgent?: string }
) {
  const db = getDb()
  const normalizedEmail = normalizeEmail(input.email)

  const existing = await db
    .select({ id: adminUsers.id })
    .from(adminUsers)
    .where(eq(adminUsers.normalizedEmail, normalizedEmail))
    .limit(1)

  if (existing.length > 0) {
    throw new ConflictError('An admin user with this email already exists.')
  }

  const passwordHash = await hashPassword(input.password)

  let mfaSecretEncrypted: string | null = null
  let totpUri: string | null = null

  if (input.enableMfa) {
    const rawSecret = generateTotpSecret()
    mfaSecretEncrypted = encryptTotpSecret(rawSecret)
    totpUri = generateTotpUri(input.email, rawSecret)
  }

  const [newUser] = await db
    .insert(adminUsers)
    .values({
      email: input.email.trim(),
      normalizedEmail,
      passwordHash,
      role: input.role,
      isActive: true,
      mfaEnabled: input.enableMfa,
      mfaSecretEncrypted,
    })
    .returning({
      id: adminUsers.id,
      email: adminUsers.email,
      role: adminUsers.role,
      isActive: adminUsers.isActive,
      mfaEnabled: adminUsers.mfaEnabled,
      createdAt: adminUsers.createdAt,
    })

  if (!newUser) {
    throw new Error('Failed to create admin user')
  }

  await createAuditLog({
    actorAdminId: actorAdmin?.id ?? null,
    action: 'USER_CREATED',
    entityType: 'ADMIN_USER',
    entityId: newUser.id,
    metadata: { email: newUser.email, role: newUser.role, mfaEnabled: newUser.mfaEnabled },
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
  })

  return {
    user: newUser,
    totpUri,
  }
}

export async function toggleAdminUserStatus(
  id: string,
  isActive: boolean,
  actorAdmin: AdminUser,
  meta?: { ipAddress?: string; userAgent?: string }
) {
  const db = getDb()
  const [updated] = await db
    .update(adminUsers)
    .set({ isActive, updatedAt: new Date() })
    .where(eq(adminUsers.id, id))
    .returning({
      id: adminUsers.id,
      email: adminUsers.email,
      role: adminUsers.role,
      isActive: adminUsers.isActive,
    })

  if (!updated) {
    throw new NotFoundError('Admin user not found.')
  }

  await createAuditLog({
    actorAdminId: actorAdmin.id,
    action: isActive ? 'USER_ENABLED' : 'USER_DISABLED',
    entityType: 'ADMIN_USER',
    entityId: id,
    metadata: { email: updated.email },
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
  })

  return updated
}
