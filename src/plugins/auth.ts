import type { FastifyRequest, FastifyReply } from 'fastify'
import { validateSessionToken } from '../security/sessions'
import type { AdminUser, AdminRole } from '../db/schema/admins'
import { AuthenticationError, AuthorizationError } from '../utils/errors'
import { getEnv } from '../config/env'

declare module 'fastify' {
  interface FastifyRequest {
    adminUser?: AdminUser
    sessionToken?: string
  }
}

/**
 * Fastify pre-handler hook to authenticate admin requests using database-backed opaque sessions.
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
