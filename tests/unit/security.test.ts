import { describe, it, expect, beforeAll } from 'vitest'
import { encryptData, decryptData } from '../../src/security/encryption'
import { createIdHmac, maskId, hashToken, hashConsentText } from '../../src/security/hashing'
import { hashPassword, verifyPassword } from '../../src/security/passwords'
import {
  generateTotpSecret,
  encryptTotpSecret,
  decryptTotpSecret,
  verifyTotpCode,
} from '../../src/security/totp'
import { generateApplicationReference } from '../../src/utils/references'
import { normalizeEmail, normalizePhone } from '../../src/utils/normalize'
import * as OTPAuth from 'otpauth'

describe('Security & Cryptography Modules', () => {
  beforeAll(() => {
    process.env.DATA_ENCRYPTION_KEY =
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
    process.env.DATA_HMAC_KEY =
      'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210'
    process.env.TOTP_ENCRYPTION_KEY =
      '11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff'
  })

  describe('AES-256-GCM Envelope Encryption', () => {
    it('should encrypt and successfully decrypt sensitive identifiers', () => {
      const rawId = '32849102'
      const envelope = encryptData(rawId)

      expect(envelope).not.toContain(rawId)
      const parsed = JSON.parse(envelope)
      expect(parsed).toHaveProperty('ciphertext')
      expect(parsed).toHaveProperty('iv')
      expect(parsed).toHaveProperty('authTag')
      expect(parsed.version).toBe('v1')

      const decrypted = decryptData(envelope)
      expect(decrypted).toBe(rawId)
    })

    it('should fail decryption if ciphertext or authTag is tampered with', () => {
      const rawId = '98765432'
      const envelope = encryptData(rawId)
      const parsed = JSON.parse(envelope)
      parsed.ciphertext = 'deadbeef' + parsed.ciphertext.slice(8)

      expect(() => decryptData(JSON.stringify(parsed))).toThrow()
    })
  })

  describe('HMAC-SHA-256 Duplicate Detection & Masking', () => {
    it('should produce identical HMAC for same identifier regardless of whitespace/case', () => {
      const hmac1 = createIdHmac(' 12345678 ')
      const hmac2 = createIdHmac('12345678')
      const hmac3 = createIdHmac('87654321')

      expect(hmac1).toBe(hmac2)
      expect(hmac1).not.toBe(hmac3)
      expect(hmac1).toHaveLength(64)
    })

    it('should mask National IDs safely without exposing full number', () => {
      expect(maskId('12345678')).toBe('****5678')
      expect(maskId('32849102')).toBe('****9102')
      expect(maskId('123')).toBe('***123')
    })
  })

  describe('Argon2id Password Hashing', () => {
    it('should hash and verify passwords using Argon2id', async () => {
      const password = 'SuperSecretAdminPassword123!'
      const hash = await hashPassword(password)

      expect(hash).toContain('$argon2id$')
      const isValid = await verifyPassword(password, hash)
      expect(isValid).toBe(true)

      const isInvalid = await verifyPassword('WrongPassword', hash)
      expect(isInvalid).toBe(false)
    })
  })

  describe('TOTP Multi-Factor Authentication', () => {
    it('should generate, encrypt, decrypt, and verify TOTP codes', () => {
      const secret = generateTotpSecret()
      expect(secret).toBeDefined()
      expect(secret.length).toBeGreaterThan(16)

      const encrypted = encryptTotpSecret(secret)
      expect(encrypted).not.toContain(secret)

      const decrypted = decryptTotpSecret(encrypted)
      expect(decrypted).toBe(secret)

      // Generate current valid token
      const totp = new OTPAuth.TOTP({
        issuer: 'ADEK TATU',
        secret: OTPAuth.Secret.fromBase32(secret),
      })
      const currentToken = totp.generate()

      const isValid = verifyTotpCode(currentToken, secret)
      expect(isValid).toBe(true)

      const isInvalid = verifyTotpCode('000000', secret)
      expect(isInvalid).toBe(false)
    })
  })

  describe('Application Reference Generator (Entropy & Crockford Base32)', () => {
    it('should generate high entropy human-readable references without ambiguous characters', () => {
      const year = new Date().getFullYear()
      const ref = generateApplicationReference()

      expect(ref).toMatch(new RegExp(`^ADEK-${year}-[0-9A-HJ-NP-Z]{16}$`))
      // Verify no ambiguous characters I, L, O, U
      expect(ref).not.toMatch(/[ILOU]/)

      const set = new Set<string>()
      for (let i = 0; i < 100; i++) {
        set.add(generateApplicationReference())
      }
      expect(set.size).toBe(100) // Collision free in 100 iterations
    })
  })

  describe('Email and Phone Normalization', () => {
    it('should normalize emails consistently', () => {
      expect(normalizeEmail('  Member@Example.COM  ')).toBe('member@example.com')
    })

    it('should normalize Kenyan phone numbers to international standard format', () => {
      expect(normalizePhone('0712 345 678')).toBe('+254712345678')
      expect(normalizePhone('0112345678')).toBe('+254112345678')
      expect(normalizePhone('254712345678')).toBe('+254712345678')
      expect(normalizePhone('+254 712 345 678')).toBe('+254712345678')
      expect(normalizePhone('+1 555 123 4567')).toBe('+15551234567')
    })
  })
})
