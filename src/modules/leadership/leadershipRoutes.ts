import type { FastifyInstance } from 'fastify'
import { createLeadershipSchema, updateLeadershipSchema } from './leadershipSchemas'
import {
  listPublicLeadership,
  listAdminLeadership,
  createLeadership,
  updateLeadership,
  archiveLeadership,
} from './leadershipService'
import { requireAuth, requireRoles } from '../../plugins/auth'

export async function leadershipRoutes(app: FastifyInstance): Promise<void> {
  // Public Route
  app.get('/', { schema: { description: 'List published leadership members', tags: ['Leadership'] } }, async (_request, reply) => {
    const members = await listPublicLeadership()
    return reply.send({ success: true, data: members })
  })
}

export async function adminLeadershipRoutes(app: FastifyInstance): Promise<void> {
  // Accessible by SUPER_ADMIN and CONTENT_EDITOR
  app.addHook('preHandler', requireAuth)
  app.addHook('preHandler', requireRoles('SUPER_ADMIN', 'CONTENT_EDITOR'))

  app.get('/', { schema: { description: 'List all leadership members for admin', tags: ['Admin Leadership'] } }, async (_request, reply) => {
    const members = await listAdminLeadership()
    reply.header('Cache-Control', 'no-store')
    return reply.send({ success: true, data: members })
  })

  app.post('/', { schema: { description: 'Create leadership member', tags: ['Admin Leadership'] } }, async (request, reply) => {
    const validatedInput = createLeadershipSchema.parse(request.body)
    const ipAddress = request.ip
    const userAgent = request.headers['user-agent']

    const member = await createLeadership(validatedInput, request.adminUser!, { ipAddress, userAgent })
    reply.header('Cache-Control', 'no-store')
    return reply.status(201).send({ success: true, data: member })
  })

  app.patch('/:id', { schema: { description: 'Update leadership member', tags: ['Admin Leadership'] } }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const validatedInput = updateLeadershipSchema.parse(request.body)
    const ipAddress = request.ip
    const userAgent = request.headers['user-agent']

    const updated = await updateLeadership(id, validatedInput, request.adminUser!, { ipAddress, userAgent })
    reply.header('Cache-Control', 'no-store')
    return reply.send({ success: true, data: updated })
  })

  app.delete('/:id', { schema: { description: 'Archive leadership member', tags: ['Admin Leadership'] } }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const ipAddress = request.ip
    const userAgent = request.headers['user-agent']

    const archived = await archiveLeadership(id, request.adminUser!, { ipAddress, userAgent })
    reply.header('Cache-Control', 'no-store')
    return reply.send({ success: true, data: archived })
  })
}
