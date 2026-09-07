import { eq, or, and, inArray } from 'drizzle-orm'
import { getDb } from '../../db/client'
import { membershipApplications } from '../../db/schema/membershipApplications'
import { normalizeEmail, normalizePhone } from '../../utils/normalize'
import { createIdHmac, maskId, hashConsentText } from '../../security/hashing'
import { encryptData } from '../../security/encryption'
import { generateApplicationReference } from '../../utils/references'
import { ConflictError, NotFoundError } from '../../utils/errors'
import type { SubmitMembershipInput } from './membershipSchemas'

// Active statuses that block duplicate submissions in the demo
const ACTIVE_BLOCKING_STATUSES: string[] = [
  'SUBMITTED',
  'UNDER_REVIEW',
  'CORRECTION_REQUIRED',
  'APPROVED',
]

export async function submitApplication(
  input: SubmitMembershipInput
): Promise<{ reference: string; status: string; submittedAt: Date }> {
  const db = getDb()

  const normalizedEmail = normalizeEmail(input.email)
  const normalizedPhone = normalizePhone(input.phone)
  const idDocumentHmac = createIdHmac(input.idNumber)
  const idDocumentMasked = maskId(input.idNumber)
  const idDocumentEncrypted = encryptData(input.idNumber.trim())

  const consentTextHash = input.consentText ? hashConsentText(input.consentText) : null
  const consentTimestamp = new Date()

  // DEMO BUSINESS RULE — Duplicate detection against active states
  const existing = await db
    .select({ id: membershipApplications.id })
    .from(membershipApplications)
    .where(
      and(
        inArray(membershipApplications.status, ACTIVE_BLOCKING_STATUSES),
        or(
          eq(membershipApplications.idDocumentHmac, idDocumentHmac),
          eq(membershipApplications.normalizedEmail, normalizedEmail),
          eq(membershipApplications.normalizedPhone, normalizedPhone)
        )
      )
    )
    .limit(1)

  if (existing.length > 0) {
    // Privacy-preserving conflict response
    throw new ConflictError(
      'An application with these details is already being processed or approved. If you need assistance, please contact the recruitment team.'
    )
  }

  // Generate reference with retry on collision
  let reference = generateApplicationReference()
  let inserted = false
  let attempts = 0

  while (!inserted && attempts < 3) {
    attempts++
    try {
      await db.insert(membershipApplications).values({
        applicationReference: reference,
        fullName: input.fullName.trim(),
        email: input.email.trim(),
        normalizedEmail,
        phone: input.phone.trim(),
        normalizedPhone,
        county: input.county.trim(),
        constituency: input.constituency.trim(),
        occupation: input.occupation.trim(),
        idDocumentEncrypted,
        idDocumentHmac,
        idDocumentMasked,
        consentGiven: input.consent,
        consentTimestamp,
        consentVersion: input.consentVersion,
        consentTextHash,
        status: 'SUBMITTED',
        submittedAt: consentTimestamp,
      })
      inserted = true
    } catch (err: any) {
      if (err?.code === '23505' && err?.constraint?.includes('application_reference')) {
        // Collision on random reference, generate another and retry
        reference = generateApplicationReference()
      } else {
        throw err
      }
    }
  }

  return {
    reference,
    status: 'SUBMITTED',
    submittedAt: consentTimestamp,
  }
}

export async function getApplicationStatus(
  reference: string
): Promise<{ reference: string; status: string; submittedAt: Date; updatedAt: Date }> {
  const db = getDb()

  const results = await db
    .select({
      reference: membershipApplications.applicationReference,
      status: membershipApplications.status,
      submittedAt: membershipApplications.submittedAt,
      updatedAt: membershipApplications.updatedAt,
    })
    .from(membershipApplications)
    .where(eq(membershipApplications.applicationReference, reference.trim()))
    .limit(1)

  const app = results[0]
  if (!app) {
    throw new NotFoundError('Application reference not found.')
  }

  return app
}
