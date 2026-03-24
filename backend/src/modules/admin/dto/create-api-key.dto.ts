import { z } from 'zod'

export const CreateApiKeySchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must not exceed 100 characters'),
  permissions: z
    .array(z.enum(['read', 'write', 'admin']))
    .min(1, 'At least one permission is required'),
  expiresAt: z.coerce.date().optional(),
})

export type CreateApiKeyDto = z.infer<typeof CreateApiKeySchema>
