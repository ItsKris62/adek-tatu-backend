import { pgTable, uuid, varchar, text, boolean, timestamp, index } from 'drizzle-orm/pg-core'

export const adminRoles = ['SUPER_ADMIN', 'CONTENT_EDITOR', 'RECRUITMENT_OFFICER'] as const
export type AdminRole = (typeof adminRoles)[number]

export const adminUsers = pgTable(
  'admin_users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    email: varchar('email', { length: 255 }).notNull(),
    normalizedEmail: varchar('normalized_email', { length: 255 }).notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    role: varchar('role', { length: 50 }).notNull().default('RECRUITMENT_OFFICER'),
    isActive: boolean('is_active').notNull().default(true),
    mfaEnabled: boolean('mfa_enabled').notNull().default(false),
    mfaSecretEncrypted: text('mfa_secret_encrypted'),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('admin_users_normalized_email_idx').on(table.normalizedEmail),
    index('admin_users_role_idx').on(table.role),
  ]
)

export type AdminUser = typeof adminUsers.$inferSelect
export type NewAdminUser = typeof adminUsers.$inferInsert
