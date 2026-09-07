import type { FastifyRequest, FastifyReply } from 'fastify'
import { validateSessionToken } from '../security/sessions'
import type { AdminUser, AdminRole } from '../db/schema/admins'
import { AuthenticationError, AuthorizationError, ForbiddenError } from '../utils/errors'
import { getEnv, getAllowedOrigins } from '../config/env'
import { verifyCsrfTokenForSession } from '../security/csrf'

declare module 'fastify' {
  interface FastifyRequest {
    adminUser?: AdminUser
    sessionToken?: string
  }
}

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/**
 * Fastify pre-handler hook to authenticate admin requests using database-backed opaque sessions.
 * Also enforces Origin and CSRF validation on authenticated state-changing mutation requests (POST/PUT/PATCH/DELETE).
 */
export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const env = getEnv()
  let token: string | undefined = undefined

  // 1. Check HttpOnly cookie
  const cookieToken = request.cookies[env.SESSION_COOKIE_NAME]
  if (cookieToken) {
    const unsigned = request.unsignCookie(cookieToken)
    token = unsigned.valid && unsigned.value ? unsigned.value : cookieToken
  }

  // 2. Fallback to Authorization: Bearer <token>
  if (!token && request.headers.authorization?.startsWith('Bearer ')) {
    token = request.headers.authorization.slice(7).trim()
  }

  if (!token) {
    throw new AuthenticationError('Authentication required. No active admin session found.')
  }

  const sessionData = await validateSessionToken(token)
  if (!sessionData) {
    // Clear invalid cookie
    reply.clearCookie(env.SESSION_COOKIE_NAME, { path: '/' })
    throw new AuthenticationError('Session expired or revoked. Please log in again.')
  }

  request.adminUser = sessionData.user
  request.sessionToken = token

  // Origin & CSRF validation for authenticated state-changing requests
  if (MUTATION_METHODS.has(request.method.toUpperCase())) {
    // 1. Validate Origin header if present
    const originHeader = request.headers.origin
    if (originHeader) {
      const allowedOrigins = getAllowedOrigins()
      if (!allowedOrigins.has('*') && !allowedOrigins.has(originHeader)) {
        throw new ForbiddenError(
          `Cross-origin mutation rejected. Origin '${originHeader}' is not trusted.`,
          'ORIGIN_NOT_ALLOWED'
        )
      }
    }

    // 2. Validate CSRF Token
    const csrfToken = request.headers['x-csrf-token'] as string | undefined
    if (!csrfToken || typeof csrfToken !== 'string' || !csrfToken.trim()) {
      throw new ForbiddenError(
        'CSRF token is required for state-changing operations.',
        'CSRF_TOKEN_MISSING'
      )
    }

    const isValid = verifyCsrfTokenForSession(csrfToken.trim(), token)
    if (!isValid) {
      throw new ForbiddenError('Invalid or expired CSRF token.', 'CSRF_INVALID')
    }
  }
}

/**
 * Fastify pre-handler hook to enforce Role-Based Access Control (RBAC).
 */
export function requireRoles(...allowedRoles: AdminRole[]) {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    if (!request.adminUser) {
      throw new AuthenticationError('Authentication required.')
    }

    const userRole = request.adminUser.role as AdminRole
    if (!allowedRoles.includes(userRole)) {
      throw new AuthorizationError(
        `Access denied. Required role: [${allowedRoles.join(', ')}], Current role: ${userRole}`
      )
    }
  }
}
