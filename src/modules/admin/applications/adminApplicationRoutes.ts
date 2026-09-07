import type { FastifyInstance } from 'fastify'
import {
  applicationFilterSchema,
  updateApplicationStatusSchema,
  addApplicationReviewSchema,
} from './adminApplicationSchemas'
import {
  listAdminApplications,
  getAdminApplicationDetail,
  updateApplicationStatus,
  addApplicationReview,
  getApplicationHistory,
} from './adminApplicationService'
import { requireAuth, requireRoles } from '../../../plugins/auth'

export async function adminApplicationRoutes(app: FastifyInstance): Promise<void> {
  // All routes here require authentication and at least RECRUITMENT_OFFICER or SUPER_ADMIN
  app.addHook('preHandler', requireAuth)
  app.addHook('preHandler', requireRoles('SUPER_ADMIN', 'RECRUITMENT_OFFICER'))

  // List applications with filtering and pagination
  app.get(
    '/',
    {
      schema: {
        description: 'List membership applications with filters and pagination',
        tags: ['Admin Applications'],
      },
    },
    async (request, reply) => {
      const query = applicationFilterSchema.parse(request.query)
      const result = await listAdminApplications(query)

      reply.header('Cache-Control', 'no-store')
      return reply.send({
        success: true,
        data: result.applications,
        pagination: result.pagination,
      })
    }
  )

  // Get application details and review history
  app.get(
    '/:id',
    {
      schema: {
        description: 'Get application details and reviews',
        tags: ['Admin Applications'],
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const ipAddress = request.ip
      const userAgent = request.headers['user-agent']

      const result = await getAdminApplicationDetail(id, request.adminUser!, { ipAddress, userAgent })

      reply.header('Cache-Control', 'no-store')
      return reply.send({
        success: true,
        data: result,
      })
    }
  )

  // Update application status
  app.patch(
    '/:id/status',
    {
      schema: {
        description: 'Transition application status via state machine',
        tags: ['Admin Applications'],
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const validatedInput = updateApplicationStatusSchema.parse(request.body)
      const ipAddress = request.ip
      const userAgent = request.headers['user-agent']

      const result = await updateApplicationStatus(id, validatedInput, request.adminUser!, {
        ipAddress,
        userAgent,
      })

      reply.header('Cache-Control', 'no-store')
      return reply.send({
        success: true,
        data: result,
      })
    }
  )

  // Add review note
  app.post(
    '/:id/reviews',
    {
      schema: {
        description: 'Add a review note to an application',
        tags: ['Admin Applications'],
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const validatedInput = addApplicationReviewSchema.parse(request.body)
      const ipAddress = request.ip
      const userAgent = request.headers['user-agent']

      const review = await addApplicationReview(id, validatedInput, request.adminUser!, {
        ipAddress,
        userAgent,
      })

      reply.header('Cache-Control', 'no-store')
      return reply.status(201).send({
        success: true,
        data: review,
      })
    }
  )

  // Get application review history
  app.get(
    '/:id/history',
    {
      schema: {
        description: 'Get application review and transition history',
        tags: ['Admin Applications'],
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const history = await getApplicationHistory(id)

      reply.header('Cache-Control', 'no-store')
      return reply.send({
        success: true,
        data: history,
      })
    }
  )
}
