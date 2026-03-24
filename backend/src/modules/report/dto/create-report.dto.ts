import { z } from 'zod'

/**
 * Zod schema for report generation request.
 *
 * format: PDF or CSV
 * reportType: SINGLE_PROFILE / COMPARISON / BATCH_EXPORT
 * profileIds: 1-10 CUID strings pointing to InfluencerProfile records
 * title: optional human-readable label stored in the Report row
 */
export const CreateReportSchema = z.object({
  format: z.enum(['PDF', 'CSV']),
  reportType: z.enum(['SINGLE_PROFILE', 'COMPARISON', 'BATCH_EXPORT']),
  profileIds: z.array(z.string().cuid()).min(1).max(10),
  title: z.string().min(1).max(200).optional(),
})

export type CreateReportDto = z.infer<typeof CreateReportSchema>
