import type { FastifyInstance } from 'fastify'
import { createNewsSchema, updateNewsSchema } from './newsSchemas'
import {
  listPublicNews,
  getPublicNewsBySlug,
  listAdminNews,
  getAdminNewsById,
  createNews,
  updateNews,
  archiveNews,
} from './newsService'
import { requireAuth, requireRoles } from '../../plugins/auth'

export async function newsRoutes(app: FastifyInstance): Promise<void> {
  // Public Routes
  app.get('/', { schema: { description: 'List published news articles', tags: ['News'] } }, async (_request, reply) => {
    const articles = await listPublicNews()
    return reply.send({ success: true, data: articles })
  })

  app.get('/:slug', { schema: { description: 'Get published news article by slug', tags: ['News'] } }, async (request, reply) => {
    const { slug } = request.params as { slug: string }
    const article = await getPublicNewsBySlug(slug)
    return reply.send({ success: true, data: article })
  })
}

export async function adminNewsRoutes(app: FastifyInstance): Promise<void> {
  // Accessible by SUPER_ADMIN and CONTENT_EDITOR
  app.addHook('preHandler', requireAuth)
  app.addHook('preHandler', requireRoles('SUPER_ADMIN', 'CONTENT_EDITOR'))

  app.get('/', { schema: { description: 'List all news articles for admin', tags: ['Admin News'] } }, async (_request, reply) => {
    const articles = await listAdminNews()
    reply.header('Cache-Control', 'no-store')
    return reply.send({ success: true, data: articles })
  })

  app.get('/:id', { schema: { description: 'Get news article by ID', tags: ['Admin News'] } }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const article = await getAdminNewsById(id)
    reply.header('Cache-Control', 'no-store')
    return reply.send({ success: true, data: article })
  })

  app.post('/', { schema: { description: 'Create news article', tags: ['Admin News'] } }, async (request, reply) => {
    const validatedInput = createNewsSchema.parse(request.body)
    const ipAddress = request.ip
    const userAgent = request.headers['user-agent']

    const article = await createNews(validatedInput, request.adminUser!, { ipAddress, userAgent })
    reply.header('Cache-Control', 'no-store')
    return reply.status(201).send({ success: true, data: article })
  })

  app.patch('/:id', { schema: { description: 'Update news article', tags: ['Admin News'] } }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const validatedInput = updateNewsSchema.parse(request.body)
    const ipAddress = request.ip
    const userAgent = request.headers['user-agent']

    const updated = await updateNews(id, validatedInput, request.adminUser!, { ipAddress, userAgent })
    reply.header('Cache-Control', 'no-store')
    return reply.send({ success: true, data: updated })
  })

  app.delete('/:id', { schema: { description: 'Archive news article', tags: ['Admin News'] } }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const ipAddress = request.ip
    const userAgent = request.headers['user-agent']

    const archived = await archiveNews(id, request.adminUser!, { ipAddress, userAgent })
    reply.header('Cache-Control', 'no-store')
    return reply.send({ success: true, data: archived })
  })
}
