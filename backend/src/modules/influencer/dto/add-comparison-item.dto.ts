import { z } from 'zod'

export const AddComparisonItemSchema = z.object({
  profileId: z.string().min(1),
})

export type AddComparisonItemDto = z.infer<typeof AddComparisonItemSchema>
