/**
 * Instagram API から取得したプロフィールデータの内部表現。
 *
 * 取得可能なのは Business / Creator アカウントのみ。
 * PERSONAL アカウントの場合、followerCount 等は null になる（API 制約）。
 * null フィールドは ProfileSnapshot 保存時に DataStatus.UNAVAILABLE として扱う。
 *
 * 参照: https://developers.facebook.com/docs/instagram-api/reference/ig-user
 */
export interface InstagramProfileData {
  id: string
  username: string
  name: string | null
  biography: string | null
  followersCount: number | null
  followsCount: number | null
  mediaCount: number | null
  profilePictureUrl: string | null
  website: string | null
  /**
   * PERSONAL アカウントは followers_count 等の取得不可。
   * accountType === 'PERSONAL' の場合、スナップショット保存時に
   * フォロワー系フィールドを DataStatus.UNAVAILABLE とする。
   */
  accountType: 'BUSINESS' | 'CREATOR' | 'PERSONAL' | null
}

/**
 * Instagram API から取得したメディアインサイトデータの内部表現。
 * getMediaInsights (single media fields) の既存用途で使用する。
 */
export interface InstagramMediaData {
  id: string
  likeCount: number | null
  commentsCount: number | null
  timestamp: string
  mediaType: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM' | null
}

/**
 * ユーザーのメディア一覧 1 件の内部表現。
 * GET /{user-id}/media から取得する。
 */
export interface InstagramMedia {
  id: string
  timestamp: string
  mediaType: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM' | null
  likeCount: number | null
  commentsCount: number | null
  caption: string | null
  permalink: string | null
}

/**
 * 個別メディアの Insights (Business/Creator アカウント専用)。
 * GET /{media-id}/insights から取得する。
 */
export interface InstagramMediaInsights {
  reach: number | null
  impressions: number | null
  engagement: number | null
  saved: number | null
}

/**
 * fetchAndSaveMediaInsights で計算した集計統計。
 * ProfileSnapshot の engagementRate 等の算出材料として使う。
 */
export interface MediaStats {
  avgLikes: number | null
  avgComments: number | null
  avgReach: number | null
  postCount: number
  engagementRate: number | null
}

/**
 * Instagram API の生レスポンス型（メディア一覧）。
 */
export interface InstagramApiMediaListResponse {
  data: Array<{
    id: string
    timestamp?: string
    media_type?: string
    like_count?: number
    comments_count?: number
    caption?: string
    permalink?: string
  }>
  paging?: {
    cursors?: { before?: string; after?: string }
    next?: string
  }
}

/**
 * Instagram API の生レスポンス型（メディア Insights）。
 */
export interface InstagramApiMediaInsightsResponse {
  data: Array<{
    name: string
    period: string
    values: Array<{ value: number; end_time?: string }>
    title?: string
    id?: string
  }>
}

/**
 * 短命トークン取得レスポンス（Authorization Code フロー）。
 * 有効期限は約 1 時間。exchangeLongLivedToken で長命トークンへ交換する。
 */
export interface ShortLivedTokenResponse {
  accessToken: string
  tokenType: string
  /** Instagram Login フローで返される IG User ID */
  userId?: string
}

/**
 * 長命トークン取得レスポンス。
 * 有効期限は 60 日。expiresIn は秒数。
 */
export interface LongLivedTokenResponse {
  accessToken: string
  tokenType: string
  /** 有効期間（秒）。通常 5183944（約 60 日） */
  expiresIn: number
}

/**
 * Instagram API の生レスポンス型（プロフィール）。
 * API フィールドは snake_case。内部型への変換は instagram-official.provider.ts で行う。
 */
export interface InstagramApiProfileResponse {
  id: string
  username?: string
  name?: string
  biography?: string
  followers_count?: number
  follows_count?: number
  media_count?: number
  profile_picture_url?: string
  website?: string
  account_type?: string
}

/**
 * Instagram API の生レスポンス型（メディア）。
 */
export interface InstagramApiMediaResponse {
  id: string
  like_count?: number
  comments_count?: number
  timestamp?: string
  media_type?: string
}

/**
 * Instagram API のエラーレスポンス型。
 */
export interface InstagramApiErrorResponse {
  error: {
    message: string
    type: string
    code: number
    fbtrace_id?: string
  }
}

/**
 * 短命トークン取得の生レスポンス型。
 */
export interface InstagramRawShortLivedTokenResponse {
  access_token: string
  token_type: string
}

/**
 * 長命トークン取得の生レスポンス型。
 */
export interface InstagramRawLongLivedTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
}
