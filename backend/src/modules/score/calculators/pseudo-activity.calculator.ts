import type { SnapshotData, SubScoreResult } from '../types/score.types'
import { clamp } from './clamp'

/**
 * Calculate the pseudo-activity (fake follower risk) sub-score.
 *
 * A *high* score means the account looks healthy (genuine followers).
 * A *low* score indicates follow-back patterns typical of purchased audiences.
 *
 * Metric: followingCount / followerCount ratio
 *   ratio <= 0.1  AND followerCount >= 10 000  -> 80-100 (healthy)
 *   ratio <= 0.3                               -> 60-79
 *   ratio <= 1.0                               -> 40-59
 *   ratio >  1.0                               -> 0-39  (high risk)
 *
 * Pure function -- no side-effects.
 */
export function calculatePseudoActivityScore(
  snapshot: SnapshotData,
): SubScoreResult {
  if (
    snapshot.followerCount === null ||
    snapshot.followerCount <= 0 ||
    snapshot.followingCount === null
  ) {
    return {
      score: 0,
      confidence: 'LOW',
      status: 'UNAVAILABLE',
      rationale:
        'Pseudo-activity score could not be calculated: follower or following count is missing.',
    }
  }

  const ratio = snapshot.followingCount / snapshot.followerCount
  const score = mapRatioToScore(ratio, snapshot.followerCount)
  const confidence = deriveConfidence(snapshot)
  const status = deriveStatus(snapshot)

  return {
    score,
    confidence,
    status,
    rationale: buildRationale(ratio, snapshot.followerCount, score),
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function lerp(
  value: number,
  lowerBound: number,
  upperBound: number,
  scoreLow: number,
  scoreHigh: number,
): number {
  const t = (value - lowerBound) / (upperBound - lowerBound)
  return clamp(Math.round(scoreLow + t * (scoreHigh - scoreLow)), 0, 100)
}

function mapRatioToScore(ratio: number, followerCount: number): number {
  if (ratio <= 0.1 && followerCount >= 10_000) {
    return lerp(ratio, 0, 0.1, 100, 80)
  }
  if (ratio <= 0.3) {
    // For accounts with ratio <= 0.1 but followerCount < 10_000, start from
    // the top of this tier rather than extrapolating outside range.
    const effectiveRatio = Math.max(ratio, 0.1)
    return lerp(effectiveRatio, 0.1, 0.3, 79, 60)
  }
  if (ratio <= 1.0) {
    return lerp(ratio, 0.3, 1.0, 59, 40)
  }
  // ratio > 1.0
  return lerp(ratio, 1.0, 3.0, 39, 0)
}

function deriveConfidence(
  snapshot: SnapshotData,
): 'LOW' | 'MEDIUM' | 'HIGH' {
  if (
    snapshot.followerCountStatus === 'FACT' &&
    snapshot.followingCountStatus === 'FACT'
  ) {
    return 'HIGH'
  }
  if (
    snapshot.followerCountStatus === 'ESTIMATED' ||
    snapshot.followingCountStatus === 'ESTIMATED'
  ) {
    return 'MEDIUM'
  }
  return 'LOW'
}

function deriveStatus(
  snapshot: SnapshotData,
): 'FACT' | 'ESTIMATED' | 'UNAVAILABLE' {
  if (
    snapshot.followerCountStatus === 'FACT' &&
    snapshot.followingCountStatus === 'FACT'
  ) {
    return 'FACT'
  }
  return 'ESTIMATED'
}

function buildRationale(
  ratio: number,
  followerCount: number,
  score: number,
): string {
  return (
    `Following/follower ratio ${ratio.toFixed(3)} ` +
    `(followers: ${followerCount}) mapped to score ${score}/100.`
  )
}
