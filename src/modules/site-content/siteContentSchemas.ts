import { z } from 'zod'

export const updateSiteContentSchema = z.object({
  title: z.string().min(2).max(255).optional(),
  contentJson: z.record(z.any()),
  status: z
    .enum(['APPROVED', 'DRAFT', 'PENDING_CLIENT_INPUT', 'PLACEHOLDER', 'DO_NOT_PUBLISH'])
    .default('DRAFT'),
})

export type UpdateSiteContentInput = z.infer<typeof updateSiteContentSchema>
