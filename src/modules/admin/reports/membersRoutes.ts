import type { FastifyInstance } from 'fastify'
import { membersRegisterQuerySchema } from './reportsSchemas'
import { listApprovedMembers, getApprovedMemberDetail } from './reportsService'
import { requireAuth, requireRoles } from '../../../plugins/auth'

export async function membersRoutes(app: FastifyInstance): Promise<void> {
  // All member register routes require SUPER_ADMIN or RECRUITMENT_OFFICER. CONTENT_EDITOR receives 403.
  app.addHook('preHandler', requireAuth)
  app.addHook('preHandler', requireRoles('SUPER_ADMIN', 'RECRUITMENT_OFFICER'))

  // GET /api/v1/admin/members
  app.get(
    '/',
    {
      schema: {
        description: 'List demonstration approved members with filters and pagination',
        tags: ['Admin Members'],
      },
    },
    async (request, reply) => {
      reply.header('Cache-Control', 'no-store')
      const query = membersRegisterQuerySchema.parse(request.query)
      const ipAddress = request.ip
      const userAgent = request.headers['user-agent']

      const result = await listApprovedMembers(query, request.adminUser!, { ipAddress, userAgent })

      return reply.send({
        success: true,
        data: result.members,
        pagination: result.pagination,
      })
    }
  )

  // GET /api/v1/admin/members/:id
  app.get(
    '/:id',
    {
      schema: {
        description: 'Get approved member detail (masked National ID, no raw ciphertext/HMAC)',
        tags: ['Admin Members'],
      },
    },
    async (request, reply) => {
      reply.header('Cache-Control', 'no-store')
      const { id } = request.params as { id: string }
      const ipAddress = request.ip
      const userAgent = request.headers['user-agent']

      const result = await getApprovedMemberDetail(id, request.adminUser!, { ipAddress, userAgent })

      return reply.send({
        success: true,
        data: result,
      })
    }
  )
}
