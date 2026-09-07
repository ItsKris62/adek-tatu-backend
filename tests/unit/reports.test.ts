import { describe, it, expect } from 'vitest'
import { sanitizeCsvField } from '../../src/modules/admin/reports/reportsService'
import {
  membershipSummaryQuerySchema,
  membershipExportQuerySchema,
  membersRegisterQuerySchema,
} from '../../src/modules/admin/reports/reportsSchemas'

describe('Reporting & Member Register Unit Tests', () => {
  describe('CSV Formula Injection Prevention', () => {
    it('should sanitize cell starting with =', () => {
      const result = sanitizeCsvField('=SUM(A1:A10)')
      expect(result).toBe("\"'=SUM(A1:A10)\"")
    })

    it('should sanitize cell starting with +', () => {
      const result = sanitizeCsvField('+cmd|/C calc!A0')
      expect(result).toBe("\"'+cmd|/C calc!A0\"")
    })

    it('should sanitize cell starting with -', () => {
      const result = sanitizeCsvField('-2+3+cmd|')
      expect(result).toBe("\"'-2+3+cmd|\"")
    })

    it('should sanitize cell starting with @', () => {
      const result = sanitizeCsvField('@SUM(1+1)')
      expect(result).toBe("\"'@SUM(1+1)\"")
    })

    it('should sanitize cell starting with tab or carriage return', () => {
      const resultTab = sanitizeCsvField('\t=1+1')
      expect(resultTab).toBe("\"'\t=1+1\"")
    })

    it('should properly escape double quotes inside cell values', () => {
      const result = sanitizeCsvField('John "The Chief" Doe')
      expect(result).toBe('"John ""The Chief"" Doe"')
    })

    it('should handle null and undefined safely', () => {
      expect(sanitizeCsvField(null)).toBe('""')
      expect(sanitizeCsvField(undefined)).toBe('""')
    })
  })

  describe('Report Query Schemas Validation', () => {
    it('should accept valid date range where dateFrom <= dateTo', () => {
      const parsed = membershipSummaryQuerySchema.safeParse({
        dateFrom: '2026-01-01',
        dateTo: '2026-12-31',
        county: 'Nairobi',
        groupBy: 'county',
      })
      expect(parsed.success).toBe(true)
    })

    it('should reject dateFrom > dateTo', () => {
      const parsed = membershipSummaryQuerySchema.safeParse({
        dateFrom: '2026-12-31',
        dateTo: '2026-01-01',
      })
      expect(parsed.success).toBe(false)
      if (!parsed.success) {
        expect(parsed.error.issues[0].message).toContain('dateFrom must not be later than dateTo')
      }
    })

    it('should reject invalid date format', () => {
      const parsed = membershipSummaryQuerySchema.safeParse({
        dateFrom: 'not-a-date',
      })
      expect(parsed.success).toBe(false)
    })

    it('should enforce pagination bounds (pageSize <= 100, page >= 1)', () => {
      const parsedValid = membersRegisterQuerySchema.safeParse({
        page: 1,
        pageSize: 50,
      })
      expect(parsedValid.success).toBe(true)

      const parsedOverMax = membersRegisterQuerySchema.safeParse({
        pageSize: 500, // max is 100
      })
      expect(parsedOverMax.success).toBe(false)

      const parsedUnderMin = membersRegisterQuerySchema.safeParse({
        page: 0, // min is 1
      })
      expect(parsedUnderMin.success).toBe(false)
    })

    it('should reject invalid groupBy value', () => {
      const parsed = membershipSummaryQuerySchema.safeParse({
        groupBy: 'arbitrary_column_sql_injection',
      })
      expect(parsed.success).toBe(false)
    })
  })
})
