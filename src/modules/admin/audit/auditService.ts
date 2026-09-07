import { getDb } from '../../../db/client'
import { auditLogs } from '../../../db/schema/auditLogs'
import { desc, count } from 'drizzle-orm'
import { parsePagination, paginationMeta, type PaginationQuery } from '../../../utils/pagination'

export type CreateAuditLogParams = {
  actorAdminId?: string | null
  action: string
  entityType: string
  entityId?: string | null
  metadata?: Record<string, unknown> | null
  ipAddress?: string | null
  userAgent?: string | null
}

/**
 * Creates an immutable audit log record.
 * Never stores passwords, raw National IDs, session tokens, or credentials in metadata.
 */
export async function createAuditLog(
  params: CreateAuditLogParams,
  dbClient?: ReturnType<typeof getDb>
): Promise<void> {
  const db = dbClient ?? getDb()

  // Ensure sensitive keys are filtered out of metadata if passed
  const sanitizedMetadata: Record<string, unknown> = {}
  if (params.metadata) {
    for (const [key, value] of Object.entries(params.metadata)) {
      if (
        /password|secret|token|idNumber|nationalId|rawId|authTag|ciphertext/i.test(key)
      ) {
        continue
      }
      sanitizedMetadata[key] = value
    }
  }

  await db.insert(auditLogs).values({
    actorAdminId: params.actorAdminId,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    metadata: sanitizedMetadata,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
  })
}

export async function getAuditLogs(query: PaginationQuery) {
  const db = getDb()
  const { page, pageSize, offset } = parsePagination(query)

  const [totalCountResult] = await db.select({ value: count() }).from(auditLogs)
  const total = Number(totalCountResult?.value ?? 0)

  const logs = await db
    .select()
    .from(auditLogs)
    .orderBy(desc(auditLogs.createdAt))
    .limit(pageSize)
    .offset(offset)

  return {
    logs,
    pagination: paginationMeta(total, page, pageSize),
  }
}
