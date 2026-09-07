import { pgTable, uuid, varchar, text, timestamp, index } from 'drizzle-orm/pg-core'
import { adminUsers } from './admins'

export const newsStatuses = ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const
export type NewsStatus = (typeof newsStatuses)[number]

export const news = pgTable(
  'news',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    title: varchar('title', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 255 }).notNull().unique(),
    excerpt: text('excerpt').notNull(),
    body: text('body').notNull(),
    featuredImageUrl: text('featured_image_url'),
    status: varchar('status', { length: 50 }).notNull().default('DRAFT'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdBy: uuid('created_by').references(() => adminUsers.id, { onDelete: 'set null' }),
    updatedBy: uuid('updated_by').references(() => adminUsers.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('news_slug_idx').on(table.slug),
    index('news_status_idx').on(table.status),
    index('news_published_at_idx').on(table.publishedAt),
  ]
)

export type NewsArticle = typeof news.$inferSelect
export type NewNewsArticle = typeof news.$inferInsert
