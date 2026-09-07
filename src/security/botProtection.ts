import { getEnv } from '../config/env'

export type TurnstileVerificationResult = {
  success: boolean
  errorCodes?: string[]
  hostname?: string
}

/**
 * Verifies a Cloudflare Turnstile token server-side.
 * When TURNSTILE_ENABLED is false (e.g. development/testing), bypasses verification safely.
 * Never logs, stores, or leaks the token in plaintext.
 */
export async function verifyTurnstileToken(
  token?: string,
  remoteIp?: string
): Promise<TurnstileVerificationResult> {
  const env = getEnv()

  // In test / local dev when Turnstile is disabled
  if (!env.TURNSTILE_ENABLED) {
    return { success: true }
  }

  if (!token || typeof token !== 'string' || !token.trim()) {
    return {
      success: false,
      errorCodes: ['missing-input-response'],
    }
  }

  if (!env.TURNSTILE_SECRET_KEY) {
    console.error('❌ Turnstile is enabled but TURNSTILE_SECRET_KEY is not configured.')
    return {
      success: false,
      errorCodes: ['missing-secret-key'],
    }
  }

  const formData = new URLSearchParams()
  formData.append('secret', env.TURNSTILE_SECRET_KEY)
  formData.append('response', token.trim())
  if (remoteIp) {
    formData.append('remoteip', remoteIp)
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    const response = await fetch(env.TURNSTILE_VERIFY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!response.ok) {
      return {
        success: false,
        errorCodes: [`http-status-${response.status}`],
      }
    }

    const data = (await response.json()) as {
      success: boolean
      'error-codes'?: string[]
      hostname?: string
    }

    if (data.success === true) {
      return {
        success: true,
        hostname: data.hostname,
      }
    }

    return {
      success: false,
      errorCodes: data['error-codes'] || ['invalid-input-response'],
    }
  } catch (err: any) {
    const isTimeout = err.name === 'AbortError' || err.code === 'ABORT_ERR'
    return {
      success: false,
      errorCodes: [isTimeout ? 'turnstile-timeout' : 'turnstile-provider-unavailable'],
    }
  }
}
