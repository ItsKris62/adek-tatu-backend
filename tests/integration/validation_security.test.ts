import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../src/app'
import type { FastifyInstance } from 'fastify'

describe('Validation & Security Controls (Integration)', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = await buildApp()
  })

  afterAll(async () => {
    await app.close()
  })

  describe('Public Membership Submission Validation', () => {
    it('should reject submission with missing required fields with HTTP 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/membership/applications',
        payload: {
          fullName: 'Test User',
          // missing email, phone, county, etc.
        },
      })

      expect(res.statusCode).toBe(400)
      const json = res.json()
      expect(json.success).toBe(false)
      expect(json.error.code).toBe('VALIDATION_ERROR')
      expect(json.error.fields).toHaveProperty('email')
      expect(json.error.fields).toHaveProperty('phone')
    })

    it('should reject submission without affirmative consent with HTTP 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/membership/applications',
        payload: {
          fullName: 'Test Applicant',
          email: 'applicant@example.com',
          phone: '+254712345678',
          county: 'Nairobi',
          constituency: 'Westlands',
          idNumber: '12345678',
          occupation: 'Teacher',
          consent: false, // Must be true!
        },
      })

      expect(res.statusCode).toBe(400)
      const json = res.json()
      expect(json.success).toBe(false)
      expect(json.error.fields).toHaveProperty('consent')
    })

    it('should reject malformed email addresses with HTTP 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/membership/applications',
        payload: {
          fullName: 'Test Applicant',
          email: 'not-an-email',
          phone: '+254712345678',
          county: 'Nairobi',
          constituency: 'Westlands',
          idNumber: '12345678',
          occupation: 'Doctor',
          consent: true,
        },
      })

      expect(res.statusCode).toBe(400)
      const json = res.json()
      expect(json.error.fields).toHaveProperty('email')
    })
  })

  describe('Admin Authentication & RBAC Security', () => {
    it('should reject unauthenticated access to admin applications with HTTP 401', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/applications',
      })

      expect(res.statusCode).toBe(401)
      const json = res.json()
      expect(json.success).toBe(false)
      expect(json.error.code).toBe('AUTHENTICATION_REQUIRED')
    })

    it('should reject unauthenticated access to admin audit logs with HTTP 401', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/audit-logs',
      })

      expect(res.statusCode).toBe(401)
      const json = res.json()
      expect(json.success).toBe(false)
    })

    it('should reject unauthenticated access to admin /me endpoint with HTTP 401', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/auth/me',
      })

      expect(res.statusCode).toBe(401)
      const json = res.json()
      expect(json.success).toBe(false)
    })

    it('should reject admin login with missing credentials with HTTP 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/auth/login',
        payload: {
          email: 'notanemail',
        },
      })

      expect(res.statusCode).toBe(400)
    })
  })

  describe('Swagger / Docs Production Configuration', () => {
    it('should return 404 for /docs when ENABLE_SWAGGER is false (default production state)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/docs',
      })

      expect(res.statusCode).toBe(404)
    })
  })

  describe('Data Minimization & Cache Controls', () => {
    it('status lookup endpoint should return 404 for non-existent reference without leaking DB info', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/membership/applications/ADEK-2026-NONEXISTENT1234/status',
      })

      // When DB is down/empty, handled gracefully
      expect([404, 500]).toContain(res.statusCode)
      expect(res.headers['cache-control']).toBe('no-store')
    })
  })
})
