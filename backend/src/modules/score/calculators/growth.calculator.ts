import type {
  SnapshotData,
  SnapshotPair,
  SubScoreResult,
} from '../types/score.types'
import { clamp } from './clamp'

/**
 * Calculate the growth trajectory sub-score.
 *
 * When only one snapshot is available the score defaults to 50 (neutral)
 * with UNAVAILABLE status because a trend cannot be derived from a single
 * data point.
 *
 * When two or more snapshots are available the monthly follower growth rate
 * is computed:
 *   growthRate = (newer.followers - older.followers) / older.followers
 *              / monthsBetween
 *
 *   > 0.10 /month  -> 80-100 (rapid healthy growth)
 *   > 0.05 /month  -> 60-79  (steady growth)
 *   >= 0   /month  -> 40-59  (stable or stagnant)
 *   < 0    /month  -> 20-39  (declining)
 *
 * Pure function -- no side-effects.
 */
export function calculateGrowthScore(
  snapshots: ReadonlyArray<SnapshotData>,
): SubScoreResult {
  if (snapshots.length < 2) {
    return {
      score: 50,
      confidence: 'LOW',
      status: 'UNAVAILABLE',
      rationale:
        'Only one snapshot available; growth trend cannot be determined. Default neutral score 50/100.',
    }
  }

  // Sort ascending by fetchedAt so [0] is oldest, [last] is newest.
  const sorted = [...snapshots].sort(
    (a, b) => a.fetchedAt.getTime() - b.fetchedAt.getTime(),
  )

  const pair: SnapshotPair = {
    older: sorted[0],
    newer: sorted[sorted.length - 1],
  }

  return scoreFromPair(pair)
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function scoreFromPair(pair: SnapshotPair): SubScoreResult {
  const { older, newer } = pair

  if (
    older.followerCount === null ||
    older.followerCount <= 0 ||
    newer.followerCount === null
  ) {
    return {
      score: 50,
      confidence: 'LOW',
      status: 'UNAVAILABLE',
      rationale:
        'Follower count missing in one or both snapshots. Default neutral score 50/100.',
    }
  }

  const months = monthsBetween(older.fetchedAt, newer.fetchedAt)
  if (months <= 0) {
    return {
      score: 50,
      confidence: 'LOW',
      status: 'ESTIMATED',
      rationale:
        'Snapshots are from the same point in time; cannot derive growth. Default neutral score 50/100.',
    }
  }

  const rawGrowth =
    (newer.followerCount - older.followerCount) / older.followerCount
  const monthlyRate = rawGrowth / months

  const score = mapGrowthRateToScore(monthlyRate)
  const confidence = deriveConfidence(pair)

  return {
    score,
    confidence,
    status: 'ESTIMATED',
    rationale: buildRationale(monthlyRate, months, score),
  }
}

function monthsBetween(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime()
  return ms / (1000 * 60 * 60 * 24 * 30)
}

function lerp(
  value: number,
  lo: number,
  hi: number,
  scoreLo: number,
  scoreHi: number,
): number {
  const t = (value - lo) / (hi - lo)
  return clamp(Math.round(scoreLo + t * (scoreHi - scoreLo)), 0, 100)
}

function mapGrowthRateToScore(rate: number): number {
  if (rate > 0.1) return lerp(rate, 0.1, 0.3, 80, 100)
  if (rate > 0.05) return lerp(rate, 0.05, 0.1, 60, 79)
  if (rate >= 0) return lerp(rate, 0, 0.05, 40, 59)
  // negative growth
  return lerp(rate, -0.1, 0, 20, 39)
}

function deriveConfidence(
  pair: SnapshotPair,
): 'LOW' | 'MEDIUM' | 'HIGH' {
  if (
    pair.older.followerCountStatus === 'FACT' &&
    pair.newer.followerCountStatus === 'FACT'
  ) {
    return 'HIGH'
  }
  return 'MEDIUM'
}

function buildRationale(
  monthlyRate: number,
  months: number,
  score: number,
): string {
  const pct = (monthlyRate * 100).toFixed(2)
  return (
    `Monthly follower growth rate ${pct}% ` +
    `over ${months.toFixed(1)} months mapped to score ${score}/100.`
  )
}
