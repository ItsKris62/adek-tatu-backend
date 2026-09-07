import { pgTable, uuid, varchar, text, jsonb, timestamp, index } from 'drizzle-orm/pg-core'
import { adminUsers } from './admins'

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    actorAdminId: uuid('actor_admin_id').references(() => adminUsers.id, { onDelete: 'set null' }),
    action: varchar('action', { length: 100 }).notNull(),
    entityType: varchar('entity_type', { length: 50 }).notNull(),
    entityId: varchar('entity_id', { length: 255 }),
    metadata: jsonb('metadata'),
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('audit_logs_actor_admin_id_idx').on(table.actorAdminId),
    index('audit_logs_action_idx').on(table.action),
    index('audit_logs_entity_type_idx').on(table.entityType),
    index('audit_logs_created_at_idx').on(table.createdAt),
  ]
)

export type AuditLog = typeof auditLogs.$inferSelect
export type NewAuditLog = typeof auditLogs.$inferInsert
