import crypto from 'node:crypto'

// Crockford Base32 alphabet (excluding I, L, O, U to avoid confusion)
const CROCKFORD_BASE32_CHARS = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

/**
 * Generates a public application reference with high entropy (approx 80 bits of randomness).
 * Format: ADEK-2026-XXXXXXXXXXXXXXXX (16 Crockford Base32 characters)
 *
 * Does not derive from UUID, National ID, phone, email, or database sequence.
 */
export function generateApplicationReference(year: number = new Date().getFullYear()): string {
  const bytes = crypto.randomBytes(10) // 10 bytes = 80 bits
  let randomPart = ''
  
  // Convert 80 bits into 16 5-bit symbols
  let bitBuffer = 0
  let bitCount = 0
  for (const byte of bytes) {
    bitBuffer = (bitBuffer << 8) | byte
    bitCount += 8
    while (bitCount >= 5) {
      bitCount -= 5
      const index = (bitBuffer >> bitCount) & 0x1f
      randomPart += CROCKFORD_BASE32_CHARS[index]
    }
  }

  return `ADEK-${year}-${randomPart}`
}
