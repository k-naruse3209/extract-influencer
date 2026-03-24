import { z } from 'zod'

export const FindInfluencerQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  platform: z.enum(['INSTAGRAM', 'TIKTOK']).optional(),
  username: z.string().optional(),
})

export type FindInfluencerQueryDto = z.infer<typeof FindInfluencerQuerySchema>
