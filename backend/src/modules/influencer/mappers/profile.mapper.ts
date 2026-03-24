import type {
  InfluencerProfile,
  ProfileSnapshot,
  ScoreRecord,
  ScoreBreakdown,
  DataStatus,
  Confidence,
} from '@prisma/client'
import type {
  DataField,
  InfluencerProfileResponse,
  SnapshotResponse,
  LatestScoreResponse,
} from '../types/influencer-profile.response'

type ProfileWithRelations = InfluencerProfile & {
  snapshots: ProfileSnapshot[]
  scoreRecords: (ScoreRecord & { breakdowns: ScoreBreakdown[] })[]
}

/**
 * Convert a Prisma DataStatus enum value to the response-layer union literal.
 * Prisma enums are strings at runtime, but we type-assert for safety.
 */
function mapDataStatus(status: DataStatus): 'FACT' | 'ESTIMATED' | 'UNAVAILABLE' {
  return status as 'FACT' | 'ESTIMATED' | 'UNAVAILABLE'
}

/**
 * Convert a nullable Prisma Confidence to the response-layer optional literal.
 */
function mapConfidence(confidence: Confidence | null | undefined): 'LOW' | 'MEDIUM' | 'HIGH' | undefined {
  if (!confidence) return undefined
  return confidence as 'LOW' | 'MEDIUM' | 'HIGH'
}

/**
 * Build a DataField from a nullable value and its associated DataStatus column.
 * When value is null and status is FACT, we treat it as UNAVAILABLE to avoid
 * misleading consumers about data quality.
 */
function buildDataField<T>(
  value: T | null | undefined,
  status: DataStatus,
  source: string,
  confidence?: Confidence | null,
): DataField<T> {
  if (value === null || value === undefined) {
    return {
      value: null,
      status: 'UNAVAILABLE',
      source,
    }
  }

  return {
    value,
    status: mapDataStatus(status),
    source,
    ...(confidence !== null && confidence !== undefined
      ? { confidence: mapConfidence(confidence) }
      : {}),
  }
}

/**
 * Map the most-recent ProfileSnapshot to the SnapshotResponse shape.
 * Returns null when no snapshot exists (profile freshly created).
 */
function mapSnapshot(snapshot: ProfileSnapshot | undefined): SnapshotResponse | null {
  if (!snapshot) return null

  const dataSource = snapshot.dataSource

  return {
    followerCount: buildDataField(snapshot.followerCount, snapshot.followerCountStatus, dataSource),
    followingCount: buildDataField(snapshot.followingCount, snapshot.followingCountStatus, dataSource),
    mediaCount: buildDataField(snapshot.mediaCount, snapshot.mediaCountStatus, dataSource),
    engagementRate: buildDataField(
      snapshot.engagementRate,
      snapshot.engagementRateStatus,
      'calculated',
      snapshot.engagementRateConfidence,
    ),
    biography: buildDataField(snapshot.biography, snapshot.biographyStatus, dataSource),
    fetchedAt: snapshot.fetchedAt.toISOString(),
  }
}

/**
 * Map the most-recent ScoreRecord (with its breakdowns) to LatestScoreResponse.
 * Returns null when no score has been computed yet.
 */
function mapLatestScore(
  scoreRecord: (ScoreRecord & { breakdowns: ScoreBreakdown[] }) | undefined,
): LatestScoreResponse | null {
  if (!scoreRecord) return null

  return {
    totalScore: scoreRecord.totalScore,
    confidence: scoreRecord.confidence,
    breakdowns: scoreRecord.breakdowns.map((bd) => ({
      category: bd.category,
      score: bd.score,
      confidence: bd.confidence,
    })),
    scoredAt: scoreRecord.scoredAt.toISOString(),
  }
}

/**
 * Map a full InfluencerProfile with its eagerly-loaded relations to the API
 * response shape.  Relations must be pre-sorted descending by date so that
 * [0] is always the latest entry.
 */
export function mapProfileToResponse(profile: ProfileWithRelations): InfluencerProfileResponse {
  const latestSnapshot = profile.snapshots[0]
  const latestScoreRecord = profile.scoreRecords[0]

  return {
    id: profile.id,
    platform: profile.platform,
    username: profile.username,
    displayName: profile.displayName ?? null,
    profileUrl: profile.profileUrl ?? null,
    latestSnapshot: mapSnapshot(latestSnapshot),
    latestScore: mapLatestScore(latestScoreRecord),
    createdAt: profile.createdAt.toISOString(),
  }
}
