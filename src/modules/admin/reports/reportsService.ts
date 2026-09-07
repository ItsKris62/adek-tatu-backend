import { eq, and, gte, lte, count, sql, ilike, or, desc } from 'drizzle-orm'
import { getDb } from '../../../db/client'
import { membershipApplications } from '../../../db/schema/membershipApplications'
import type { AdminUser } from '../../../db/schema/admins'
import { createAuditLog } from '../audit/auditService'
import { ValidationError, NotFoundError } from '../../../utils/errors'
import { parsePagination, paginationMeta } from '../../../utils/pagination'
import type {
  MembershipSummaryQuery,
  MembershipExportQuery,
  MembersRegisterQuery,
} from './reportsSchemas'

const MAX_EXPORT_LIMIT = 10000

/**
 * Sanitizes a cell value to prevent CSV Formula Injection in spreadsheet software (Excel, Calc, Sheets).
 * Cells starting with =, +, -, @, \t, \r are prepended with a single quote.
 */
export function sanitizeCsvField(val: unknown): string {
  if (val === null || val === undefined) {
    return '""'
  }
  let str = String(val)

  // Prevent formula execution
  if (/^[=+\-@\t\r]/.test(str) || /^[=+\-@\t\r]/.test(str.trim())) {
    str = `'${str}`
  }

  // Escape existing double quotes and wrap in quotes
  const escaped = str.replace(/"/g, '""')
  return `"${escaped}"`
}

/**
 * Generates SQL-backed membership recruitment summary statistics and optional groupings.
 */
export async function getMembershipSummary(
  query: MembershipSummaryQuery,
  adminUser: AdminUser,
  clientMeta: { ipAddress?: string; userAgent?: string }
) {
  const db = getDb()
  const conditions = []

  if (query.county) {
    conditions.push(eq(membershipApplications.county, query.county))
  }
  if (query.constituency) {
    conditions.push(eq(membershipApplications.constituency, query.constituency))
  }
  if (query.dateFrom) {
    conditions.push(gte(membershipApplications.submittedAt, new Date(query.dateFrom)))
  }
  if (query.dateTo) {
    const endOfDay = new Date(query.dateTo)
    if (!query.dateTo.includes('T')) {
      endOfDay.setHours(23, 59, 59, 999)
    }
    conditions.push(lte(membershipApplications.submittedAt, endOfDay))
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const [stats] = await db
    .select({
      total: count(),
      submitted: sql<number>`count(*) filter (where ${membershipApplications.status} = 'SUBMITTED')`,
      underReview: sql<number>`count(*) filter (where ${membershipApplications.status} = 'UNDER_REVIEW')`,
      correctionRequired: sql<number>`count(*) filter (where ${membershipApplications.status} = 'CORRECTION_REQUIRED')`,
      approved: sql<number>`count(*) filter (where ${membershipApplications.status} = 'APPROVED')`,
      rejected: sql<number>`count(*) filter (where ${membershipApplications.status} = 'REJECTED')`,
      withdrawn: sql<number>`count(*) filter (where ${membershipApplications.status} = 'WITHDRAWN')`,
    })
    .from(membershipApplications)
    .where(whereClause)

  let groupings: Record<string, unknown>[] | undefined = undefined

  if (query.groupBy === 'county') {
    const countyResults = await db
      .select({
        county: membershipApplications.county,
        total: count(),
        approved: sql<number>`count(*) filter (where ${membershipApplications.status} = 'APPROVED')`,
        submitted: sql<number>`count(*) filter (where ${membershipApplications.status} = 'SUBMITTED')`,
        underReview: sql<number>`count(*) filter (where ${membershipApplications.status} = 'UNDER_REVIEW')`,
        correctionRequired: sql<number>`count(*) filter (where ${membershipApplications.status} = 'CORRECTION_REQUIRED')`,
        rejected: sql<number>`count(*) filter (where ${membershipApplications.status} = 'REJECTED')`,
      })
      .from(membershipApplications)
      .where(whereClause)
      .groupBy(membershipApplications.county)
      .orderBy(desc(count()))

    groupings = countyResults.map((r) => ({
      county: r.county,
      total: Number(r.total),
      approved: Number(r.approved),
      submitted: Number(r.submitted),
      underReview: Number(r.underReview),
      correctionRequired: Number(r.correctionRequired),
      rejected: Number(r.rejected),
    }))
  } else if (query.groupBy === 'status') {
    const statusResults = await db
      .select({
        status: membershipApplications.status,
        count: count(),
      })
      .from(membershipApplications)
      .where(whereClause)
      .groupBy(membershipApplications.status)
      .orderBy(desc(count()))

    groupings = statusResults.map((r) => ({
      status: r.status,
      count: Number(r.count),
    }))
  }

  // Audit event
  await createAuditLog({
    actorAdminId: adminUser.id,
    action: 'MEMBERSHIP_REPORT_VIEWED',
    entityType: 'membership_report',
    metadata: {
      reportType: 'summary',
      filters: {
        county: query.county,
        constituency: query.constituency,
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
        groupBy: query.groupBy,
      },
    },
    ipAddress: clientMeta.ipAddress,
    userAgent: clientMeta.userAgent,
  })

  return {
    totalApplications: Number(stats?.total ?? 0),
    submitted: Number(stats?.submitted ?? 0),
    underReview: Number(stats?.underReview ?? 0),
    correctionRequired: Number(stats?.correctionRequired ?? 0),
    approved: Number(stats?.approved ?? 0),
    rejected: Number(stats?.rejected ?? 0),
    withdrawn: Number(stats?.withdrawn ?? 0),
    ...(groupings ? { breakdown: groupings } : {}),
  }
}

/**
 * Exports membership records as a sanitized CSV file.
 * Enforces maximum record limit and CSV formula injection protection.
 * Never exports National ID or raw credentials.
 */
export async function exportMembershipCsv(
  query: MembershipExportQuery,
  adminUser: AdminUser,
  clientMeta: { ipAddress?: string; userAgent?: string }
): Promise<{ csvContent: string; rowCount: number; filename: string }> {
  const db = getDb()
  const conditions = []

  if (query.status) {
    conditions.push(eq(membershipApplications.status, query.status))
  }
  if (query.county) {
    conditions.push(eq(membershipApplications.county, query.county))
  }
  if (query.constituency) {
    conditions.push(eq(membershipApplications.constituency, query.constituency))
  }
  if (query.dateFrom) {
    conditions.push(gte(membershipApplications.submittedAt, new Date(query.dateFrom)))
  }
  if (query.dateTo) {
    const endOfDay = new Date(query.dateTo)
    if (!query.dateTo.includes('T')) {
      endOfDay.setHours(23, 59, 59, 999)
    }
    conditions.push(lte(membershipApplications.submittedAt, endOfDay))
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  // Check matching row count to enforce upper safety bound
  const [totalResult] = await db
    .select({ value: count() })
    .from(membershipApplications)
    .where(whereClause)

  const totalMatching = Number(totalResult?.value ?? 0)

  if (totalMatching > MAX_EXPORT_LIMIT) {
    throw new ValidationError(
      `Export query matches ${totalMatching} records, which exceeds the maximum export limit of ${MAX_EXPORT_LIMIT.toLocaleString()} rows. Please narrow your filters by date range, county, or status.`
    )
  }

  const rows = await db
    .select({
      applicationReference: membershipApplications.applicationReference,
      fullName: membershipApplications.fullName,
      email: membershipApplications.email,
      phone: membershipApplications.phone,
      county: membershipApplications.county,
      constituency: membershipApplications.constituency,
      occupation: membershipApplications.occupation,
      status: membershipApplications.status,
      submittedAt: membershipApplications.submittedAt,
      reviewedAt: membershipApplications.reviewedAt,
    })
    .from(membershipApplications)
    .where(whereClause)
    .orderBy(desc(membershipApplications.submittedAt))
    .limit(MAX_EXPORT_LIMIT)

  const headers = [
    'Application Reference',
    'Full Name',
    'Email',
    'Phone',
    'County',
    'Constituency',
    'Occupation',
    'Status',
    'Submitted At',
    'Reviewed At',
  ]

  const csvRows: string[] = [headers.map((h) => `"${h}"`).join(',')]

  for (const row of rows) {
    const values = [
      sanitizeCsvField(row.applicationReference),
      sanitizeCsvField(row.fullName),
      sanitizeCsvField(row.email),
      sanitizeCsvField(row.phone),
      sanitizeCsvField(row.county),
      sanitizeCsvField(row.constituency),
      sanitizeCsvField(row.occupation),
      sanitizeCsvField(row.status),
      sanitizeCsvField(row.submittedAt ? row.submittedAt.toISOString() : ''),
      sanitizeCsvField(row.reviewedAt ? row.reviewedAt.toISOString() : ''),
    ]
    csvRows.push(values.join(','))
  }

  const csvContent = '\uFEFF' + csvRows.join('\r\n') // Include UTF-8 BOM for Excel compatibility
  const dateStr = new Date().toISOString().split('T')[0]
  const filename = `adek-membership-report-${dateStr}.csv`

  // Audit event (no PII in metadata)
  await createAuditLog({
    actorAdminId: adminUser.id,
    action: 'MEMBERSHIP_REPORT_EXPORTED',
    entityType: 'membership_report',
    metadata: {
      format: 'csv',
      rowCount: rows.length,
      filters: {
        status: query.status,
        county: query.county,
        constituency: query.constituency,
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
      },
    },
    ipAddress: clientMeta.ipAddress,
    userAgent: clientMeta.userAgent,
  })

  return {
    csvContent,
    rowCount: rows.length,
    filename,
  }
}

/**
 * Lists demonstration approved members (applications with status = APPROVED).
 * Returns only safe operational fields. National ID is masked; never returns ciphertext or HMAC.
 */
export async function listApprovedMembers(
  query: MembersRegisterQuery,
  adminUser: AdminUser,
  clientMeta: { ipAddress?: string; userAgent?: string }
) {
  const db = getDb()
  const { page, pageSize, offset } = parsePagination({ page: query.page, pageSize: query.pageSize })

  const conditions = [eq(membershipApplications.status, 'APPROVED')]

  if (query.county) {
    conditions.push(eq(membershipApplications.county, query.county))
  }
  if (query.constituency) {
    conditions.push(eq(membershipApplications.constituency, query.constituency))
  }
  if (query.dateFrom) {
    conditions.push(gte(membershipApplications.submittedAt, new Date(query.dateFrom)))
  }
  if (query.dateTo) {
    const endOfDay = new Date(query.dateTo)
    if (!query.dateTo.includes('T')) {
      endOfDay.setHours(23, 59, 59, 999)
    }
    conditions.push(lte(membershipApplications.submittedAt, endOfDay))
  }
  if (query.search) {
    const searchPattern = `%${query.search.trim()}%`
    conditions.push(
      or(
        ilike(membershipApplications.fullName, searchPattern),
        ilike(membershipApplications.email, searchPattern),
        ilike(membershipApplications.phone, searchPattern),
        ilike(membershipApplications.applicationReference, searchPattern)
      )!
    )
  }

  const whereClause = and(...conditions)

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
      approvedAt: membershipApplications.reviewedAt,
      submittedAt: membershipApplications.submittedAt,
    })
    .from(membershipApplications)
    .where(whereClause)
    .orderBy(desc(membershipApplications.reviewedAt), desc(membershipApplications.submittedAt))
    .limit(pageSize)
    .offset(offset)

  // Audit event
  await createAuditLog({
    actorAdminId: adminUser.id,
    action: 'APPROVED_MEMBER_REGISTER_VIEWED',
    entityType: 'approved_members_register',
    metadata: {
      page,
      pageSize,
      rowCount: rows.length,
      filters: {
        county: query.county,
        constituency: query.constituency,
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
      },
    },
    ipAddress: clientMeta.ipAddress,
    userAgent: clientMeta.userAgent,
  })

  return {
    members: rows,
    pagination: paginationMeta(total, page, pageSize),
  }
}

/**
 * Retrieves safe member detail for an approved application.
 */
export async function getApprovedMemberDetail(
  id: string,
  adminUser: AdminUser,
  clientMeta: { ipAddress?: string; userAgent?: string }
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
      status: membershipApplications.status,
      approvedAt: membershipApplications.reviewedAt,
      submittedAt: membershipApplications.submittedAt,
    })
    .from(membershipApplications)
    .where(and(eq(membershipApplications.id, id), eq(membershipApplications.status, 'APPROVED')))
    .limit(1)

  const member = rows[0]
  if (!member) {
    throw new NotFoundError('Approved member record not found.')
  }

  // Audit event
  await createAuditLog({
    actorAdminId: adminUser.id,
    action: 'APPROVED_MEMBER_DETAIL_VIEWED',
    entityType: 'approved_member',
    entityId: member.id,
    metadata: {
      applicationReference: member.applicationReference,
    },
    ipAddress: clientMeta.ipAddress,
    userAgent: clientMeta.userAgent,
  })

  return member
}
