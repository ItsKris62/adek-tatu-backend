import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { verifyTurnstileToken } from '../../src/security/botProtection'
import * as envModule from '../../src/config/env'

describe('Bot Protection (Cloudflare Turnstile) Unit Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should bypass verification when TURNSTILE_ENABLED is false (development / test default)', async () => {
    const result = await verifyTurnstileToken(undefined)
    expect(result.success).toBe(true)
  })

  it('should reject missing token when TURNSTILE_ENABLED is true', async () => {
    vi.spyOn(envModule, 'getEnv').mockReturnValue({
      ...envModule.getEnv(),
      TURNSTILE_ENABLED: true,
      TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA',
      TURNSTILE_VERIFY_URL: 'https://challenges.cloudflare.com/turnstile/v0/siteverify',
    } as any)

    const result = await verifyTurnstileToken('')
    expect(result.success).toBe(false)
    expect(result.errorCodes).toContain('missing-input-response')
  })

  it('should verify valid token successfully with mocked Cloudflare response', async () => {
    vi.spyOn(envModule, 'getEnv').mockReturnValue({
      ...envModule.getEnv(),
      TURNSTILE_ENABLED: true,
      TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA',
      TURNSTILE_VERIFY_URL: 'https://challenges.cloudflare.com/turnstile/v0/siteverify',
    } as any)

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        challenge_ts: '2026-09-07T12:00:00.000Z',
        hostname: 'adek.ke',
      }),
    })
    globalThis.fetch = mockFetch

    const result = await verifyTurnstileToken('valid-test-token', '197.232.0.1')
    expect(result.success).toBe(true)
    expect(result.hostname).toBe('adek.ke')
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('should handle invalid or expired tokens gracefully', async () => {
    vi.spyOn(envModule, 'getEnv').mockReturnValue({
      ...envModule.getEnv(),
      TURNSTILE_ENABLED: true,
      TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA',
      TURNSTILE_VERIFY_URL: 'https://challenges.cloudflare.com/turnstile/v0/siteverify',
    } as any)

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: false,
        'error-codes': ['invalid-input-response'],
      }),
    })
    globalThis.fetch = mockFetch

    const result = await verifyTurnstileToken('invalid-token')
    expect(result.success).toBe(false)
    expect(result.errorCodes).toContain('invalid-input-response')
  })

  it('should handle provider network error / timeout without crashing', async () => {
    vi.spyOn(envModule, 'getEnv').mockReturnValue({
      ...envModule.getEnv(),
      TURNSTILE_ENABLED: true,
      TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA',
      TURNSTILE_VERIFY_URL: 'https://challenges.cloudflare.com/turnstile/v0/siteverify',
    } as any)

    const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'))
    globalThis.fetch = mockFetch

    const result = await verifyTurnstileToken('any-token')
    expect(result.success).toBe(false)
    expect(result.errorCodes).toContain('turnstile-provider-unavailable')
  })
})
