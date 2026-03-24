/**
 * Internal data structure combining InfluencerProfile + latest ProfileSnapshot
 * + latest ScoreRecord used by PDF and CSV generators.
 *
 * All nullable fields reflect the reality that API data may be incomplete.
 * status fields follow the DataStatus enum: FACT | ESTIMATED | UNAVAILABLE
 */

export interface ScoreBreakdownData {
  category: string
  score: number
  weight: number
  confidence: string
  status: string
  rationale: string
}

export interface ReportProfileData {
  // InfluencerProfile fields
  id: string
  platform: string
  username: string
  displayName: string | null
  profileUrl: string | null

  // ProfileSnapshot fields (latest snapshot, null if no snapshot exists)
  followerCount: number | null
  followerCountStatus: string
  followingCount: number | null
  followingCountStatus: string
  engagementRate: number | null
  engagementRateStatus: string
  mediaCount: number | null
  mediaCountStatus: string
  biography: string | null
  biographyStatus: string
  fetchedAt: Date | null

  // ScoreRecord fields (latest score, null if never scored)
  totalScore: number | null
  scoreConfidence: string | null
  scoringModel: string | null
  scoredAt: Date | null
  breakdowns: ScoreBreakdownData[]
}
