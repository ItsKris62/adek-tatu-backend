import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import { getEnv } from '../config/env'
import * as schema from './schema/index'

const { Pool } = pg

let pool: pg.Pool | null = null
let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null

export function getDbPool(): pg.Pool {
  if (!pool) {
    const env = getEnv()
    const isSsl = env.DATABASE_SSL
    
    pool = new Pool({
      connectionString: env.DATABASE_URL,
      ssl: isSsl ? { rejectUnauthorized: false } : false,
      min: env.DATABASE_POOL_MIN,
      max: env.DATABASE_POOL_MAX,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    })

    pool.on('error', (err) => {
      console.error('Unexpected error on idle PostgreSQL client', err)
    })
  }
  return pool
}

export function getDb() {
  if (!dbInstance) {
    const p = getDbPool()
    dbInstance = drizzle(p, { schema })
  }
  return dbInstance
}

export async function closeDbPool(): Promise<void> {
  if (pool) {
    await pool.end()
    pool = null
    dbInstance = null
  }
}

export async function checkDbHealth(): Promise<{ status: 'up' | 'down'; latencyMs: number }> {
  const p = getDbPool()
  const start = Date.now()
  try {
    const client = await p.connect()
    try {
      await client.query('SELECT 1')
      const latencyMs = Date.now() - start
      return { status: 'up', latencyMs }
    } finally {
      client.release()
    }
  } catch (error) {
    return { status: 'down', latencyMs: Date.now() - start }
  }
}
