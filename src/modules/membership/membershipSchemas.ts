import { z } from 'zod'

export const submitMembershipSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters').max(255),
  email: z.string().email('Enter a valid email address').max(255),
  phone: z.string().min(8, 'Enter a valid phone number').max(50),
  county: z.string().min(1, 'County is required').max(100),
  constituency: z.string().min(1, 'Constituency is required').max(100),
  idNumber: z.string().min(4, 'National ID number is required').max(30),
  occupation: z.string().min(1, 'Occupation is required').max(150),
  consent: z.literal(true, {
    errorMap: () => ({ message: 'Consent is required to submit membership registration' }),
  }),
  consentVersion: z.string().default('v1.0-demo'),
  consentText: z.string().optional(),
})

export type SubmitMembershipInput = z.infer<typeof submitMembershipSchema>

export const statusLookupParamsSchema = z.object({
  reference: z.string().min(5, 'Invalid application reference').max(64),
})
