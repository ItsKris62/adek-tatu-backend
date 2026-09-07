import { z } from 'zod'

export const createDocumentSchema = z.object({
  title: z.string().min(2).max(255),
  slug: z
    .string()
    .min(2)
    .max(255)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens'),
  documentType: z.enum(['CONSTITUTION', 'PARTY_RULES', 'MANIFESTO', 'MEMBERSHIP_FORM', 'OTHER']),
  description: z.string().max(1000).optional(),
  fileUrl: z.string().url(),
  version: z.string().max(50).optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).default('DRAFT'),
  publishedAt: z.string().datetime().optional(),
})

export type CreateDocumentInput = z.infer<typeof createDocumentSchema>

export const updateDocumentSchema = createDocumentSchema.partial()
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>
