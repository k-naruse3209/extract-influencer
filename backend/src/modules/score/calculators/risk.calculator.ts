import type { SubScoreResult, SubScoreMap } from '../types/score.types'
import { clamp } from './clamp'

/**
 * Calculate the risk sub-score (MVP simplified version).
 *
 * Starting from a base of 70 (medium-risk default when data is sparse),
 * penalties are applied when key data signals are weak:
 *   - BRAND_FIT confidence LOW  -> -10
 *   - follower count UNAVAILABLE -> -5
 *
 * In MVP this score is always ESTIMATED with LOW confidence because it lacks
 * external risk-signal sources (e.g., controversy databases, sentiment APIs).
 *
 * Pure function -- no side-effects.
 */
export function calculateRiskScore(
  partialSubScores: Partial<SubScoreMap>,
  followerCountAvailable: boolean,
): SubScoreResult {
  const BASE_SCORE = 70
  let penalty = 0
  const reasons: string[] = []

  const brandFit = partialSubScores.BRAND_FIT
  if (brandFit && brandFit.confidence === 'LOW') {
    penalty += 10
    reasons.push('BRAND_FIT confidence is LOW (-10)')
  }

  if (!followerCountAvailable) {
    penalty += 5
    reasons.push('Follower count is UNAVAILABLE (-5)')
  }

  const score = clamp(BASE_SCORE - penalty, 0, 100)

  const rationale =
    reasons.length > 0
      ? `Base score ${BASE_SCORE} with penalties: ${reasons.join('; ')}. Final: ${score}/100.`
      : `Base score ${BASE_SCORE} with no additional penalties. Final: ${score}/100.`

  return {
    score,
    confidence: 'LOW',
    status: 'ESTIMATED',
    rationale,
  }
}
