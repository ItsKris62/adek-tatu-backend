import crypto from 'node:crypto'
import { getEnv } from '../config/env'

function getHmacKey(): Buffer {
  const env = getEnv()
  const rawKey = env.DATA_HMAC_KEY
  if (rawKey.length === 64 && /^[0-9a-fA-F]+$/.test(rawKey)) {
    return Buffer.from(rawKey, 'hex')
  }
  return crypto.createHash('sha256').update(rawKey).digest()
}

/**
 * Computes an HMAC-SHA-256 representation of the National ID for duplicate detection.
 * Independent from the reversible AES-256-GCM encryption secret.
 */
export function createIdHmac(rawId: string): string {
  const normalized = rawId.trim().toUpperCase()
  const key = getHmacKey()
  return crypto.createHmac('sha256', key).update(normalized).digest('hex')
}

/**
 * Creates a masked representation of a sensitive identifier (e.g., '******1234').
 */
export function maskId(rawId: string): string {
  const trimmed = rawId.trim()
  if (trimmed.length <= 4) {
    return '***' + trimmed
  }
  const lastFour = trimmed.slice(-4)
  const maskLength = Math.max(trimmed.length - 4, 3)
  return '*'.repeat(maskLength) + lastFour
}

/**
 * Computes a SHA-256 hash of a session token for secure database storage.
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

/**
 * Computes SHA-256 hash of consent wording.
 */
export function hashConsentText(text: string): string {
  return crypto.createHash('sha256').update(text.trim()).digest('hex')
}
