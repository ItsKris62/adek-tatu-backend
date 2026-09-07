import { pgTable, uuid, varchar, text, boolean, timestamp, index } from 'drizzle-orm/pg-core'
import { adminUsers } from './admins'

export const applicationStatuses = [
  'SUBMITTED',
  'UNDER_REVIEW',
  'CORRECTION_REQUIRED',
  'APPROVED',
  'REJECTED',
  'WITHDRAWN',
] as const

export type ApplicationStatus = (typeof applicationStatuses)[number]

export const membershipApplications = pgTable(
  'membership_applications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    applicationReference: varchar('application_reference', { length: 64 }).notNull().unique(),
    fullName: varchar('full_name', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }).notNull(),
    normalizedEmail: varchar('normalized_email', { length: 255 }).notNull(),
    phone: varchar('phone', { length: 50 }).notNull(),
    normalizedPhone: varchar('normalized_phone', { length: 50 }).notNull(),
    county: varchar('county', { length: 100 }).notNull(),
    constituency: varchar('constituency', { length: 100 }).notNull(),
    occupation: varchar('occupation', { length: 150 }).notNull(),
    
    // Encrypted envelope containing ciphertext, iv, authTag
    idDocumentEncrypted: text('id_document_encrypted').notNull(),
    // HMAC-SHA-256 for privacy-preserving duplicate detection
    idDocumentHmac: varchar('id_document_hmac', { length: 64 }).notNull(),
    // Safe masked representation for authorized recruitment officer views (e.g. ******1234)
    idDocumentMasked: varchar('id_document_masked', { length: 20 }).notNull(),
    
    // Consent tracking (DEMO / PENDING APPROVED MEMBERSHIP FORM)
    consentGiven: boolean('consent_given').notNull(),
    consentTimestamp: timestamp('consent_timestamp', { withTimezone: true }).notNull(),
    consentVersion: varchar('consent_version', { length: 50 }).notNull(),
    consentTextHash: varchar('consent_text_hash', { length: 64 }),

    status: varchar('status', { length: 50 }).notNull().default('SUBMITTED'),
    submittedAt: timestamp('submitted_at', { withTimezone: true }).defaultNow().notNull(),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    reviewedBy: uuid('reviewed_by').references(() => adminUsers.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('membership_app_ref_idx').on(table.applicationReference),
    index('membership_app_id_hmac_idx').on(table.idDocumentHmac),
    index('membership_app_norm_email_idx').on(table.normalizedEmail),
    index('membership_app_norm_phone_idx').on(table.normalizedPhone),
    index('membership_app_status_idx').on(table.status),
    index('membership_app_submitted_at_idx').on(table.submittedAt),
  ]
)

export type MembershipApplication = typeof membershipApplications.$inferSelect
export type NewMembershipApplication = typeof membershipApplications.$inferInsert
