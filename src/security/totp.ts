import * as OTPAuth from 'otpauth'
import crypto from 'node:crypto'
import { getEnv } from '../config/env'
import type { EncryptedEnvelope } from './encryption'

function getTotpKey(): Buffer {
  const env = getEnv()
  const rawKey = env.TOTP_ENCRYPTION_KEY
  if (rawKey.length === 64 && /^[0-9a-fA-F]+$/.test(rawKey)) {
    return Buffer.from(rawKey, 'hex')
  }
  return crypto.createHash('sha256').update(rawKey).digest()
}

/**
 * Encrypts a TOTP secret using AES-256-GCM.
 */
export function encryptTotpSecret(secret: string): string {
  const key = getTotpKey()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  let ciphertext = cipher.update(secret, 'utf8', 'hex')
  ciphertext += cipher.final('hex')
  const authTag = cipher.getAuthTag().toString('hex')

  const envelope: EncryptedEnvelope = {
    ciphertext,
    iv: iv.toString('hex'),
    authTag,
    version: 'v1',
  }
  return JSON.stringify(envelope)
}

/**
 * Decrypts a stored TOTP secret.
 */
export function decryptTotpSecret(envelopeJson: string): string {
  const key = getTotpKey()
  const envelope: EncryptedEnvelope = JSON.parse(envelopeJson)
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(envelope.iv, 'hex')
  )
  decipher.setAuthTag(Buffer.from(envelope.authTag, 'hex'))
  let decrypted = decipher.update(envelope.ciphertext, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

/**
 * Generates a new random Base32 TOTP secret.
 */
export function generateTotpSecret(): string {
  const secret = new OTPAuth.Secret({ size: 20 })
  return secret.base32
}

/**
 * Generates a standard TOTP URI for QR code setup.
 */
export function generateTotpUri(email: string, secretBase32: string): string {
  const totp = new OTPAuth.TOTP({
    issuer: 'ADEK TATU',
    label: email,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secretBase32),
  })
  return totp.toString()
}

/**
 * Validates a 6-digit TOTP code against the secret (allowing 1 step window drift).
 */
export function verifyTotpCode(code: string, secretBase32: string): boolean {
  const totp = new OTPAuth.TOTP({
    issuer: 'ADEK TATU',
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secretBase32),
  })

  // Delta returns non-null number if valid within window (+/- 1 step)
  const delta = totp.validate({ token: code.trim(), window: 1 })
  return delta !== null
}
