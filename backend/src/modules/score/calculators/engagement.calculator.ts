import type { SnapshotData, SubScoreResult } from '../types/score.types'
import { clamp } from './clamp'

/**
 * Calculate the engagement quality sub-score.
 *
 * The score is derived from the engagement rate (avgLikesPerPost / followerCount).
 * When pre-calculated engagementRate is available from the snapshot, it is used
 * directly. Otherwise the function attempts to compute it from avgLikesPerPost
 * and followerCount.
 *
 * Thresholds (based on industry benchmarks for Instagram micro-to-mid influencers):
 *   >= 0.06   -> 90-100  (exceptional)
 *   >= 0.03   -> 70-89   (strong)
 *   >= 0.01   -> 50-69   (average)
 *   >= 0.005  -> 30-49   (below average)
 *   <  0.005  -> 0-29    (poor)
 *
 * Pure function -- no side-effects.
 */
export function calculateEngagementScore(
  snapshot: SnapshotData,
): SubScoreResult {
  const rate = resolveEngagementRate(snapshot)

  if (rate === null) {
    return {
      score: 0,
      confidence: 'LOW',
      status: 'UNAVAILABLE',
      rationale:
        'Engagement rate could not be calculated: follower count or average likes data is missing.',
    }
  }

  const score = mapRateToScore(rate)
  const confidence = deriveConfidence(snapshot)
  const status = deriveStatus(snapshot)

  return {
    score,
    confidence,
    status,
    rationale: buildRationale(rate, score),
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function resolveEngagementRate(snapshot: SnapshotData): number | null {
  // Prefer pre-calculated rate when present
  if (
    snapshot.engagementRate !== null &&
    snapshot.engagementRate >= 0
  ) {
    return snapshot.engagementRate
  }

  // Fallback: compute from avgLikes / followers
  if (
    snapshot.avgLikesPerPost !== null &&
    snapshot.followerCount !== null &&
    snapshot.followerCount > 0
  ) {
    return snapshot.avgLikesPerPost / snapshot.followerCount
  }

  return null
}

/**
 * Linear interpolation within a tier.
 * lowerBound and upperBound are engagement rate thresholds;
 * scoreLow and scoreHigh are the score boundaries of that tier.
 */
function lerp(
  rate: number,
  lowerBound: number,
  upperBound: number,
  scoreLow: number,
  scoreHigh: number,
): number {
  const t = (rate - lowerBound) / (upperBound - lowerBound)
  return clamp(Math.round(scoreLow + t * (scoreHigh - scoreLow)), 0, 100)
}

function mapRateToScore(rate: number): number {
  if (rate >= 0.06) return lerp(rate, 0.06, 0.12, 90, 100)
  if (rate >= 0.03) return lerp(rate, 0.03, 0.06, 70, 89)
  if (rate >= 0.01) return lerp(rate, 0.01, 0.03, 50, 69)
  if (rate >= 0.005) return lerp(rate, 0.005, 0.01, 30, 49)
  return lerp(rate, 0, 0.005, 0, 29)
}

function deriveConfidence(snapshot: SnapshotData): 'LOW' | 'MEDIUM' | 'HIGH' {
  if (
    snapshot.engagementRateStatus === 'FACT' ||
    (snapshot.avgLikesPerPostStatus === 'FACT' &&
      snapshot.followerCountStatus === 'FACT')
  ) {
    return 'HIGH'
  }
  if (
    snapshot.engagementRateStatus === 'ESTIMATED' ||
    snapshot.avgLikesPerPostStatus === 'ESTIMATED'
  ) {
    return 'MEDIUM'
  }
  return 'LOW'
}

function deriveStatus(
  snapshot: SnapshotData,
): 'FACT' | 'ESTIMATED' | 'UNAVAILABLE' {
  if (
    snapshot.engagementRateStatus === 'FACT' &&
    snapshot.followerCountStatus === 'FACT'
  ) {
    return 'FACT'
  }
  return 'ESTIMATED'
}

function buildRationale(rate: number, score: number): string {
  const pct = (rate * 100).toFixed(2)
  return `Engagement rate ${pct}% mapped to score ${score}/100.`
}
