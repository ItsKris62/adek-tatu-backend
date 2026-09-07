import { eq, and, desc } from 'drizzle-orm'
import { getDb } from '../../db/client'
import { documents, type Document, type DocumentType } from '../../db/schema/documents'
import type { AdminUser } from '../../db/schema/admins'
import { createAuditLog } from '../admin/audit/auditService'
import { NotFoundError, ConflictError } from '../../utils/errors'
import type { CreateDocumentInput, UpdateDocumentInput } from './documentSchemas'

export async function listPublicDocuments(type?: DocumentType): Promise<Document[]> {
  const db = getDb()
  const conditions = [eq(documents.status, 'PUBLISHED')]
  if (type) {
    conditions.push(eq(documents.documentType, type))
  }

  return await db
    .select()
    .from(documents)
    .where(and(...conditions))
    .orderBy(desc(documents.publishedAt))
}

export async function listAdminDocuments(): Promise<Document[]> {
  const db = getDb()
  return await db.select().from(documents).orderBy(desc(documents.createdAt))
}

export async function createDocument(
  input: CreateDocumentInput,
  adminUser: AdminUser,
  meta?: { ipAddress?: string; userAgent?: string }
): Promise<Document> {
  const db = getDb()

  const existing = await db.select({ id: documents.id }).from(documents).where(eq(documents.slug, input.slug)).limit(1)
  if (existing.length > 0) {
    throw new ConflictError('A document with this slug already exists.')
  }

  const publishedAt = input.status === 'PUBLISHED' ? new Date(input.publishedAt || Date.now()) : null

  const [created] = await db
    .insert(documents)
    .values({
      title: input.title,
      slug: input.slug,
      documentType: input.documentType,
      description: input.description,
      fileUrl: input.fileUrl,
      version: input.version,
      status: input.status,
      publishedAt,
      createdBy: adminUser.id,
    })
    .returning()

  if (!created) {
    throw new Error('Failed to create document')
  }

  await createAuditLog({
    actorAdminId: adminUser.id,
    action: 'DOCUMENT_CREATED',
    entityType: 'DOCUMENT',
    entityId: created.id,
    metadata: { title: created.title, slug: created.slug, type: created.documentType },
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
  })

  return created
}

export async function updateDocument(
  id: string,
  input: UpdateDocumentInput,
  adminUser: AdminUser,
  meta?: { ipAddress?: string; userAgent?: string }
): Promise<Document> {
  const db = getDb()

  const [updated] = await db
    .update(documents)
    .set({
      ...(input.title ? { title: input.title } : {}),
      ...(input.slug ? { slug: input.slug } : {}),
      ...(input.documentType ? { documentType: input.documentType } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.fileUrl ? { fileUrl: input.fileUrl } : {}),
      ...(input.version !== undefined ? { version: input.version } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(input.publishedAt ? { publishedAt: new Date(input.publishedAt) } : {}),
      updatedAt: new Date(),
    })
    .where(eq(documents.id, id))
    .returning()

  if (!updated) {
    throw new NotFoundError('Document not found.')
  }

  await createAuditLog({
    actorAdminId: adminUser.id,
    action: 'DOCUMENT_UPDATED',
    entityType: 'DOCUMENT',
    entityId: id,
    metadata: { title: updated.title },
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
  })

  return updated
}

export async function archiveDocument(
  id: string,
  adminUser: AdminUser,
  meta?: { ipAddress?: string; userAgent?: string }
): Promise<Document> {
  return await updateDocument(id, { status: 'ARCHIVED' }, adminUser, meta)
}
