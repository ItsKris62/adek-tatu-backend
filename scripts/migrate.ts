import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { getDb, closeDbPool } from '../src/db/client'

async function runMigrations() {
  console.log('📦 Running Drizzle migrations on PostgreSQL database...')
  const db = getDb()
  try {
    await migrate(db, { migrationsFolder: './migrations' })
    console.log('✅ Migrations applied successfully!')
  } catch (err) {
    console.error('❌ Migration failed:', err)
    process.exit(1)
  } finally {
    await closeDbPool()
  }
}

runMigrations()
