import { z } from 'zod'

export const createNewsSchema = z.object({
  title: z.string().min(3).max(255),
  slug: z
    .string()
    .min(3)
    .max(255)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens'),
  excerpt: z.string().min(10).max(500),
  body: z.string().min(10),
  featuredImageUrl: z.string().url().optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).default('DRAFT'),
  publishedAt: z.string().datetime().optional(),
})

export type CreateNewsInput = z.infer<typeof createNewsSchema>

export const updateNewsSchema = createNewsSchema.partial()
export type UpdateNewsInput = z.infer<typeof updateNewsSchema>
