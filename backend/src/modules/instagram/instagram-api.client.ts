import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InstagramApiException } from './exceptions/instagram-api.exception'
import { RateLimitException } from './exceptions/rate-limit.exception'
import { sleep } from '../../common/utils/retry'
import type {
  InstagramProfileData,
  InstagramMediaData,
  InstagramMedia,
  InstagramMediaInsights,
  ShortLivedTokenResponse,
  LongLivedTokenResponse,
  InstagramApiProfileResponse,
  InstagramApiMediaResponse,
  InstagramApiErrorResponse,
  InstagramRawShortLivedTokenResponse,
  InstagramRawLongLivedTokenResponse,
  InstagramApiMediaListResponse,
  InstagramApiMediaInsightsResponse,
} from './types/instagram-api.types'

const GRAPH_API_BASE = 'https://graph.instagram.com'
const GRAPH_API_VERSION = 'v21.0'
/** Instagram Login: short-lived token exchange endpoint */
const OAUTH_TOKEN_URL = 'https://api.instagram.com/oauth/access_token'
/** Instagram Login: long-lived token exchange endpoint */
const LONG_LIVED_TOKEN_URL = 'https://graph.instagram.com/access_token'

/** IG User node の公式フィールド。account_type は Graph API に存在しない（Basic Display API のみ）。 */
const PROFILE_FIELDS =
  'id,username,name,biography,followers_count,follows_count,media_count,profile_picture_url,website'

const MEDIA_FIELDS = 'id,like_count,comments_count,timestamp,media_type'

/**
 * メディア一覧取得時に要求するフィールド。
 * caption と permalink はオプション取得（PERSONAL でも取得可能）。
 */
const RECENT_MEDIA_FIELDS =
  'id,timestamp,media_type,like_count,comments_count,caption,permalink'

/**
 * メディア Insights で取得するメトリクス。
 * Business / Creator アカウントのみ利用可能。
 */
const MEDIA_INSIGHT_METRICS = 'reach,impressions,engagement,saved'

/**
 * Instagram Graph API へのHTTPリクエストを担うクライアント。
 *
 * 設計上の制約:
 * - Node 18+ 組み込み fetch を使用（axios 不要）
 * - レート制限（HTTP 429 または Instagram error code 32）時は RateLimitException
 * - トークン失効（code 190）時は InstagramApiException（httpStatus 401）
 * - 非公開アカウント（code 10）時は InstagramApiException（httpStatus 403）
 * - アクセストークンをログに出力しない（PII / secrets 最小化）
 */
@Injectable()
export class InstagramApiClient {
  private readonly logger = new Logger(InstagramApiClient.name)
  private readonly clientId: string
  private readonly clientSecret: string
  private readonly redirectUri: string

  constructor(private readonly configService: ConfigService) {
    this.clientId = this.configService.getOrThrow<string>('INSTAGRAM_CLIENT_ID')
    this.clientSecret = this.configService.getOrThrow<string>(
      'INSTAGRAM_CLIENT_SECRET',
    )
    this.redirectUri = this.configService.getOrThrow<string>(
      'INSTAGRAM_REDIRECT_URI',
    )
  }

  /**
   * Business / Creator アカウントのプロフィールを取得する。
   *
   * PERSONAL アカウントの場合、followers_count 等が API から返らないため
   * accountType === 'PERSONAL' のケースは呼び出し元でハンドリングすること。
   */
  async getProfile(accessToken: string): Promise<InstagramProfileData> {
    const url = new URL(`/${GRAPH_API_VERSION}/me`, GRAPH_API_BASE)
    url.searchParams.set('fields', PROFILE_FIELDS)
    url.searchParams.set('access_token', accessToken)

    const raw = await this.get<InstagramApiProfileResponse>(url.toString())

    return this.mapProfileResponse(raw)
  }

  /**
   * Instagram Business Account ID を指定してプロフィールを直接取得する。
   * Business Discovery API が使えない場合（開発モード等）のフォールバック用。
   *
   * GET /{ig-user-id}?fields=id,username,name,biography,...&access_token=...
   */
  async getProfileByIgUserId(
    accessToken: string,
    igUserId: string,
  ): Promise<InstagramProfileData> {
    const url = new URL(`/${GRAPH_API_VERSION}/${igUserId}`, GRAPH_API_BASE)
    url.searchParams.set('fields', PROFILE_FIELDS)
    url.searchParams.set('access_token', accessToken)

    const raw = await this.get<InstagramApiProfileResponse>(url.toString())

    return this.mapProfileResponse(raw)
  }

  /**
   * Instagram Login トークンを使って、連携ユーザーの IG ユーザー情報を取得する。
   *
   * フロー: GET /me?fields=id,username,name (graph.instagram.com)
   */
  async getInstagramMe(
    accessToken: string,
  ): Promise<{ id: string; username: string; name?: string }> {
    const url = new URL(`/${GRAPH_API_VERSION}/me`, GRAPH_API_BASE)
    url.searchParams.set('fields', 'id,username,name')
    url.searchParams.set('access_token', accessToken)

    return this.get<{ id: string; username: string; name?: string }>(url.toString())
  }

  /**
   * Business Discovery API を使って他のビジネス/クリエイターアカウントの
   * プロフィールを username で取得する。
   *
   * 正しい URL フォーマット:
   *   GET https://graph.instagram.com/{myIgUserId}
   *     ?fields=business_discovery.username({targetUsername}){id,username,...}
   *     &access_token=...
   *
   * myIgUserId は OAuth 連携した自分の Instagram Business Account ID。
   */
  async getProfileByUsername(
    accessToken: string,
    targetUsername: string,
    myIgUserId: string,
  ): Promise<InstagramProfileData> {
    const discoveryFields = 'id,username,name,biography,followers_count,follows_count,media_count,profile_picture_url,website'
    const queryUrlObj = new URL(`/${GRAPH_API_VERSION}/${myIgUserId}`, GRAPH_API_BASE)
    queryUrlObj.searchParams.set('fields', `business_discovery.username(${targetUsername}){${discoveryFields}}`)
    queryUrlObj.searchParams.set('access_token', accessToken)

    const raw = await this.get<{ business_discovery: InstagramApiProfileResponse }>(queryUrlObj.toString())

    if (!raw.business_discovery) {
      throw new InstagramApiException(
        `Business Discovery returned no data for username: ${targetUsername}`,
        0,
        'BusinessDiscoveryError',
      )
    }

    return this.mapProfileResponse(raw.business_discovery)
  }

  /**
   * 特定メディアのインサイトデータを取得する。
   */
  async getMediaInsights(
    accessToken: string,
    mediaId: string,
  ): Promise<InstagramMediaData> {
    const url = new URL(`/${GRAPH_API_VERSION}/${mediaId}`, GRAPH_API_BASE)
    url.searchParams.set('fields', MEDIA_FIELDS)
    url.searchParams.set('access_token', accessToken)

    const raw = await this.get<InstagramApiMediaResponse>(url.toString())

    return this.mapMediaResponse(raw)
  }

  /**
   * Instagram ユーザーの最近のメディア一覧を取得する。
   *
   * GET /{ig-user-id}/media?fields=id,timestamp,media_type,like_count,comments_count,caption,permalink&limit=25
   *
   * @param accessToken  Facebook Login で取得したアクセストークン
   * @param igUserId     Instagram Business Account ID
   * @param limit        取得件数（デフォルト 25、最大 100）
   */
  async getRecentMedia(
    accessToken: string,
    igUserId: string,
    limit = 25,
  ): Promise<InstagramMedia[]> {
    const url = new URL(`/${GRAPH_API_VERSION}/${igUserId}/media`, GRAPH_API_BASE)
    url.searchParams.set('fields', RECENT_MEDIA_FIELDS)
    url.searchParams.set('limit', String(limit))
    url.searchParams.set('access_token', accessToken)

    const raw = await this.get<InstagramApiMediaListResponse>(url.toString())

    return (raw.data ?? []).map((item) => this.mapMediaListItem(item))
  }

  /**
   * 個別メディアのインサイトを取得する。
   *
   * GET /{media-id}/insights?metric=reach,impressions,engagement,saved
   *
   * Business / Creator アカウントのみ利用可能。
   * PERSONAL アカウントに対して呼び出すと Instagram が error code 10 を返し、
   * InstagramApiException (httpStatus 403) がスローされる。
   *
   * @param mediaId      インサイトを取得するメディアの ID
   * @param accessToken  ユーザーアクセストークン
   */
  async getMediaInsightsForMedia(
    mediaId: string,
    accessToken: string,
  ): Promise<InstagramMediaInsights> {
    const url = new URL(
      `/${GRAPH_API_VERSION}/${mediaId}/insights`,
      GRAPH_API_BASE,
    )
    url.searchParams.set('metric', MEDIA_INSIGHT_METRICS)
    url.searchParams.set('access_token', accessToken)

    const raw = await this.get<InstagramApiMediaInsightsResponse>(url.toString())

    return this.mapMediaInsightsResponse(raw)
  }

  /**
   * Authorization Code を短命アクセストークンに交換する。
   * 返却されるトークンは有効期限約 1 時間。exchangeLongLivedToken で延長すること。
   */
  async exchangeShortLivedToken(
    code: string,
  ): Promise<ShortLivedTokenResponse> {
    // Instagram Login: POST form-encoded で code をトークンに交換
    const body = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: this.redirectUri,
      code,
      grant_type: 'authorization_code',
    })

    const response = await fetch(OAUTH_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })

    if (!response.ok) {
      const errorText = await response.text()
      this.logger.error(
        `Short-lived token exchange failed: HTTP ${response.status} body=${errorText}`,
      )
      throw new InstagramApiException(
        `Token exchange failed: ${errorText}`,
        0,
        'OAuthException',
      )
    }

    const raw = (await response.json()) as { access_token: string; token_type: string; user_id: number }
    return {
      accessToken: raw.access_token,
      tokenType: raw.token_type ?? 'bearer',
      userId: String(raw.user_id),
    }
  }

  /**
   * 短命トークンを長命トークン（有効期限 60 日）に交換する。
   */
  async exchangeLongLivedToken(
    shortLivedToken: string,
  ): Promise<LongLivedTokenResponse> {
    // Instagram Login: ig_exchange_token で長命トークンに交換（graph.instagram.com）
    const url = new URL(LONG_LIVED_TOKEN_URL)
    url.searchParams.set('grant_type', 'ig_exchange_token')
    url.searchParams.set('client_secret', this.clientSecret)
    url.searchParams.set('access_token', shortLivedToken)

    const raw = await this.get<InstagramRawLongLivedTokenResponse>(
      url.toString(),
    )

    return {
      accessToken: raw.access_token,
      tokenType: raw.token_type,
      expiresIn: raw.expires_in,
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * GET リクエストを実行し、エラーハンドリングを統一する。
   * URL にアクセストークンが含まれるためログ出力時は URL をマスクする。
   * レート制限（HTTP 429 または code 32）時は指数バックオフでリトライする。
   */
  private async get<T>(url: string): Promise<T> {
    return this.fetchWithRetry<T>(url, { method: 'GET' })
  }

  /**
   * 指数バックオフ付きの fetch ラッパー。
   *
   * リトライ戦略:
   * - HTTP 429: Retry-After ヘッダーを優先。なければ 1s → 2s → 4s の指数バックオフ
   * - Instagram error code 32: 同上
   * - ネットワークエラー: リトライしない（接続不能状態では待機しても無意味なため）
   * - 最大リトライ回数を超えた場合は RateLimitException をスロー
   */
  private async fetchWithRetry<T>(
    url: string,
    options: RequestInit,
    maxRetries = 3,
  ): Promise<T> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      let response: Response
      try {
        response = await fetch(url, options)
      } catch (networkError: unknown) {
        const message =
          networkError instanceof Error ? networkError.message : 'Network error'
        this.logger.error(`Instagram API network error: ${message}`)
        throw new InstagramApiException(
          `Instagram API に接続できませんでした: ${message}`,
          0,
          'NetworkError',
        )
      }

      if (response.status === 429) {
        const retryAfterSeconds = this.parseRetryAfterHeader(response)
        const isLastAttempt = attempt === maxRetries - 1

        if (isLastAttempt) {
          this.logger.warn(
            `Instagram API rate limit exceeded (HTTP 429). Max retries (${maxRetries}) reached.`,
          )
          throw new RateLimitException(retryAfterSeconds ?? undefined)
        }

        const delayMs = retryAfterSeconds != null
          ? retryAfterSeconds * 1000
          : Math.pow(2, attempt) * 1000

        this.logger.warn(
          `Instagram API rate limit (HTTP 429). Retrying attempt=${attempt + 1}/${maxRetries} after ${delayMs}ms.`,
        )
        await sleep(delayMs)
        continue
      }

      const body = (await response.json()) as T | InstagramApiErrorResponse

      if (!response.ok) {
        const errorBody = body as InstagramApiErrorResponse
        const code = errorBody?.error?.code ?? 0
        const type = errorBody?.error?.type ?? 'UnknownError'
        const message =
          errorBody?.error?.message ?? 'Unknown Instagram API error'

        this.logger.warn(`Instagram API error: code=${code} type=${type} message=${message}`)

        if (code === 32) {
          const isLastAttempt = attempt === maxRetries - 1

          if (isLastAttempt) {
            this.logger.warn(
              `Instagram API rate limit (code 32). Max retries (${maxRetries}) reached.`,
            )
            throw new RateLimitException()
          }

          const delayMs = Math.pow(2, attempt) * 1000
          this.logger.warn(
            `Instagram API rate limit (code 32). Retrying attempt=${attempt + 1}/${maxRetries} after ${delayMs}ms.`,
          )
          await sleep(delayMs)
          continue
        }

        if (code === 190) {
          throw new InstagramApiException(message, code, type, 401)
        }

        if (code === 10) {
          throw new InstagramApiException(message, code, type, 403)
        }

        throw new InstagramApiException(message, code, type)
      }

      return body as T
    }

    // ループ終了後にここには到達しないが TypeScript の exhaustiveness のため
    throw new RateLimitException()
  }

  /**
   * Retry-After ヘッダーを秒数として解析する。
   * ヘッダーがない場合・解析できない場合・headers が存在しない場合は null を返す。
   */
  private parseRetryAfterHeader(response: Response): number | null {
    if (!response.headers || typeof response.headers.get !== 'function') {
      return null
    }
    const retryAfterHeader = response.headers.get('Retry-After')
    if (retryAfterHeader === null) {
      return null
    }
    const seconds = parseInt(retryAfterHeader, 10)
    return Number.isFinite(seconds) && seconds > 0 ? seconds : null
  }

  private mapProfileResponse(
    raw: InstagramApiProfileResponse,
  ): InstagramProfileData {
    return {
      id: raw.id,
      username: raw.username ?? '',
      name: raw.name ?? null,
      biography: raw.biography ?? null,
      followersCount: raw.followers_count ?? null,
      followsCount: raw.follows_count ?? null,
      mediaCount: raw.media_count ?? null,
      profilePictureUrl: raw.profile_picture_url ?? null,
      website: raw.website ?? null,
      // account_type は Graph API の IG User node に存在しない。
      // Facebook Page 経由で取得した IG アカウントは必ず BUSINESS or CREATOR。
      accountType: this.mapAccountType(raw.account_type) ?? 'BUSINESS',
    }
  }

  private mapMediaResponse(raw: InstagramApiMediaResponse): InstagramMediaData {
    return {
      id: raw.id,
      likeCount: raw.like_count ?? null,
      commentsCount: raw.comments_count ?? null,
      timestamp: raw.timestamp ?? '',
      mediaType: this.mapMediaType(raw.media_type),
    }
  }

  private mapAccountType(
    raw: string | undefined,
  ): 'BUSINESS' | 'CREATOR' | 'PERSONAL' | null {
    if (raw === 'BUSINESS') return 'BUSINESS'
    if (raw === 'CREATOR') return 'CREATOR'
    if (raw === 'PERSONAL') return 'PERSONAL'
    return null
  }

  private mapMediaType(
    raw: string | undefined,
  ): 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM' | null {
    if (raw === 'IMAGE') return 'IMAGE'
    if (raw === 'VIDEO') return 'VIDEO'
    if (raw === 'CAROUSEL_ALBUM') return 'CAROUSEL_ALBUM'
    return null
  }

  private mapMediaListItem(
    raw: InstagramApiMediaListResponse['data'][number],
  ): InstagramMedia {
    return {
      id: raw.id,
      timestamp: raw.timestamp ?? '',
      mediaType: this.mapMediaType(raw.media_type),
      likeCount: raw.like_count ?? null,
      commentsCount: raw.comments_count ?? null,
      caption: raw.caption ?? null,
      permalink: raw.permalink ?? null,
    }
  }

  /**
   * /insights レスポンスの data 配列を name→value のマップに変換する。
   * values[0].value を使う（lifetime メトリクスは配列が 1 要素）。
   */
  private mapMediaInsightsResponse(
    raw: InstagramApiMediaInsightsResponse,
  ): InstagramMediaInsights {
    const byName = new Map<string, number>()
    for (const metric of raw.data ?? []) {
      const value = metric.values[0]?.value
      if (typeof value === 'number') {
        byName.set(metric.name, value)
      }
    }

    return {
      reach: byName.get('reach') ?? null,
      impressions: byName.get('impressions') ?? null,
      engagement: byName.get('engagement') ?? null,
      saved: byName.get('saved') ?? null,
    }
  }
}
