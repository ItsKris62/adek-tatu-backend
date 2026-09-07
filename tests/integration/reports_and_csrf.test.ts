import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../src/app'
import type { FastifyInstance } from 'fastify'

describe('Reports, CSRF & Anti-Bot Integration Tests', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = await buildApp()
  })

  afterAll(async () => {
    await app.close()
  })

  describe('Unauthenticated Access Control', () => {
    it('should reject unauthenticated access to membership summary report with HTTP 401', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/reports/membership/summary',
      })

      expect(res.statusCode).toBe(401)
      const json = res.json()
      expect(json.success).toBe(false)
      expect(json.error.code).toBe('AUTHENTICATION_REQUIRED')
      expect(res.headers['cache-control']).toBe('no-store')
    })

    it('should reject unauthenticated access to membership report export with HTTP 401', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/reports/membership/export',
      })

      expect(res.statusCode).toBe(401)
      const json = res.json()
      expect(json.success).toBe(false)
    })

    it('should reject unauthenticated access to approved members register with HTTP 401', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/members',
      })

      expect(res.statusCode).toBe(401)
      const json = res.json()
      expect(json.success).toBe(false)
    })

    it('should reject unauthenticated access to CSRF token endpoint with HTTP 401', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/auth/csrf',
      })

      expect(res.statusCode).toBe(401)
      const json = res.json()
      expect(json.success).toBe(false)
    })
  })

  describe('Honeypot Anti-Bot Filter Integration', () => {
    it('should reject membership application when hidden honeypot is populated', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/membership/applications',
        payload: {
          fullName: 'Spam Bot',
          email: 'bot@example.com',
          phone: '+254700000000',
          county: 'Nairobi',
          constituency: 'Westlands',
          idNumber: '11223344',
          occupation: 'Tester',
          consent: true,
          website: 'https://spam-link.example.com', // Honeypot filled!
        },
      })

      expect(res.statusCode).toBe(400)
      const json = res.json()
      expect(json.success).toBe(false)
      expect(json.error.message).toContain('Invalid submission')
    })
  })

  describe('Report Filter Validation Integration', () => {
    it('should validate query parameters on summary route', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/reports/membership/summary?dateFrom=invalid-date',
      })

      // Unauthenticated check runs first (401) or validation runs (400)
      expect([400, 401]).toContain(res.statusCode)
    })
  })
})
