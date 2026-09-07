import { eq, asc } from 'drizzle-orm'
import { getDb } from '../../db/client'
import { leadership, type LeadershipMember } from '../../db/schema/leadership'
import type { AdminUser } from '../../db/schema/admins'
import { createAuditLog } from '../admin/audit/auditService'
import { NotFoundError } from '../../utils/errors'
import type { CreateLeadershipInput, UpdateLeadershipInput } from './leadershipSchemas'

export async function listPublicLeadership(): Promise<LeadershipMember[]> {
  const db = getDb()
  return await db
    .select()
    .from(leadership)
    .where(eq(leadership.status, 'PUBLISHED'))
    .orderBy(asc(leadership.displayOrder))
}

export async function listAdminLeadership(): Promise<LeadershipMember[]> {
  const db = getDb()
  return await db.select().from(leadership).orderBy(asc(leadership.displayOrder))
}

export async function createLeadership(
  input: CreateLeadershipInput,
  adminUser: AdminUser,
  meta?: { ipAddress?: string; userAgent?: string }
): Promise<LeadershipMember> {
  const db = getDb()

  const [created] = await db
    .insert(leadership)
    .values({
      name: input.name,
      position: input.position,
      bio: input.bio,
      imageUrl: input.imageUrl,
      displayOrder: input.displayOrder,
      status: input.status,
    })
    .returning()

  if (!created) {
    throw new Error('Failed to create leadership member')
  }

  await createAuditLog({
    actorAdminId: adminUser.id,
    action: 'LEADERSHIP_CREATED',
    entityType: 'LEADERSHIP',
    entityId: created.id,
    metadata: { name: created.name, position: created.position },
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
  })

  return created
}

export async function updateLeadership(
  id: string,
  input: UpdateLeadershipInput,
  adminUser: AdminUser,
  meta?: { ipAddress?: string; userAgent?: string }
): Promise<LeadershipMember> {
  const db = getDb()

  const [updated] = await db
    .update(leadership)
    .set({
      ...(input.name ? { name: input.name } : {}),
      ...(input.position ? { position: input.position } : {}),
      ...(input.bio !== undefined ? { bio: input.bio } : {}),
      ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl } : {}),
      ...(input.displayOrder !== undefined ? { displayOrder: input.displayOrder } : {}),
      ...(input.status ? { status: input.status } : {}),
      updatedAt: new Date(),
    })
    .where(eq(leadership.id, id))
    .returning()

  if (!updated) {
    throw new NotFoundError('Leadership member not found.')
  }

  await createAuditLog({
    actorAdminId: adminUser.id,
    action: 'LEADERSHIP_UPDATED',
    entityType: 'LEADERSHIP',
    entityId: id,
    metadata: { name: updated.name, position: updated.position },
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
  })

  return updated
}

export async function archiveLeadership(
  id: string,
  adminUser: AdminUser,
  meta?: { ipAddress?: string; userAgent?: string }
): Promise<LeadershipMember> {
  return await updateLeadership(id, { status: 'ARCHIVED' }, adminUser, meta)
}
