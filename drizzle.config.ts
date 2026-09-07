import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/db/schema/index.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://adek_user:pass@127.0.0.1:5432/adek_db',
  },
  verbose: true,
  strict: true,
})
