import { eq, and, desc } from 'drizzle-orm'
import { getDb } from '../../db/client'
import { news, type NewsArticle } from '../../db/schema/news'
import type { AdminUser } from '../../db/schema/admins'
import { createAuditLog } from '../admin/audit/auditService'
import { NotFoundError, ConflictError } from '../../utils/errors'
import type { CreateNewsInput, UpdateNewsInput } from './newsSchemas'

export async function listPublicNews(): Promise<NewsArticle[]> {
  const db = getDb()
  return await db
    .select()
    .from(news)
    .where(eq(news.status, 'PUBLISHED'))
    .orderBy(desc(news.publishedAt))
}

export async function getPublicNewsBySlug(slug: string): Promise<NewsArticle> {
  const db = getDb()
  const rows = await db
    .select()
    .from(news)
    .where(and(eq(news.slug, slug), eq(news.status, 'PUBLISHED')))
    .limit(1)

  const article = rows[0]
  if (!article) {
    throw new NotFoundError('News article not found.')
  }
  return article
}

export async function listAdminNews(): Promise<NewsArticle[]> {
  const db = getDb()
  return await db.select().from(news).orderBy(desc(news.createdAt))
}

export async function getAdminNewsById(id: string): Promise<NewsArticle> {
  const db = getDb()
  const rows = await db.select().from(news).where(eq(news.id, id)).limit(1)
  const article = rows[0]
  if (!article) {
    throw new NotFoundError('News article not found.')
  }
  return article
}

export async function createNews(
  input: CreateNewsInput,
  adminUser: AdminUser,
  meta?: { ipAddress?: string; userAgent?: string }
): Promise<NewsArticle> {
  const db = getDb()

  const existing = await db.select({ id: news.id }).from(news).where(eq(news.slug, input.slug)).limit(1)
  if (existing.length > 0) {
    throw new ConflictError('A news article with this slug already exists.')
  }

  const publishedAt = input.status === 'PUBLISHED' ? new Date(input.publishedAt || Date.now()) : null

  const [newArticle] = await db
    .insert(news)
    .values({
      title: input.title,
      slug: input.slug,
      excerpt: input.excerpt,
      body: input.body,
      featuredImageUrl: input.featuredImageUrl,
      status: input.status,
      publishedAt,
      createdBy: adminUser.id,
      updatedBy: adminUser.id,
    })
    .returning()

  if (!newArticle) {
    throw new Error('Failed to create news article')
  }

  await createAuditLog({
    actorAdminId: adminUser.id,
    action: 'NEWS_CREATED',
    entityType: 'NEWS',
    entityId: newArticle.id,
    metadata: { title: newArticle.title, slug: newArticle.slug, status: newArticle.status },
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
  })

  return newArticle
}

export async function updateNews(
  id: string,
  input: UpdateNewsInput,
  adminUser: AdminUser,
  meta?: { ipAddress?: string; userAgent?: string }
): Promise<NewsArticle> {
  const db = getDb()

  const existing = await db.select().from(news).where(eq(news.id, id)).limit(1)
  const current = existing[0]
  if (!current) {
    throw new NotFoundError('News article not found.')
  }

  if (input.slug && input.slug !== current.slug) {
    const slugCheck = await db.select({ id: news.id }).from(news).where(eq(news.slug, input.slug)).limit(1)
    if (slugCheck.length > 0) {
      throw new ConflictError('A news article with this slug already exists.')
    }
  }

  const publishedAt =
    input.status === 'PUBLISHED'
      ? input.publishedAt
        ? new Date(input.publishedAt)
        : current.publishedAt || new Date()
      : input.status === 'DRAFT' || input.status === 'ARCHIVED'
        ? null
        : current.publishedAt

  const [updated] = await db
    .update(news)
    .set({
      ...(input.title ? { title: input.title } : {}),
      ...(input.slug ? { slug: input.slug } : {}),
      ...(input.excerpt ? { excerpt: input.excerpt } : {}),
      ...(input.body ? { body: input.body } : {}),
      ...(input.featuredImageUrl !== undefined ? { featuredImageUrl: input.featuredImageUrl } : {}),
      ...(input.status ? { status: input.status } : {}),
      publishedAt,
      updatedBy: adminUser.id,
      updatedAt: new Date(),
    })
    .where(eq(news.id, id))
    .returning()

  if (!updated) {
    throw new Error('Failed to update news article')
  }

  await createAuditLog({
    actorAdminId: adminUser.id,
    action: 'NEWS_UPDATED',
    entityType: 'NEWS',
    entityId: id,
    metadata: { title: updated.title, status: updated.status },
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
  })

  return updated
}

export async function archiveNews(
  id: string,
  adminUser: AdminUser,
  meta?: { ipAddress?: string; userAgent?: string }
): Promise<NewsArticle> {
  return await updateNews(id, { status: 'ARCHIVED' }, adminUser, meta)
}
