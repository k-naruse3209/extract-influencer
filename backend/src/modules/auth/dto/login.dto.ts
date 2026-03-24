import { z } from 'zod'

export const LoginSchema = z.object({
  email: z
    .string()
    .email('Valid email address is required')
    .max(255, 'Email must not exceed 255 characters'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password must not exceed 100 characters'),
})

export type LoginDto = z.infer<typeof LoginSchema>
