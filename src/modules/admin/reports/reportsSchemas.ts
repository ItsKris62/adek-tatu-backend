import { z } from 'zod'
import { applicationStatuses } from '../../../db/schema/membershipApplications'

const dateRegex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/

export const membershipSummaryQuerySchema = z
  .object({
    dateFrom: z
      .string()
      .regex(dateRegex, 'dateFrom must be in YYYY-MM-DD or ISO 8601 format')
      .optional(),
    dateTo: z
      .string()
      .regex(dateRegex, 'dateTo must be in YYYY-MM-DD or ISO 8601 format')
      .optional(),
    county: z.string().trim().max(100).optional(),
    constituency: z.string().trim().max(100).optional(),
    groupBy: z.enum(['county', 'status']).optional(),
  })
  .refine(
    (data) => {
      if (data.dateFrom && data.dateTo) {
        return new Date(data.dateFrom) <= new Date(data.dateTo)
      }
      return true
    },
    {
      message: 'dateFrom must not be later than dateTo',
      path: ['dateFrom'],
    }
  )

export type MembershipSummaryQuery = z.infer<typeof membershipSummaryQuerySchema>

export const membershipExportQuerySchema = z
  .object({
    format: z.enum(['csv']).default('csv'),
    status: z.enum(applicationStatuses).optional(),
    county: z.string().trim().max(100).optional(),
    constituency: z.string().trim().max(100).optional(),
    dateFrom: z
      .string()
      .regex(dateRegex, 'dateFrom must be in YYYY-MM-DD or ISO 8601 format')
      .optional(),
    dateTo: z
      .string()
      .regex(dateRegex, 'dateTo must be in YYYY-MM-DD or ISO 8601 format')
      .optional(),
  })
  .refine(
    (data) => {
      if (data.dateFrom && data.dateTo) {
        return new Date(data.dateFrom) <= new Date(data.dateTo)
      }
      return true
    },
    {
      message: 'dateFrom must not be later than dateTo',
      path: ['dateFrom'],
    }
  )

export type MembershipExportQuery = z.infer<typeof membershipExportQuerySchema>

export const membersRegisterQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
    county: z.string().trim().max(100).optional(),
    constituency: z.string().trim().max(100).optional(),
    dateFrom: z
      .string()
      .regex(dateRegex, 'dateFrom must be in YYYY-MM-DD or ISO 8601 format')
      .optional(),
    dateTo: z
      .string()
      .regex(dateRegex, 'dateTo must be in YYYY-MM-DD or ISO 8601 format')
      .optional(),
    search: z.string().trim().max(100).optional(),
  })
  .refine(
    (data) => {
      if (data.dateFrom && data.dateTo) {
        return new Date(data.dateFrom) <= new Date(data.dateTo)
      }
      return true
    },
    {
      message: 'dateFrom must not be later than dateTo',
      path: ['dateFrom'],
    }
  )

export type MembersRegisterQuery = z.infer<typeof membersRegisterQuerySchema>
