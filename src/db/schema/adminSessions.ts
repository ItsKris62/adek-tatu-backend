import { pgTable, uuid, varchar, text, timestamp, index } from 'drizzle-orm/pg-core'
import { adminUsers } from './admins'

export const adminSessions = pgTable(
  'admin_sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    adminUserId: uuid('admin_user_id')
      .notNull()
      .references(() => adminUsers.id, { onDelete: 'cascade' }),
    tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }).defaultNow().notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: text('user_agent'),
  },
  (table) => [
    index('admin_sessions_token_hash_idx').on(table.tokenHash),
    index('admin_sessions_admin_user_id_idx').on(table.adminUserId),
    index('admin_sessions_expires_at_idx').on(table.expiresAt),
  ]
)

export type AdminSession = typeof adminSessions.$inferSelect
export type NewAdminSession = typeof adminSessions.$inferInsert
