import type { FastifyInstance, FastifyError, FastifyRequest, FastifyReply } from 'fastify'
import { ZodError } from 'zod'
import { AppError } from '../utils/errors'

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError | AppError | Error, request: FastifyRequest, reply: FastifyReply) => {
    reply.header('Cache-Control', 'no-store')

    // 1. Handle custom AppError hierarchy
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        success: false,
        error: {
          code: error.code,
          message: error.message,
          ...(error.fields ? { fields: error.fields } : {}),
        },
      })
    }

    // 2. Handle Zod validation errors
    if (error instanceof ZodError) {
      const fields: Record<string, string> = {}
      for (const issue of error.issues) {
        const path = issue.path.join('.') || 'root'
        fields[path] = issue.message
      }
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'The submitted data failed validation.',
          fields,
        },
      })
    }

    // 3. Handle Fastify schema validation errors
    if ('validation' in error && error.validation) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.message,
        },
      })
    }

    // 4. Handle Rate Limit errors
    if ('statusCode' in error && error.statusCode === 429) {
      return reply.status(429).send({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: error.message || 'Too many requests. Please try again later.',
        },
      })
    }

    // 5. Unexpected Internal Errors - Redact and log safely
    request.log.error(
      {
        err: {
          message: error.message,
          stack: error.stack,
          name: error.name,
        },
        requestId: request.id,
      },
      'Unhandled internal server error'
    )

    return reply.status(500).send({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected internal error occurred. Please try again later.',
      },
    })
  })
}
