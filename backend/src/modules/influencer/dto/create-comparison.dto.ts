import { z } from 'zod'

export const CreateComparisonSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  profileIds: z
    .array(z.string().min(1))
    .min(1)
    .max(10, { message: 'Comparison session cannot contain more than 10 profiles' }),
})

export type CreateComparisonDto = z.infer<typeof CreateComparisonSchema>
