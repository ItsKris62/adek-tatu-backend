import type { FastifyInstance } from 'fastify'
import { updateSiteContentSchema } from './siteContentSchemas'
import { getPublicSiteContent, listAdminSiteContent, upsertSiteContent } from './siteContentService'
import { requireAuth, requireRoles } from '../../plugins/auth'

export async function siteContentRoutes(app: FastifyInstance): Promise<void> {
  // Public Route
  app.get('/:key', { schema: { description: 'Get published site content section', tags: ['Site Content'] } }, async (request, reply) => {
    const { key } = request.params as { key: string }
    const content = await getPublicSiteContent(key)
    return reply.send({ success: true, data: content })
  })
}

export async function adminSiteContentRoutes(app: FastifyInstance): Promise<void> {
  // Accessible by SUPER_ADMIN and CONTENT_EDITOR
  app.addHook('preHandler', requireAuth)
  app.addHook('preHandler', requireRoles('SUPER_ADMIN', 'CONTENT_EDITOR'))

  app.get('/', { schema: { description: 'List all managed site content sections', tags: ['Admin Site Content'] } }, async (_request, reply) => {
    const list = await listAdminSiteContent()
    reply.header('Cache-Control', 'no-store')
    return reply.send({ success: true, data: list })
  })

  app.patch('/:key', { schema: { description: 'Update a managed site content section', tags: ['Admin Site Content'] } }, async (request, reply) => {
    const { key } = request.params as { key: string }
    const validatedInput = updateSiteContentSchema.parse(request.body)
    const ipAddress = request.ip
    const userAgent = request.headers['user-agent']

    const content = await upsertSiteContent(key, validatedInput, request.adminUser!, { ipAddress, userAgent })
    reply.header('Cache-Control', 'no-store')
    return reply.send({ success: true, data: content })
  })
}
