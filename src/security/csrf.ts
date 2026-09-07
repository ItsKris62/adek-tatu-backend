import crypto from 'node:crypto'
import { getEnv } from '../config/env'

/**
 * Derives a cryptographically strong, session-bound CSRF token from the active session token.
 * Uses HMAC-SHA-256 with the server's SESSION_SECRET.
 * When the session expires or is revoked, the CSRF token is automatically invalidated.
 */
export function generateCsrfTokenForSession(sessionToken: string): string {
  const env = getEnv()
  return crypto
    .createHmac('sha256', env.SESSION_SECRET)
    .update(`csrf:${sessionToken}`)
    .digest('hex')
}

/**
 * Validates a submitted CSRF token against the active session token in constant time.
 */
export function verifyCsrfTokenForSession(providedToken: string, sessionToken: string): boolean {
  if (!providedToken || !sessionToken) {
    return false
  }

  const expectedToken = generateCsrfTokenForSession(sessionToken)

  const providedBuf = Buffer.from(providedToken, 'utf8')
  const expectedBuf = Buffer.from(expectedToken, 'utf8')

  if (providedBuf.length !== expectedBuf.length) {
    return false
  }

  return crypto.timingSafeEqual(providedBuf, expectedBuf)
}
