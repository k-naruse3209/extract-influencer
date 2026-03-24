/**
 * instagram-fetch キューのジョブデータ型定義。
 *
 * キュー名: "instagram-fetch"
 *
 * ジョブ優先度（小さいほど高優先）:
 *   PROFILE       : 1 — ユーザーが手動で起動したプロフィール取得（高優先）
 *   TOKEN_REFRESH : 3 — トークン有効期限前の定期更新
 *   MEDIA_INSIGHTS: 5 — バックグラウンドでのメディア統計収集（低優先）
 *
 * レート制限 200 calls/hour/user token を考慮し、
 * 同一ユーザーの並列ジョブ数は InstagramFetchProcessor 側で制御する。
 */

export const INSTAGRAM_FETCH_QUEUE = 'instagram-fetch'

export type ProfileFetchJob = {
  type: 'PROFILE'
  profileId: string
  userId: string
  priority: 1
}

export type MediaInsightsJob = {
  type: 'MEDIA_INSIGHTS'
  profileId: string
  userId: string
  priority: 5
}

export type TokenRefreshJob = {
  type: 'TOKEN_REFRESH'
  userId: string
  priority: 3
}

export type InstagramFetchJobData =
  | ProfileFetchJob
  | MediaInsightsJob
  | TokenRefreshJob
