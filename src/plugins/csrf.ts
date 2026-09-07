import type { FastifyRequest, FastifyReply } from 'fastify'
import { getAllowedOrigins } from '../config/env'
import { ForbiddenError } from '../utils/errors'
import { verifyCsrfTokenForSession } from '../security/csrf'

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/**
 * Validates the request Origin against configured allowed origins for mutation requests.
 */
export async function validateOrigin(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  if (!MUTATION_METHODS.has(request.method.toUpperCase())) {
    return
  }

  const originHeader = request.headers.origin
  if (!originHeader) {
    // Non-browser or direct server calls without origin header
    return
  }

  const allowedOrigins = getAllowedOrigins()
  if (allowedOrigins.has('*')) {
    return
  }

  if (!allowedOrigins.has(originHeader)) {
    throw new ForbiddenError(
      `Cross-origin request rejected. Origin '${originHeader}' is not trusted.`,
      'ORIGIN_NOT_ALLOWED'
    )
  }
}

/**
 * Fastify pre-handler hook that enforces CSRF token validation on authenticated state-changing endpoints.
 * GET, HEAD, OPTIONS are exempt from CSRF checks.
 */
export async function requireCsrf(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  if (!MUTATION_METHODS.has(request.method.toUpperCase())) {
    return
  }

  const sessionToken = request.sessionToken
  if (!sessionToken) {
    // CSRF validation only applies to authenticated sessions
    return
  }

  const providedToken = request.headers['x-csrf-token'] as string | undefined
  if (!providedToken || typeof providedToken !== 'string' || !providedToken.trim()) {
    throw new ForbiddenError('CSRF token is required for state-changing operations.', 'CSRF_TOKEN_MISSING')
  }

  const isValid = verifyCsrfTokenForSession(providedToken.trim(), sessionToken)
  if (!isValid) {
    throw new ForbiddenError('Invalid or expired CSRF token.', 'CSRF_INVALID')
  }
}
