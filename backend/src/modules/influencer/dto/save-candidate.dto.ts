import { z } from 'zod'

export const SaveCandidateSchema = z.object({
  profileId: z.string().min(1),
  note: z.string().max(1000).optional(),
  tags: z.array(z.string().min(1).max(50)).max(20).default([]),
})

export type SaveCandidateDto = z.infer<typeof SaveCandidateSchema>
