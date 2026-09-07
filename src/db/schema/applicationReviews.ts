import { pgTable, uuid, varchar, text, timestamp, index } from 'drizzle-orm/pg-core'
import { adminUsers } from './admins'
import { membershipApplications } from './membershipApplications'

export const applicationReviews = pgTable(
  'application_reviews',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    applicationId: uuid('application_id')
      .notNull()
      .references(() => membershipApplications.id, { onDelete: 'cascade' }),
    adminUserId: uuid('admin_user_id')
      .notNull()
      .references(() => adminUsers.id, { onDelete: 'restrict' }),
    action: varchar('action', { length: 100 }).notNull(),
    previousStatus: varchar('previous_status', { length: 50 }).notNull(),
    newStatus: varchar('new_status', { length: 50 }).notNull(),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('app_reviews_application_id_idx').on(table.applicationId),
    index('app_reviews_admin_user_id_idx').on(table.adminUserId),
    index('app_reviews_created_at_idx').on(table.createdAt),
  ]
)

export type ApplicationReview = typeof applicationReviews.$inferSelect
export type NewApplicationReview = typeof applicationReviews.$inferInsert
