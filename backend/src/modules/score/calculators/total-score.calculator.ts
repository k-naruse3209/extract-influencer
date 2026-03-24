import type {
  SubScoreMap,
  TotalScoreResult,
  WeightMap,
  ConfidenceLevel,
} from '../types/score.types'
import { clamp } from './clamp'

/**
 * Default category weights.
 * Sum must equal 1.0.
 */
export const DEFAULT_WEIGHTS: WeightMap = {
  BRAND_FIT: 0.3,
  ENGAGEMENT: 0.25,
  PSEUDO_ACTIVITY: 0.25,
  RISK: 0.1,
  GROWTH: 0.1,
}

/**
 * Aggregate sub-scores into a single weighted total.
 *
 * Total = round( SUM( subScore[cat].score * weight[cat] ) )
 *
 * Overall confidence is derived from the engagement and pseudo-activity
 * sub-scores because those are the two data-driven pillars:
 *   - Both FACT       -> HIGH
 *   - One ESTIMATED   -> MEDIUM
 *   - Any UNAVAILABLE -> LOW
 *
 * Pure function -- no side-effects.
 */
export function calculateTotalScore(
  subScores: SubScoreMap,
  weights: WeightMap = DEFAULT_WEIGHTS,
): TotalScoreResult {
  const rawTotal = (Object.keys(weights) as Array<keyof WeightMap>).reduce(
    (sum, cat) => sum + subScores[cat].score * weights[cat],
    0,
  )

  const totalScore = clamp(Math.round(rawTotal), 0, 100)
  const confidence = deriveOverallConfidence(subScores)
  const status = deriveOverallStatus(subScores)

  return {
    totalScore,
    confidence,
    status,
    subScores,
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function deriveOverallConfidence(subScores: SubScoreMap): ConfidenceLevel {
  const engagement = subScores.ENGAGEMENT
  const pseudoActivity = subScores.PSEUDO_ACTIVITY

  if (
    engagement.status === 'UNAVAILABLE' ||
    pseudoActivity.status === 'UNAVAILABLE'
  ) {
    return 'LOW'
  }

  if (
    engagement.status === 'FACT' &&
    pseudoActivity.status === 'FACT'
  ) {
    return 'HIGH'
  }

  return 'MEDIUM'
}

function deriveOverallStatus(
  subScores: SubScoreMap,
): 'FACT' | 'ESTIMATED' | 'UNAVAILABLE' {
  const statuses = Object.values(subScores).map((s) => s.status)

  if (statuses.includes('UNAVAILABLE')) return 'ESTIMATED'
  if (statuses.every((s) => s === 'FACT')) return 'FACT'
  return 'ESTIMATED'
}
