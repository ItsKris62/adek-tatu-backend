import type { FastifyInstance } from 'fastify'
import { createAdminUserSchema } from '../auth/authSchemas'
import { listAdminUsers, createAdminUser, toggleAdminUserStatus } from './adminUserService'
import { requireAuth, requireRoles } from '../../../plugins/auth'
import { z } from 'zod'

const toggleStatusSchema = z.object({
  isActive: z.boolean(),
})

export async function adminUserRoutes(app: FastifyInstance): Promise<void> {
  // User management is strictly SUPER_ADMIN only
  app.addHook('preHandler', requireAuth)
  app.addHook('preHandler', requireRoles('SUPER_ADMIN'))

  // List users
  app.get(
    '/',
    {
      schema: {
        description: 'List all administrative users',
        tags: ['Admin Users'],
      },
    },
    async (_request, reply) => {
      const users = await listAdminUsers()
      reply.header('Cache-Control', 'no-store')

      return reply.send({
        success: true,
        data: users,
      })
    }
  )

  // Create admin user
  app.post(
    '/',
    {
      schema: {
        description: 'Create a new admin user',
        tags: ['Admin Users'],
      },
    },
    async (request, reply) => {
      const validatedInput = createAdminUserSchema.parse(request.body)
      const ipAddress = request.ip
      const userAgent = request.headers['user-agent']

      const result = await createAdminUser(validatedInput, request.adminUser, { ipAddress, userAgent })

      reply.header('Cache-Control', 'no-store')
      return reply.status(201).send({
        success: true,
        data: result.user,
        ...(result.totpUri ? { totpUri: result.totpUri } : {}),
      })
    }
  )

  // Toggle user active status
  app.patch(
    '/:id/status',
    {
      schema: {
        description: 'Activate or suspend an admin user',
        tags: ['Admin Users'],
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const { isActive } = toggleStatusSchema.parse(request.body)
      const ipAddress = request.ip
      const userAgent = request.headers['user-agent']

      const updated = await toggleAdminUserStatus(id, isActive, request.adminUser!, {
        ipAddress,
        userAgent,
      })

      reply.header('Cache-Control', 'no-store')
      return reply.send({
        success: true,
        data: updated,
      })
    }
  )
}
