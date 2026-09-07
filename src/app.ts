import fastify, { type FastifyInstance } from 'fastify'
import fastifySwagger from '@fastify/swagger'
import fastifySwaggerUi from '@fastify/swagger-ui'
import { getEnv } from './config/env'
import { registerSecurityPlugins } from './plugins/security'
import { registerErrorHandler } from './plugins/errorHandler'
import { healthRoutes } from './modules/health/healthRoutes'
import { membershipRoutes } from './modules/membership/membershipRoutes'
import { authRoutes } from './modules/admin/auth/authRoutes'
import { adminApplicationRoutes } from './modules/admin/applications/adminApplicationRoutes'
import { dashboardRoutes } from './modules/admin/dashboard/dashboardRoutes'
import { auditRoutes } from './modules/admin/audit/auditRoutes'
import { adminUserRoutes } from './modules/admin/users/adminUserRoutes'
import { newsRoutes, adminNewsRoutes } from './modules/news/newsRoutes'
import { leadershipRoutes, adminLeadershipRoutes } from './modules/leadership/leadershipRoutes'
import { documentRoutes, adminDocumentRoutes } from './modules/documents/documentRoutes'
import { siteContentRoutes, adminSiteContentRoutes } from './modules/site-content/siteContentRoutes'
import { reportsRoutes } from './modules/admin/reports/reportsRoutes'
import { membersRoutes } from './modules/admin/reports/membersRoutes'

export async function buildApp(): Promise<FastifyInstance> {
  const env = getEnv()

  const app = fastify({
    logger: {
      level: env.LOG_LEVEL,
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'req.body.password',
          'req.body.totpCode',
          'req.body.preAuthToken',
          'req.body.idNumber',
          'req.body.idDocumentEncrypted',
          'req.body.idDocumentHmac',
        ],
        censor: '[REDACTED]',
      },
    },
    trustProxy: env.TRUST_PROXY,
    genReqId: () => crypto.randomUUID(),
  })

  // Register Error Handler
  registerErrorHandler(app)

  // Register Security, CORS, Cookies & Rate Limiting
  await registerSecurityPlugins(app)

  // OpenAPI / Swagger (Disabled by default; explicitly enabled via ENABLE_SWAGGER=true)
  if (env.ENABLE_SWAGGER) {
    await app.register(fastifySwagger, {
      openapi: {
        info: {
          title: 'ADEK TATU Official Website API',
          description:
            'Backend API for ADEK TATU informational portal, membership recruitment demonstration, and administrative operations.',
          version: '1.0.0',
        },
        servers: [
          {
            url: `http://${env.HOST}:${env.PORT}`,
            description: 'Current environment server',
          },
        ],
        components: {
          securitySchemes: {
            cookieAuth: {
              type: 'apiKey',
              in: 'cookie',
              name: env.SESSION_COOKIE_NAME,
            },
            bearerAuth: {
              type: 'http',
              scheme: 'bearer',
            },
          },
        },
      },
    })

    await app.register(fastifySwaggerUi, {
      routePrefix: '/docs',
      uiConfig: {
        docExpansion: 'list',
        deepLinking: false,
      },
    })
  }

  // Register Routes under /api/v1
  await app.register(
    async (v1) => {
      await v1.register(healthRoutes, { prefix: '/health' })
      await v1.register(membershipRoutes, { prefix: '/membership' })
      await v1.register(newsRoutes, { prefix: '/news' })
      await v1.register(leadershipRoutes, { prefix: '/leadership' })
      await v1.register(documentRoutes, { prefix: '/documents' })
      await v1.register(siteContentRoutes, { prefix: '/content' })

      // Admin sub-routes
      await v1.register(
        async (admin) => {
          await admin.register(authRoutes, { prefix: '/auth' })
          await admin.register(adminApplicationRoutes, { prefix: '/applications' })
          await admin.register(reportsRoutes, { prefix: '/reports' })
          await admin.register(membersRoutes, { prefix: '/members' })
          await admin.register(dashboardRoutes, { prefix: '/dashboard' })
          await admin.register(auditRoutes, { prefix: '/audit-logs' })
          await admin.register(adminUserRoutes, { prefix: '/users' })
          await admin.register(adminNewsRoutes, { prefix: '/news' })
          await admin.register(adminLeadershipRoutes, { prefix: '/leadership' })
          await admin.register(adminDocumentRoutes, { prefix: '/documents' })
          await admin.register(adminSiteContentRoutes, { prefix: '/content' })
        },
        { prefix: '/admin' }
      )
    },
    { prefix: '/api/v1' }
  )

  return app
}
