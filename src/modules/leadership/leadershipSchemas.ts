import { z } from 'zod'

export const createLeadershipSchema = z.object({
  name: z.string().min(2).max(255),
  position: z.string().min(2).max(255),
  bio: z.string().max(2000).optional(),
  imageUrl: z.string().url().optional(),
  displayOrder: z.coerce.number().default(0),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).default('DRAFT'),
})

export type CreateLeadershipInput = z.infer<typeof createLeadershipSchema>

export const updateLeadershipSchema = createLeadershipSchema.partial()
export type UpdateLeadershipInput = z.infer<typeof updateLeadershipSchema>
