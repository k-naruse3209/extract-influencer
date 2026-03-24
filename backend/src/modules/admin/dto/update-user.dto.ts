import { z } from 'zod'

export const UpdateUserSchema = z
  .object({
    role: z.enum(['ADMIN', 'ANALYST', 'VIEWER']).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => data.role !== undefined || data.isActive !== undefined, {
    message: 'At least one of role or isActive must be provided',
  })

export type UpdateUserDto = z.infer<typeof UpdateUserSchema>
