import type { FastifyInstance } from 'fastify'
import { createDocumentSchema, updateDocumentSchema } from './documentSchemas'
import {
  listPublicDocuments,
  listAdminDocuments,
  createDocument,
  updateDocument,
  archiveDocument,
} from './documentService'
import type { DocumentType } from '../../db/schema/documents'
import { requireAuth, requireRoles } from '../../plugins/auth'

export async function documentRoutes(app: FastifyInstance): Promise<void> {
  // Public Route
  app.get('/', { schema: { description: 'List published documents', tags: ['Documents'] } }, async (request, reply) => {
    const { type } = request.query as { type?: DocumentType }
    const docs = await listPublicDocuments(type)
    return reply.send({ success: true, data: docs })
  })
}

export async function adminDocumentRoutes(app: FastifyInstance): Promise<void> {
  // Accessible by SUPER_ADMIN and CONTENT_EDITOR
  app.addHook('preHandler', requireAuth)
  app.addHook('preHandler', requireRoles('SUPER_ADMIN', 'CONTENT_EDITOR'))

  app.get('/', { schema: { description: 'List all documents for admin', tags: ['Admin Documents'] } }, async (_request, reply) => {
    const docs = await listAdminDocuments()
    reply.header('Cache-Control', 'no-store')
    return reply.send({ success: true, data: docs })
  })

  app.post('/', { schema: { description: 'Create document record', tags: ['Admin Documents'] } }, async (request, reply) => {
    const validatedInput = createDocumentSchema.parse(request.body)
    const ipAddress = request.ip
    const userAgent = request.headers['user-agent']

    const doc = await createDocument(validatedInput, request.adminUser!, { ipAddress, userAgent })
    reply.header('Cache-Control', 'no-store')
    return reply.status(201).send({ success: true, data: doc })
  })

  app.patch('/:id', { schema: { description: 'Update document record', tags: ['Admin Documents'] } }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const validatedInput = updateDocumentSchema.parse(request.body)
    const ipAddress = request.ip
    const userAgent = request.headers['user-agent']

    const updated = await updateDocument(id, validatedInput, request.adminUser!, { ipAddress, userAgent })
    reply.header('Cache-Control', 'no-store')
    return reply.send({ success: true, data: updated })
  })

  app.delete('/:id', { schema: { description: 'Archive document record', tags: ['Admin Documents'] } }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const ipAddress = request.ip
    const userAgent = request.headers['user-agent']

    const archived = await archiveDocument(id, request.adminUser!, { ipAddress, userAgent })
    reply.header('Cache-Control', 'no-store')
    return reply.send({ success: true, data: archived })
  })
}
