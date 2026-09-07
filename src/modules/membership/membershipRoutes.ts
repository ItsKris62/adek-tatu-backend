import type { FastifyInstance } from 'fastify'
import { submitMembershipSchema, statusLookupParamsSchema } from './membershipSchemas'
import { submitApplication, getApplicationStatus } from './membershipService'
import { getEnv } from '../../config/env'

export async function membershipRoutes(app: FastifyInstance): Promise<void> {
  const env = getEnv()

  // Public Membership Submission
  app.post(
    '/applications',
    {
      config: {
        rateLimit: {
          max: env.MEMBERSHIP_RATE_LIMIT_MAX,
          timeWindow: env.MEMBERSHIP_RATE_LIMIT_WINDOW_MS,
        },
      },
      schema: {
        description: 'Submit an ADEK membership application (Demonstration)',
        tags: ['Membership'],
        response: {
          201: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  reference: { type: 'string' },
                  status: { type: 'string' },
                  submittedAt: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      reply.header('Cache-Control', 'no-store')
      const validatedInput = submitMembershipSchema.parse(request.body)
      const result = await submitApplication(validatedInput)

      return reply.status(201).send({
        success: true,
        data: {
          reference: result.reference,
          status: result.status,
          submittedAt: result.submittedAt.toISOString(),
        },
      })
    }
  )

  // Public Status Lookup
  app.get(
    '/applications/:reference/status',
    {
      config: {
        rateLimit: {
          max: env.MEMBERSHIP_RATE_LIMIT_MAX * 2,
          timeWindow: env.MEMBERSHIP_RATE_LIMIT_WINDOW_MS,
        },
      },
      schema: {
        description: 'Lookup public application status by reference',
        tags: ['Membership'],
        params: {
          type: 'object',
          required: ['reference'],
          properties: {
            reference: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      reply.header('Cache-Control', 'no-store')
      const { reference } = statusLookupParamsSchema.parse(request.params)
      const result = await getApplicationStatus(reference)

      return reply.send({
        success: true,
        data: {
          reference: result.reference,
          status: result.status,
          submittedAt: result.submittedAt.toISOString(),
          updatedAt: result.updatedAt.toISOString(),
        },
      })
    }
  )
}
