import { sql, count } from 'drizzle-orm'
import { getDb } from '../../../db/client'
import { membershipApplications } from '../../../db/schema/membershipApplications'
import { adminUsers } from '../../../db/schema/admins'

export async function getDashboardStats() {
  const db = getDb()

  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)

  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const [stats] = await db
    .select({
      total: count(),
      submitted: sql<number>`count(*) filter (where ${membershipApplications.status} = 'SUBMITTED')`,
      underReview: sql<number>`count(*) filter (where ${membershipApplications.status} = 'UNDER_REVIEW')`,
      correctionRequired: sql<number>`count(*) filter (where ${membershipApplications.status} = 'CORRECTION_REQUIRED')`,
      approved: sql<number>`count(*) filter (where ${membershipApplications.status} = 'APPROVED')`,
      rejected: sql<number>`count(*) filter (where ${membershipApplications.status} = 'REJECTED')`,
      today: sql<number>`count(*) filter (where ${membershipApplications.submittedAt} >= ${startOfDay.toISOString()})`,
      thisMonth: sql<number>`count(*) filter (where ${membershipApplications.submittedAt} >= ${startOfMonth.toISOString()})`,
    })
    .from(membershipApplications)

  const [adminCountResult] = await db
    .select({ value: count() })
    .from(adminUsers)
    .where(sql`${adminUsers.isActive} = true`)

  return {
    totalApplications: Number(stats?.total ?? 0),
    submitted: Number(stats?.submitted ?? 0),
    underReview: Number(stats?.underReview ?? 0),
    correctionRequired: Number(stats?.correctionRequired ?? 0),
    approved: Number(stats?.approved ?? 0),
    rejected: Number(stats?.rejected ?? 0),
    today: Number(stats?.today ?? 0),
    thisMonth: Number(stats?.thisMonth ?? 0),
    activeAdmins: Number(adminCountResult?.value ?? 0),
  }
}
