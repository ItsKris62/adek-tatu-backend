import { eq, and, ne } from 'drizzle-orm'
import { getDb } from '../../db/client'
import { siteContent, type SiteContent } from '../../db/schema/siteContent'
import type { AdminUser } from '../../db/schema/admins'
import { createAuditLog } from '../admin/audit/auditService'
import { NotFoundError } from '../../utils/errors'
import type { UpdateSiteContentInput } from './siteContentSchemas'

export async function getPublicSiteContent(key: string): Promise<SiteContent> {
  const db = getDb()
  const rows = await db
    .select()
    .from(siteContent)
    .where(and(eq(siteContent.key, key), ne(siteContent.status, 'DO_NOT_PUBLISH')))
    .limit(1)

  const section = rows[0]
  if (!section) {
    throw new NotFoundError('Content section not found or withheld from publication.')
  }
  return section
}

export async function listAdminSiteContent(): Promise<SiteContent[]> {
  const db = getDb()
  return await db.select().from(siteContent)
}

export async function upsertSiteContent(
  key: string,
  input: UpdateSiteContentInput,
  adminUser: AdminUser,
  meta?: { ipAddress?: string; userAgent?: string }
): Promise<SiteContent> {
  const db = getDb()

  const [upserted] = await db
    .insert(siteContent)
    .values({
      key,
      title: input.title || key,
      contentJson: input.contentJson,
      status: input.status,
      updatedBy: adminUser.id,
    })
    .onConflictDoUpdate({
      target: siteContent.key,
      set: {
        ...(input.title ? { title: input.title } : {}),
        contentJson: input.contentJson,
        status: input.status,
        updatedBy: adminUser.id,
        updatedAt: new Date(),
      },
    })
    .returning()

  if (!upserted) {
    throw new Error('Failed to update content section')
  }

  await createAuditLog({
    actorAdminId: adminUser.id,
    action: 'SITE_CONTENT_UPDATED',
    entityType: 'SITE_CONTENT',
    entityId: key,
    metadata: { key, status: upserted.status },
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
  })

  return upserted
}
