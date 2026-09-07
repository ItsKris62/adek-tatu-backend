import { z } from 'zod'

export const applicationFilterSchema = z.object({
  page: z.coerce.number().optional(),
  pageSize: z.coerce.number().optional(),
  status: z
    .enum(['ALL', 'SUBMITTED', 'UNDER_REVIEW', 'CORRECTION_REQUIRED', 'APPROVED', 'REJECTED', 'WITHDRAWN'])
    .optional(),
  search: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
})

export type ApplicationFilterQuery = z.infer<typeof applicationFilterSchema>

export const updateApplicationStatusSchema = z.object({
  status: z.enum([
    'SUBMITTED',
    'UNDER_REVIEW',
    'CORRECTION_REQUIRED',
    'APPROVED',
    'REJECTED',
    'WITHDRAWN',
  ]),
  note: z.string().max(1000).optional(),
})

export type UpdateApplicationStatusInput = z.infer<typeof updateApplicationStatusSchema>

export const addApplicationReviewSchema = z.object({
  note: z.string().min(1, 'Review note cannot be empty').max(1000),
})

export type AddApplicationReviewInput = z.infer<typeof addApplicationReviewSchema>
