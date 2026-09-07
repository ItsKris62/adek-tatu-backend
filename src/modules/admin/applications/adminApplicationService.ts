import { eq, and, or, ilike, gte, lte, desc, count, type SQL } from 'drizzle-orm'
import { getDb } from '../../../db/client'
import { membershipApplications, type ApplicationStatus } from '../../../db/schema/membershipApplications'
import { applicationReviews } from '../../../db/schema/applicationReviews'
import { adminUsers, type AdminUser } from '../../../db/schema/admins'
import { parsePagination, paginationMeta } from '../../../utils/pagination'
import { createAuditLog } from '../audit/auditService'
import { NotFoundError, ValidationError } from '../../../utils/errors'
import type { ApplicationFilterQuery, UpdateApplicationStatusInput, AddApplicationReviewInput } from './adminApplicationSchemas'

// Allowed status transitions state machine
const ALLOWED_TRANSITIONS: Record<string, ApplicationStatus[]> = {
  SUBMITTED: ['UNDER_REVIEW'],
  UNDER_REVIEW: ['APPROVED', 'REJECTED', 'CORRECTION_REQUIRED'],
  CORRECTION_REQUIRED: ['SUBMITTED'],
  APPROVED: [], // Terminal for standard officers
  REJECTED: [], // Terminal for standard officers
  WITHDRAWN: [],
}

export async function listAdminApplications(query: ApplicationFilterQuery) {
  const db = getDb()
  const { page, pageSize, offset } = parsePagination(query)

  const conditions: SQL[] = []

  if (query.status && query.status !== 'ALL') {
    conditions.push(eq(membershipApplications.status, query.status))
  }

  if (query.search && query.search.trim().length > 0) {
    const term = `%${query.search.trim()}%`
    conditions.push(
      or(
        ilike(membershipApplications.applicationReference, term),
        ilike(membershipApplications.fullName, term),
        ilike(membershipApplications.county, term),
        ilike(membershipApplications.constituency, term),
        ilike(membershipApplications.normalizedEmail, term),
        ilike(membershipApplications.normalizedPhone, term)
      )!
    )
  }

  if (query.startDate) {
    conditions.push(gte(membershipApplications.submittedAt, new Date(query.startDate)))
  }

  if (query.endDate) {
    conditions.push(lte(membershipApplications.submittedAt, new Date(query.endDate)))
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const [totalCountResult] = await db
    .select({ value: count() })
    .from(membershipApplications)
    .where(whereClause)

  const total = Number(totalCountResult?.value ?? 0)

  const rows = await db
    .select({
      id: membershipApplications.id,
      applicationReference: membershipApplications.applicationReference,
      fullName: membershipApplications.fullName,
      email: membershipApplications.email,
      phone: membershipApplications.phone,
      county: membershipApplications.county,
      constituency: membershipApplications.constituency,
      occupation: membershipApplications.occupation,
      idDocumentMasked: membershipApplications.idDocumentMasked,
      status: membershipApplications.status,
      submittedAt: membershipApplications.submittedAt,
      reviewedAt: membershipApplications.reviewedAt,
      createdAt: membershipApplications.createdAt,
    })
    .from(membershipApplications)
    .where(whereClause)
    .orderBy(desc(membershipApplications.submittedAt))
    .limit(pageSize)
    .offset(offset)

  return {
    applications: rows,
    pagination: paginationMeta(total, page, pageSize),
  }
}

export async function getAdminApplicationDetail(
  id: string,
  adminUser: AdminUser,
  meta?: { ipAddress?: string; userAgent?: string }
) {
  const db = getDb()

  const rows = await db
    .select({
      id: membershipApplications.id,
      applicationReference: membershipApplications.applicationReference,
      fullName: membershipApplications.fullName,
      email: membershipApplications.email,
      phone: membershipApplications.phone,
      county: membershipApplications.county,
      constituency: membershipApplications.constituency,
      occupation: membershipApplications.occupation,
      idDocumentMasked: membershipApplications.idDocumentMasked,
      consentGiven: membershipApplications.consentGiven,
      consentTimestamp: membershipApplications.consentTimestamp,
      consentVersion: membershipApplications.consentVersion,
      status: membershipApplications.status,
      submittedAt: membershipApplications.submittedAt,
      reviewedAt: membershipApplications.reviewedAt,
      reviewedBy: membershipApplications.reviewedBy,
      createdAt: membershipApplications.createdAt,
      updatedAt: membershipApplications.updatedAt,
      reviewerEmail: adminUsers.email,
    })
    .from(membershipApplications)
    .leftJoin(adminUsers, eq(membershipApplications.reviewedBy, adminUsers.id))
    .where(eq(membershipApplications.id, id))
    .limit(1)

  const app = rows[0]
  if (!app) {
    throw new NotFoundError('Application not found.')
  }

  // Audit application view
  await createAuditLog({
    actorAdminId: adminUser.id,
    action: 'APPLICATION_VIEWED',
    entityType: 'MEMBERSHIP_APPLICATION',
    entityId: id,
    metadata: { reference: app.applicationReference },
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
  })

  // Fetch reviews history
  const reviews = await db
    .select({
      id: applicationReviews.id,
      action: applicationReviews.action,
      previousStatus: applicationReviews.previousStatus,
      newStatus: applicationReviews.newStatus,
      note: applicationReviews.note,
      createdAt: applicationReviews.createdAt,
      reviewerEmail: adminUsers.email,
    })
    .from(applicationReviews)
    .innerJoin(adminUsers, eq(applicationReviews.adminUserId, adminUsers.id))
    .where(eq(applicationReviews.applicationId, id))
    .orderBy(desc(applicationReviews.createdAt))

  return {
    application: app,
    reviews,
  }
}

export async function updateApplicationStatus(
  id: string,
  input: UpdateApplicationStatusInput,
  adminUser: AdminUser,
  meta?: { ipAddress?: string; userAgent?: string }
) {
  const db = getDb()

  // Run in a transaction
  return await db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(membershipApplications)
      .where(eq(membershipApplications.id, id))
      .limit(1)

    const app = rows[0]
    if (!app) {
      throw new NotFoundError('Application not found.')
    }

    const currentStatus = app.status as ApplicationStatus
    const targetStatus = input.status

    // Validate state machine
    const allowed = ALLOWED_TRANSITIONS[currentStatus] ?? []
    if (!allowed.includes(targetStatus)) {
      throw new ValidationError(
        `Invalid status transition from ${currentStatus} to ${targetStatus}.`
      )
    }

    const now = new Date()

    // 1. Update application record
    await tx
      .update(membershipApplications)
      .set({
        status: targetStatus,
        reviewedAt: now,
        reviewedBy: adminUser.id,
        updatedAt: now,
      })
      .where(eq(membershipApplications.id, id))

    // 2. Insert application review record
    await tx.insert(applicationReviews).values({
      applicationId: id,
      adminUserId: adminUser.id,
      action: 'STATUS_TRANSITION',
      previousStatus: currentStatus,
      newStatus: targetStatus,
      note: input.note,
      createdAt: now,
    })

    // 3. Insert audit log
    await createAuditLog(
      {
        actorAdminId: adminUser.id,
        action: 'APPLICATION_STATUS_CHANGED',
        entityType: 'MEMBERSHIP_APPLICATION',
        entityId: id,
        metadata: {
          reference: app.applicationReference,
          previousStatus: currentStatus,
          newStatus: targetStatus,
          note: input.note,
        },
        ipAddress: meta?.ipAddress,
        userAgent: meta?.userAgent,
      },
      tx as any
    )

    return {
      id,
      reference: app.applicationReference,
      previousStatus: currentStatus,
      status: targetStatus,
      reviewedAt: now,
    }
  })
}

export async function addApplicationReview(
  id: string,
  input: AddApplicationReviewInput,
  adminUser: AdminUser,
  meta?: { ipAddress?: string; userAgent?: string }
) {
  const db = getDb()

  return await db.transaction(async (tx) => {
    const rows = await tx
      .select({ id: membershipApplications.id, status: membershipApplications.status })
      .from(membershipApplications)
      .where(eq(membershipApplications.id, id))
      .limit(1)

    const app = rows[0]
    if (!app) {
      throw new NotFoundError('Application not found.')
    }

    const now = new Date()

    const [review] = await tx
      .insert(applicationReviews)
      .values({
        applicationId: id,
        adminUserId: adminUser.id,
        action: 'REVIEW_NOTE_ADDED',
        previousStatus: app.status,
        newStatus: app.status,
        note: input.note,
        createdAt: now,
      })
      .returning()

    await createAuditLog(
      {
        actorAdminId: adminUser.id,
        action: 'APPLICATION_REVIEW_ADDED',
        entityType: 'MEMBERSHIP_APPLICATION',
        entityId: id,
        metadata: { note: input.note },
        ipAddress: meta?.ipAddress,
        userAgent: meta?.userAgent,
      },
      tx as any
    )

    return review
  })
}

export async function getApplicationHistory(id: string) {
  const db = getDb()
  return await db
    .select({
      id: applicationReviews.id,
      action: applicationReviews.action,
      previousStatus: applicationReviews.previousStatus,
      newStatus: applicationReviews.newStatus,
      note: applicationReviews.note,
      createdAt: applicationReviews.createdAt,
      reviewerEmail: adminUsers.email,
    })
    .from(applicationReviews)
    .innerJoin(adminUsers, eq(applicationReviews.adminUserId, adminUsers.id))
    .where(eq(applicationReviews.applicationId, id))
    .orderBy(desc(applicationReviews.createdAt))
}
