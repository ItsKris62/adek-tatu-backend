import type { FastifyInstance } from 'fastify'
import { getDashboardStats } from './dashboardService'
import { requireAuth, requireRoles } from '../../../plugins/auth'

export async function dashboardRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/stats',
    {
      preHandler: [requireAuth, requireRoles('SUPER_ADMIN', 'RECRUITMENT_OFFICER')],
      schema: {
        description: 'Get dashboard application and operational statistics',
        tags: ['Admin Dashboard'],
      },
    },
    async (_request, reply) => {
      const stats = await getDashboardStats()
      reply.header('Cache-Control', 'no-store')

      return reply.send({
        success: true,
        data: stats,
      })
    }
  )
}
