import crypto from 'node:crypto'
import { getEnv } from '../config/env'

export type EncryptedEnvelope = {
  ciphertext: string
  iv: string
  authTag: string
  version: 'v1'
}

function getKey(): Buffer {
  const env = getEnv()
  const rawKey = env.DATA_ENCRYPTION_KEY
  if (rawKey.length === 64 && /^[0-9a-fA-F]+$/.test(rawKey)) {
    return Buffer.from(rawKey, 'hex')
  }
  return crypto.createHash('sha256').update(rawKey).digest()
}

/**
 * Encrypts sensitive string data using AES-256-GCM envelope encryption.
 */
export function encryptData(plaintext: string): string {
  const key = getKey()
  const iv = crypto.randomBytes(12) // 96-bit IV for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  
  let ciphertext = cipher.update(plaintext, 'utf8', 'hex')
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
 * Decrypts an AES-256-GCM encrypted envelope.
 */
export function decryptData(envelopeJson: string): string {
  const key = getKey()
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
