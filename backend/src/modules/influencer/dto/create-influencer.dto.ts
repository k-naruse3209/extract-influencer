import { z } from 'zod'

export const CreateInfluencerSchema = z.object({
  platform: z.enum(['INSTAGRAM', 'TIKTOK']).default('INSTAGRAM'),
  username: z.string().min(1).max(100),
  profileUrl: z.string().url().optional(),
})

export type CreateInfluencerDto = z.infer<typeof CreateInfluencerSchema>
