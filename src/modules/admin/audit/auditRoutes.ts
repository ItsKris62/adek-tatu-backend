import type { FastifyInstance } from 'fastify'
import { getAuditLogs } from './auditService'
import { requireAuth, requireRoles } from '../../../plugins/auth'

export async function auditRoutes(app: FastifyInstance): Promise<void> {
  // Audit logs are read-only and accessible ONLY by SUPER_ADMIN
  app.get(
    '/',
    {
      preHandler: [requireAuth, requireRoles('SUPER_ADMIN')],
      schema: {
        description: 'Get immutable audit logs (SUPER_ADMIN only)',
        tags: ['Admin Audit'],
      },
    },
    async (request, reply) => {
      const query = request.query as { page?: string; pageSize?: string }
      const result = await getAuditLogs(query)

      reply.header('Cache-Control', 'no-store')
      return reply.send({
        success: true,
        data: result.logs,
        pagination: result.pagination,
      })
    }
  )
}
