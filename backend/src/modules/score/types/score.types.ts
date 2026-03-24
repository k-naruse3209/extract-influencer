/**
 * Score module shared types.
 *
 * Pure data structures used by calculator functions.
 * No framework dependencies -- keep this file free of NestJS / Prisma imports.
 */

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

/**
 * Snapshot data normalised for score calculators.
 * All nullable fields reflect the reality that Instagram API responses are
 * frequently incomplete (private accounts, rate limits, etc.).
 */
export interface SnapshotData {
  followerCount: number | null
  followerCountStatus: DataStatusValue
  followingCount: number | null
  followingCountStatus: DataStatusValue
  engagementRate: number | null
  engagementRateStatus: DataStatusValue
  avgLikesPerPost: number | null
  avgLikesPerPostStatus: DataStatusValue
  avgCommentsPerPost: number | null
  avgCommentsPerPostStatus: DataStatusValue
  mediaCount: number | null
  mediaCountStatus: DataStatusValue
  fetchedAt: Date
}

/**
 * A pair of snapshots used by the growth calculator.
 * `older` is the earlier snapshot and `newer` is the more recent one.
 */
export interface SnapshotPair {
  older: SnapshotData
  newer: SnapshotData
}

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export type ConfidenceLevel = 'LOW' | 'MEDIUM' | 'HIGH'
export type DataStatusValue = 'FACT' | 'ESTIMATED' | 'UNAVAILABLE'

export type ScoreCategoryValue =
  | 'BRAND_FIT'
  | 'ENGAGEMENT'
  | 'PSEUDO_ACTIVITY'
  | 'RISK'
  | 'GROWTH'

/**
 * Result of a single sub-score calculation.
 * Every calculator returns this shape so that callers can uniformly process
 * scores, rationales, and confidence levels.
 */
export interface SubScoreResult {
  /** Normalised score in the range 0-100. */
  score: number
  /** Reliability of the underlying data. */
  confidence: ConfidenceLevel
  /** Origin / nature of the data behind this score. */
  status: DataStatusValue
  /** Human-readable explanation of how the score was derived. */
  rationale: string
}

export type SubScoreMap = Record<ScoreCategoryValue, SubScoreResult>

/**
 * Weights for each score category.
 * Values should sum to 1.0.
 */
export type WeightMap = Record<ScoreCategoryValue, number>

/**
 * Output of the total score aggregation.
 */
export interface TotalScoreResult {
  totalScore: number
  confidence: ConfidenceLevel
  status: DataStatusValue
  subScores: SubScoreMap
}
