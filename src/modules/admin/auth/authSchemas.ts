import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

export type LoginInput = z.infer<typeof loginSchema>

export const mfaVerifySchema = z.object({
  preAuthToken: z.string().min(16, 'Invalid pre-authentication challenge'),
  totpCode: z.string().length(6, 'TOTP code must be exactly 6 digits'),
})

export type MfaVerifyInput = z.infer<typeof mfaVerifySchema>

export const createAdminUserSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(10, 'Password must be at least 10 characters'),
  role: z.enum(['SUPER_ADMIN', 'CONTENT_EDITOR', 'RECRUITMENT_OFFICER']),
  enableMfa: z.boolean().default(false),
})

export type CreateAdminUserInput = z.infer<typeof createAdminUserSchema>
