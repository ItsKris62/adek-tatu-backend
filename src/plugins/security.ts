import type { FastifyInstance } from 'fastify'
import fastifyHelmet from '@fastify/helmet'
import fastifyCors from '@fastify/cors'
import fastifyCookie from '@fastify/cookie'
import fastifyRateLimit from '@fastify/rate-limit'
import { getEnv } from '../config/env'

export async function registerSecurityPlugins(app: FastifyInstance): Promise<void> {
  const env = getEnv()

  // Security Headers
  await app.register(fastifyHelmet, {
    contentSecurityPolicy: false, // API server does not render HTML
    crossOriginEmbedderPolicy: false,
  })

  // Cookie Support
  await app.register(fastifyCookie, {
    secret: env.SESSION_SECRET,
    hook: 'onRequest',
  })

  // CORS Configuration
  const allowedOrigins = env.FRONTEND_ORIGIN.split(',').map((o) => o.trim())
  await app.register(fastifyCors, {
    origin: (origin, cb) => {
      // Allow non-browser requests (like curl / server-to-server / tests) where origin is undefined
      if (!origin) return cb(null, true)
      if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        return cb(null, true)
      }
      return cb(new Error('CORS origin not allowed'), false)
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-CSRF-Token'],
  })

  // Global Rate Limiter
  await app.register(fastifyRateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW_MS,
    errorResponseBuilder: () => ({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please slow down and try again later.',
      },
    }),
  })
}
