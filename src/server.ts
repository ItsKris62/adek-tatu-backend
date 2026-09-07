import { buildApp } from './app'
import { getEnv } from './config/env'
import { closeDbPool } from './db/client'

async function start() {
  const env = getEnv()
  const app = await buildApp()

  const shutdown = async (signal: string) => {
    app.log.info(`Received ${signal}, shutting down gracefully...`)
    try {
      await app.close()
      await closeDbPool()
      app.log.info('Graceful shutdown completed.')
      process.exit(0)
    } catch (err) {
      app.log.error(err, 'Error during graceful shutdown')
      process.exit(1)
    }
  }

  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))

  try {
    const address = await app.listen({
      port: env.PORT,
      host: env.HOST,
    })
    console.log(`🚀 ADEK TATU Backend listening on ${address}`)
    if (env.ENABLE_SWAGGER || env.NODE_ENV !== 'production') {
      console.log(`📖 OpenAPI documentation available at ${address}/docs`)
    }
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()
