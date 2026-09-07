import { pgTable, uuid, varchar, text, timestamp, index } from 'drizzle-orm/pg-core'
import { adminUsers } from './admins'

export const documentTypes = [
  'CONSTITUTION',
  'PARTY_RULES',
  'MANIFESTO',
  'MEMBERSHIP_FORM',
  'OTHER',
] as const

export const documentStatuses = ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const
export type DocumentStatus = (typeof documentStatuses)[number]
export type DocumentType = (typeof documentTypes)[number]

export const documents = pgTable(
  'documents',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    title: varchar('title', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 255 }).notNull().unique(),
    documentType: varchar('document_type', { length: 50 }).notNull().default('OTHER'),
    description: text('description'),
    fileUrl: text('file_url').notNull(),
    version: varchar('version', { length: 50 }),
    status: varchar('status', { length: 50 }).notNull().default('DRAFT'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdBy: uuid('created_by').references(() => adminUsers.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('documents_slug_idx').on(table.slug),
    index('documents_type_idx').on(table.documentType),
    index('documents_status_idx').on(table.status),
  ]
)

export type Document = typeof documents.$inferSelect
export type NewDocument = typeof documents.$inferInsert
