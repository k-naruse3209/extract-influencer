/**
 * API response shapes for score endpoints.
 *
 * Follows the project data-separation principle:
 *   - every value carries its status (FACT / ESTIMATED / UNAVAILABLE)
 *   - every value carries its confidence level
 */

export interface ScoreBreakdownResponse {
  category: string
  score: number
  weight: number
  confidence: string
  status: string
  rationale: string
}

export interface ScoreRecordResponse {
  id: string
  profileId: string
  totalScore: number
  confidence: string
  dataType: string
  scoringModel: string
  breakdowns: ScoreBreakdownResponse[]
  scoredAt: string
}
