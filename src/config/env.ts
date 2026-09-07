import { z } from 'zod'
import dotenv from 'dotenv'

dotenv.config()

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  // Proxy & Network (true, false, IP address, or comma-separated IPs)
  TRUST_PROXY: z
    .string()
    .default('false')
    .transform((val): boolean | string | string[] => {
      if (val === 'true') return true
      if (val === 'false') return false
      if (val.includes(',')) {
        return val.split(',').map((ip) => ip.trim())
      }
      return val
    }),

  // PostgreSQL
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DATABASE_SSL: z.string().transform((val) => val === 'true').default('false'),
  DATABASE_POOL_MIN: z.coerce.number().default(2),
  DATABASE_POOL_MAX: z.coerce.number().default(10),

  // Test database
  TEST_DATABASE_URL: z.string().optional(),

  // Frontend origin(s) (comma-separated if multiple)
  FRONTEND_ORIGIN: z.string().default('http://localhost:3000'),

  // Session & Cookies
  SESSION_COOKIE_NAME: z.string().default('adek_admin_session'),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  SESSION_TTL_HOURS: z.coerce.number().default(12),
  COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  COOKIE_SECURE: z
    .string()
    .optional()
    .transform((val) => (val === undefined ? undefined : val === 'true')),

  // Cryptographic Keys (Hex encoded 32-byte keys = 64 hex chars or base64 / min 32 chars)
  DATA_ENCRYPTION_KEY: z.string().min(32, 'DATA_ENCRYPTION_KEY must be at least 32 characters/bytes'),
  DATA_HMAC_KEY: z.string().min(32, 'DATA_HMAC_KEY must be at least 32 characters/bytes'),
  TOTP_ENCRYPTION_KEY: z.string().min(32, 'TOTP_ENCRYPTION_KEY must be at least 32 characters/bytes'),

  // OpenAPI / Swagger (Disabled by default in production)
  ENABLE_SWAGGER: z.string().transform((val) => val === 'true').default('false'),

  // Rate Limiting
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().default(5),
  AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
  MEMBERSHIP_RATE_LIMIT_MAX: z.coerce.number().default(10),
  MEMBERSHIP_RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
})

export type Env = z.infer<typeof envSchema>

let parsedEnv: Env | null = null

export function getEnv(): Env {
  if (!parsedEnv) {
    const result = envSchema.safeParse(process.env)
    if (!result.success) {
      console.error('❌ Environment validation failed:')
      console.error(JSON.stringify(result.error.format(), null, 2))
      throw new Error('Invalid environment configuration')
    }
    parsedEnv = result.data
  }
  return parsedEnv
}
