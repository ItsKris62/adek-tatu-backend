import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../src/app'
import type { FastifyInstance } from 'fastify'

describe('Health Endpoints (Integration)', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = await buildApp()
  })

  afterAll(async () => {
    await app.close()
  })

  it('GET /api/v1/health/live should return 200 and live status', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/health/live',
    })

    expect(res.statusCode).toBe(200)
    const json = res.json()
    expect(json.status).toBe('ok')
    expect(json).toHaveProperty('timestamp')
  })

  it('GET /api/v1/health should respond with service identifier and timestamp without leaking internal paths or database credentials', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/health',
    })

    const json = res.json()
    expect(json).toHaveProperty('service', 'adek-api')
    expect(json).toHaveProperty('timestamp')
    expect(json).toHaveProperty('database')
    
    // Ensure no secrets leaked
    const text = res.body
    expect(text).not.toContain('postgresql://')
    expect(text).not.toContain('test_pass')
    expect(text).not.toContain('password')
  })
})
