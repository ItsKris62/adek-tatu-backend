import type { FastifyInstance } from 'fastify'
import {
  membershipSummaryQuerySchema,
  membershipExportQuerySchema,
} from './reportsSchemas'
import {
  getMembershipSummary,
  exportMembershipCsv,
} from './reportsService'
import { requireAuth, requireRoles } from '../../../plugins/auth'
import { getEnv } from '../../../config/env'

export async function reportsRoutes(app: FastifyInstance): Promise<void> {
  const env = getEnv()

  // All reporting routes require SUPER_ADMIN or RECRUITMENT_OFFICER. CONTENT_EDITOR receives 403.
  app.addHook('preHandler', requireAuth)
  app.addHook('preHandler', requireRoles('SUPER_ADMIN', 'RECRUITMENT_OFFICER'))

  // GET /api/v1/admin/reports/membership/summary
  app.get(
    '/membership/summary',
    {
      schema: {
        description: 'Get aggregate membership application and recruitment statistics',
        tags: ['Admin Reports'],
      },
    },
    async (request, reply) => {
      reply.header('Cache-Control', 'no-store')
      const query = membershipSummaryQuerySchema.parse(request.query)
      const ipAddress = request.ip
      const userAgent = request.headers['user-agent']

      const result = await getMembershipSummary(query, request.adminUser!, { ipAddress, userAgent })

      return reply.send({
        success: true,
        data: result,
      })
    }
  )

  // GET /api/v1/admin/reports/membership/export
  app.get(
    '/membership/export',
    {
      config: {
        rateLimit: {
          max: env.REPORT_EXPORT_RATE_LIMIT_MAX,
          timeWindow: env.REPORT_EXPORT_RATE_LIMIT_WINDOW_MS,
          keyGenerator: (req) => (req.adminUser ? `export-admin:${req.adminUser.id}` : `export-ip:${req.ip}`),
        },
      },
      schema: {
        description: 'Export sanitized membership records in CSV format (Max 10,000 rows)',
        tags: ['Admin Reports'],
      },
    },
    async (request, reply) => {
      const query = membershipExportQuerySchema.parse(request.query)
      const ipAddress = request.ip
      const userAgent = request.headers['user-agent']

      const result = await exportMembershipCsv(query, request.adminUser!, { ipAddress, userAgent })

      reply.header('Content-Type', 'text/csv; charset=utf-8')
      reply.header('Content-Disposition', `attachment; filename="${result.filename}"`)
      reply.header('Cache-Control', 'no-store')

      return reply.send(result.csvContent)
    }
  )
}
