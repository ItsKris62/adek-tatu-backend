import type { FastifyInstance } from 'fastify'
import { checkDbHealth } from '../../db/client'

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/v1/health
  app.get('/', async (_request, reply) => {
    const dbHealth = await checkDbHealth()
    const isHealthy = dbHealth.status === 'up'

    return reply.status(isHealthy ? 200 : 503).send({
      status: isHealthy ? 'ok' : 'degraded',
      service: 'adek-api',
      database: dbHealth.status,
      timestamp: new Date().toISOString(),
    })
  })

  // GET /api/v1/health/live
  app.get('/live', async (_request, reply) => {
    return reply.send({
      status: 'ok',
      timestamp: new Date().toISOString(),
    })
  })

  // GET /api/v1/health/ready
  app.get('/ready', async (_request, reply) => {
    const dbHealth = await checkDbHealth()
    if (dbHealth.status !== 'up') {
      return reply.status(503).send({
        status: 'not_ready',
        database: 'down',
      })
    }
    return reply.send({
      status: 'ready',
      database: 'up',
    })
  })
}
