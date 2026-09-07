import type { FastifyInstance, FastifyReply } from 'fastify'
import { loginSchema, mfaVerifySchema } from './authSchemas'
import { loginAdmin, verifyMfaAndLogin, logoutAdmin } from './authService'
import { requireAuth } from '../../../plugins/auth'
import { getEnv } from '../../../config/env'

function setSessionCookie(reply: FastifyReply, token: string) {
  const env = getEnv()
  const isProduction = env.NODE_ENV === 'production'
  const sameSite = env.COOKIE_SAME_SITE || 'lax'
  // If sameSite is 'none', browser requires secure: true
  const secure = sameSite === 'none' ? true : (env.COOKIE_SECURE !== undefined ? env.COOKIE_SECURE : isProduction)

  reply.setCookie(env.SESSION_COOKIE_NAME, token, {
    path: '/',
    httpOnly: true,
    secure,
    sameSite,
    maxAge: env.SESSION_TTL_HOURS * 3600,
    signed: false,
  })
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  const env = getEnv()

  // Admin Login (Step 1: Password)
  app.post(
    '/login',
    {
      config: {
        rateLimit: {
          max: env.AUTH_RATE_LIMIT_MAX,
          timeWindow: env.AUTH_RATE_LIMIT_WINDOW_MS,
        },
      },
      schema: {
        description: 'Admin login with password',
        tags: ['Admin Auth'],
      },
    },
    async (request, reply) => {
      const validatedInput = loginSchema.parse(request.body)
      const ipAddress = request.ip
      const userAgent = request.headers['user-agent']

      const result = await loginAdmin(validatedInput, { ipAddress, userAgent })

      if (result.mfaRequired) {
        return reply.send({
          success: true,
          data: {
            mfaRequired: true,
            preAuthToken: result.preAuthToken,
          },
        })
      }

      setSessionCookie(reply, result.sessionToken)

      return reply.send({
        success: true,
        data: {
          mfaRequired: false,
          user: result.user,
        },
      })
    }
  )

  // Admin MFA Verification (Step 2: TOTP)
  app.post(
    '/mfa/verify',
    {
      config: {
        rateLimit: {
          max: env.AUTH_RATE_LIMIT_MAX,
          timeWindow: env.AUTH_RATE_LIMIT_WINDOW_MS,
        },
      },
      schema: {
        description: 'Verify 6-digit TOTP code and complete admin login',
        tags: ['Admin Auth'],
      },
    },
    async (request, reply) => {
      const validatedInput = mfaVerifySchema.parse(request.body)
      const ipAddress = request.ip
      const userAgent = request.headers['user-agent']

      const result = await verifyMfaAndLogin(validatedInput, { ipAddress, userAgent })
      setSessionCookie(reply, result.sessionToken)

      return reply.send({
        success: true,
        data: {
          user: result.user,
        },
      })
    }
  )

  // Get Current Authenticated Admin
  app.get(
    '/me',
    {
      preHandler: [requireAuth],
      schema: {
        description: 'Get current authenticated admin user details',
        tags: ['Admin Auth'],
      },
    },
    async (request, reply) => {
      const user = request.adminUser!
      reply.header('Cache-Control', 'no-store')

      return reply.send({
        success: true,
        data: {
          id: user.id,
          email: user.email,
          role: user.role,
          mfaEnabled: user.mfaEnabled,
          lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
        },
      })
    }
  )

  // Admin Logout
  app.post(
    '/logout',
    {
      preHandler: [requireAuth],
      schema: {
        description: 'Logout and revoke active session',
        tags: ['Admin Auth'],
      },
    },
    async (request, reply) => {
      const token = request.sessionToken!
      const user = request.adminUser!
      const ipAddress = request.ip
      const userAgent = request.headers['user-agent']

      await logoutAdmin(token, user, { ipAddress, userAgent })
      reply.clearCookie(env.SESSION_COOKIE_NAME, { path: '/' })

      return reply.send({
        success: true,
        data: { message: 'Logged out successfully.' },
      })
    }
  )
}
