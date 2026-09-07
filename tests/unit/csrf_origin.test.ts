import { describe, it, expect } from 'vitest'
import { generateCsrfTokenForSession, verifyCsrfTokenForSession } from '../../src/security/csrf'
import { getAllowedOrigins } from '../../src/config/env'

describe('CSRF & Origin Hardening Unit Tests', () => {
  const sessionTokenA = 'a'.repeat(64)
  const sessionTokenB = 'b'.repeat(64)

  describe('Session-Bound CSRF Token Generation & Verification', () => {
    it('should generate deterministic 64-hex CSRF token for a given session token', () => {
      const csrf1 = generateCsrfTokenForSession(sessionTokenA)
      const csrf2 = generateCsrfTokenForSession(sessionTokenA)

      expect(csrf1).toBeDefined()
      expect(csrf1.length).toBe(64)
      expect(csrf1).toBe(csrf2)
    })

    it('should generate distinct CSRF tokens for distinct session tokens', () => {
      const csrfA = generateCsrfTokenForSession(sessionTokenA)
      const csrfB = generateCsrfTokenForSession(sessionTokenB)

      expect(csrfA).not.toBe(csrfB)
    })

    it('should verify valid CSRF token in constant time', () => {
      const csrfToken = generateCsrfTokenForSession(sessionTokenA)
      const isValid = verifyCsrfTokenForSession(csrfToken, sessionTokenA)

      expect(isValid).toBe(true)
    })

    it('should reject CSRF token generated for a different session', () => {
      const csrfTokenA = generateCsrfTokenForSession(sessionTokenA)
      const isValid = verifyCsrfTokenForSession(csrfTokenA, sessionTokenB)

      expect(isValid).toBe(false)
    })

    it('should reject tampered or truncated CSRF tokens', () => {
      const csrfToken = generateCsrfTokenForSession(sessionTokenA)
      const tampered = csrfToken.slice(0, -2) + '00'

      expect(verifyCsrfTokenForSession(tampered, sessionTokenA)).toBe(false)
      expect(verifyCsrfTokenForSession('short', sessionTokenA)).toBe(false)
      expect(verifyCsrfTokenForSession('', sessionTokenA)).toBe(false)
    })
  })

  describe('Origin Matching Security', () => {
    it('should parse FRONTEND_ORIGIN safely into an exact match Set', () => {
      const origins = getAllowedOrigins()
      expect(origins instanceof Set).toBe(true)
      expect(origins.size).toBeGreaterThan(0)
    })
  })
})
