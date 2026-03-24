import { z } from 'zod'

export const CreateUserSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must not exceed 100 characters'),
  email: z
    .string()
    .email('Valid email address is required')
    .max(255, 'Email must not exceed 255 characters'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password must not exceed 100 characters'),
  role: z.enum(['ADMIN', 'ANALYST', 'VIEWER']).default('VIEWER'),
})

export type CreateUserDto = z.infer<typeof CreateUserSchema>
