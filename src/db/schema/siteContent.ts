import { pgTable, uuid, varchar, jsonb, timestamp, index } from 'drizzle-orm/pg-core'
import { adminUsers } from './admins'

export const siteContentStatuses = [
  'APPROVED',
  'DRAFT',
  'PENDING_CLIENT_INPUT',
  'PLACEHOLDER',
  'DO_NOT_PUBLISH',
] as const

export type SiteContentStatus = (typeof siteContentStatuses)[number]

export const siteContent = pgTable(
  'site_content',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    key: varchar('key', { length: 100 }).notNull().unique(),
    title: varchar('title', { length: 255 }).notNull(),
    contentJson: jsonb('content_json').notNull(),
    status: varchar('status', { length: 50 }).notNull().default('DRAFT'),
    updatedBy: uuid('updated_by').references(() => adminUsers.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('site_content_key_idx').on(table.key),
    index('site_content_status_idx').on(table.status),
  ]
)

export type SiteContent = typeof siteContent.$inferSelect
export type NewSiteContent = typeof siteContent.$inferInsert
