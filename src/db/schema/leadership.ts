import { pgTable, uuid, varchar, text, integer, timestamp, index } from 'drizzle-orm/pg-core'

export const leadershipStatuses = ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const
export type LeadershipStatus = (typeof leadershipStatuses)[number]

export const leadership = pgTable(
  'leadership',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    position: varchar('position', { length: 255 }).notNull(),
    bio: text('bio'),
    imageUrl: text('image_url'),
    displayOrder: integer('display_order').notNull().default(0),
    status: varchar('status', { length: 50 }).notNull().default('DRAFT'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('leadership_status_idx').on(table.status),
    index('leadership_display_order_idx').on(table.displayOrder),
  ]
)

export type LeadershipMember = typeof leadership.$inferSelect
export type NewLeadershipMember = typeof leadership.$inferInsert
