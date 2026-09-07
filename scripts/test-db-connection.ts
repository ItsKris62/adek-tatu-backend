import pg from 'pg'
import dotenv from 'dotenv'

dotenv.config()

const { Pool } = pg

async function testConnection(label: string, connectionString: string | undefined) {
  console.log(`\n------------------------------------------------------------`)
  console.log(`Testing Connection: [${label}]`)
  console.log(`------------------------------------------------------------`)

  if (!connectionString) {
    console.error(`❌ ${label} is not defined in .env`)
    return
  }

  // Parse URI safely for display (masking password)
  try {
    const url = new URL(connectionString)
    const maskedUser = url.username
    const host = url.hostname
    const port = url.port || '5432'
    const dbName = url.pathname.replace(/^\//, '')
    console.log(`Connecting to: ${maskedUser}@${host}:${port}/${dbName}`)
  } catch {
    console.log(`Connecting with provided connection string...`)
  }

  const isSsl = process.env.DATABASE_SSL === 'true' || connectionString.includes('sslmode=require')

  const pool = new Pool({
    connectionString,
    ssl: isSsl ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 8000,
  })

  const start = Date.now()
  try {
    const client = await pool.connect()
    try {
      const res = await client.query('SELECT version(), current_database(), current_user, now()')
      const latency = Date.now() - start
      console.log(`✅ SUCCESS! Connected in ${latency}ms`)
      console.log(`   Database:    ${res.rows[0].current_database}`)
      console.log(`   User:        ${res.rows[0].current_user}`)
      console.log(`   Server Time: ${res.rows[0].now}`)
      console.log(`   PG Version:  ${res.rows[0].version.split(' on ')[0]}`)
    } finally {
      client.release()
    }
  } catch (err: any) {
    const latency = Date.now() - start
    console.error(`❌ CONNECTION FAILED after ${latency}ms`)
    console.error(`   Error Code:    ${err.code || 'N/A'}`)
    console.error(`   Error Message: ${err.message}`)
    if (err.message.includes('ECONNREFUSED')) {
      console.error(`   💡 Note: PostgreSQL is not accepting connections on this host/port. If the database is hosted remotely on cPanel, verify if remote PostgreSQL access is enabled for your IP or if this test should run on the server.`)
    }
  } finally {
    await pool.end()
  }
}

async function run() {
  console.log('============================================================')
  console.log('PostgreSQL Database Connection Test')
  console.log('============================================================')

  // 1. Test Production Database
  await testConnection('PRODUCTION DATABASE (DATABASE_URL)', process.env.DATABASE_URL)

  // 2. Test Test Database
  await testConnection('TEST DATABASE (TEST_DATABASE_URL)', process.env.TEST_DATABASE_URL)

  console.log('\n============================================================')
}

run().catch((err) => {
  console.error('Fatal test error:', err)
  process.exit(1)
})
