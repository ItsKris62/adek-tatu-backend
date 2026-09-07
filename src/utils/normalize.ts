/**
 * Normalizes email address by trimming whitespace and converting to lowercase.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/**
 * Normalizes Kenyan and international phone numbers.
 * Converts Kenyan formats:
 * - '0712345678' -> '+254712345678'
 * - '0112345678' -> '+254112345678'
 * - '254712345678' -> '+254712345678'
 * - '+254 712 345 678' -> '+254712345678'
 * Preserves other valid international formats without inventing digits.
 */
export function normalizePhone(phone: string): string {
  // Remove all whitespace, hyphens, parentheses
  const cleaned = phone.replace(/[\s\-\(\)\.]/g, '')

  // Kenyan local formats: 07XXXXXXXX or 01XXXXXXXX (10 digits)
  if (/^0[17]\d{8}$/.test(cleaned)) {
    return `+254${cleaned.slice(1)}`
  }

  // Kenyan format without plus: 2547XXXXXXXX or 2541XXXXXXXX (12 digits)
  if (/^254[17]\d{8}$/.test(cleaned)) {
    return `+${cleaned}`
  }

  // Already prefixed with '+'
  if (cleaned.startsWith('+')) {
    return cleaned
  }

  // Default fallback for numbers provided without '+'
  return `+${cleaned}`
}
