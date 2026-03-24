/**
 * Data field wrapper that enforces the data-separation principle:
 * fact / estimated / unavailable values must be explicitly typed.
 *
 * ADR-002: すべてのデータフィールドは type + source を持つ。
 * null は返さない。取得不可の場合は status: "UNAVAILABLE" を使う。
 */
export interface DataField<T> {
  value: T | null
  status: 'FACT' | 'ESTIMATED' | 'UNAVAILABLE'
  confidence?: 'LOW' | 'MEDIUM' | 'HIGH'
  source?: string
}

export interface SnapshotResponse {
  followerCount: DataField<number>
  followingCount: DataField<number>
  mediaCount: DataField<number>
  engagementRate: DataField<number>
  biography: DataField<string>
  fetchedAt: string
}

export interface ScoreBreakdownResponse {
  category: string
  score: number
  confidence: string
}

export interface LatestScoreResponse {
  totalScore: number
  confidence: string
  breakdowns: ScoreBreakdownResponse[]
  scoredAt: string
}

export interface InfluencerProfileResponse {
  id: string
  platform: string
  username: string
  displayName: string | null
  profileUrl: string | null
  latestSnapshot: SnapshotResponse | null
  latestScore: LatestScoreResponse | null
  createdAt: string
}
