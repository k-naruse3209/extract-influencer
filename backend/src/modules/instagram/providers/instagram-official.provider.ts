import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InstagramApiException } from '../exceptions/instagram-api.exception'
import { RateLimitException } from '../exceptions/rate-limit.exception'
import { sleep } from '../../../common/utils/retry'
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
  InstagramRawLongLivedTokenResponse,
  InstagramApiMediaListResponse,
  InstagramApiMediaInsightsResponse,
} from '../types/instagram-api.types'

const GRAPH_API_BASE = 'https://graph.instagram.com'
const OAUTH_AUTHORIZE_URL = 'https://www.instagram.com/oauth/authorize'
const OAUTH_TOKEN_URL = 'https://api.instagram.com/oauth/access_token'
const LONG_LIVED_TOKEN_URL = 'https://graph.instagram.com/access_token'
const REFRESH_TOKEN_URL = 'https://graph.instagram.com/refresh_access_token'

const PROFILE_FIELDS =
  'id,username,name,biography,followers_count,follows_count,media_count,profile_picture_url,website'

const MEDIA_FIELDS = 'id,like_count,comments_count,timestamp,media_type'
const RECENT_MEDIA_FIELDS =
  'id,timestamp,media_type,like_count,comments_count,caption,permalink'
const MEDIA_INSIGHT_METRICS = 'reach,impressions,engagement,saved'

@Injectable()
export class InstagramOfficialProvider {
  private readonly logger = new Logger(InstagramOfficialProvider.name)
  private readonly clientId: string
  private readonly clientSecret: string
  private readonly redirectUri: string
  private readonly apiVersion: string
  private readonly oauthScopes: string[]

  constructor(private readonly configService: ConfigService) {
    this.clientId = this.configService.getOrThrow<string>('INSTAGRAM_CLIENT_ID')
    this.clientSecret = this.configService.getOrThrow<string>(
      'INSTAGRAM_CLIENT_SECRET',
    )
    this.redirectUri = this.configService.getOrThrow<string>(
      'INSTAGRAM_REDIRECT_URI',
    )
    this.apiVersion = this.configService.get<string>(
      'INSTAGRAM_API_VERSION',
      'v21.0',
    )
    this.oauthScopes = this.configService
      .get<string>(
        'INSTAGRAM_OAUTH_SCOPES',
        'instagram_business_basic,instagram_business_manage_insights',
      )
      .split(',')
      .map((scope) => scope.trim())
      .filter(Boolean)
  }

  buildAuthorizationUrl(userId: string, csrf: string): string {
    const authUrl = new URL(OAUTH_AUTHORIZE_URL)
    authUrl.searchParams.set('client_id', this.clientId)
    authUrl.searchParams.set('redirect_uri', this.redirectUri)
    authUrl.searchParams.set('scope', this.oauthScopes.join(','))
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set(
      'state',
      Buffer.from(JSON.stringify({ userId, csrf })).toString('base64url'),
    )
    return authUrl.toString()
  }

  async exchangeCode(code: string): Promise<LongLivedTokenResponse & {
    grantedScopes: string[]
  }> {
    const shortLived = await this.exchangeShortLivedToken(code)
    const longLived = await this.exchangeLongLivedToken(shortLived.accessToken)
    return {
      ...longLived,
      grantedScopes: this.oauthScopes,
    }
  }

  async refreshToken(
    accessToken: string,
  ): Promise<LongLivedTokenResponse & { grantedScopes: string[] }> {
    const url = new URL(REFRESH_TOKEN_URL)
    url.searchParams.set('grant_type', 'ig_refresh_token')
    url.searchParams.set('access_token', accessToken)

    const raw = await this.get<InstagramRawLongLivedTokenResponse>(
      url.toString(),
    )

    return {
      accessToken: raw.access_token,
      tokenType: raw.token_type,
      expiresIn: raw.expires_in,
      grantedScopes: this.oauthScopes,
    }
  }

  async getConnectedAccount(
    accessToken: string,
  ): Promise<{ id: string; username: string; name?: string | null }> {
    const url = new URL(`/${this.apiVersion}/me`, GRAPH_API_BASE)
    url.searchParams.set('fields', 'id,username,name')
    url.searchParams.set('access_token', accessToken)

    return this.get<{ id: string; username: string; name?: string | null }>(
      url.toString(),
    )
  }

  async fetchTargetProfile(
    targetUsername: string,
    connectedAccountId: string,
    accessToken: string,
  ): Promise<InstagramProfileData> {
    try {
      return await this.getProfileByUsername(
        accessToken,
        targetUsername,
        connectedAccountId,
      )
    } catch (error) {
      const connectedProfile = await this.getProfileByIgUserId(
        accessToken,
        connectedAccountId,
      )

      if (
        connectedProfile.username.toLowerCase() ===
        targetUsername.toLowerCase()
      ) {
        return connectedProfile
      }

      throw error
    }
  }

  async fetchTargetMedia(
    targetAccountId: string,
    accessToken: string,
    limit = 25,
  ): Promise<InstagramMedia[]> {
    return this.getRecentMedia(accessToken, targetAccountId, limit)
  }

  async fetchMediaInsights(
    mediaId: string,
    accessToken: string,
  ): Promise<InstagramMediaInsights> {
    return this.getMediaInsightsForMedia(mediaId, accessToken)
  }

  async getProfile(accessToken: string): Promise<InstagramProfileData> {
    const url = new URL(`/${this.apiVersion}/me`, GRAPH_API_BASE)
    url.searchParams.set('fields', PROFILE_FIELDS)
    url.searchParams.set('access_token', accessToken)

    const raw = await this.get<InstagramApiProfileResponse>(url.toString())
    return this.mapProfileResponse(raw)
  }

  async getProfileByIgUserId(
    accessToken: string,
    igUserId: string,
  ): Promise<InstagramProfileData> {
    const url = new URL(`/${this.apiVersion}/${igUserId}`, GRAPH_API_BASE)
    url.searchParams.set('fields', PROFILE_FIELDS)
    url.searchParams.set('access_token', accessToken)

    const raw = await this.get<InstagramApiProfileResponse>(url.toString())
    return this.mapProfileResponse(raw)
  }

  async getProfileByUsername(
    accessToken: string,
    targetUsername: string,
    connectedAccountId: string,
  ): Promise<InstagramProfileData> {
    const queryUrl = new URL(
      `/${this.apiVersion}/${connectedAccountId}`,
      GRAPH_API_BASE,
    )
    queryUrl.searchParams.set(
      'fields',
      `business_discovery.username(${targetUsername}){${PROFILE_FIELDS}}`,
    )
    queryUrl.searchParams.set('access_token', accessToken)

    const raw = await this.get<{
      business_discovery: InstagramApiProfileResponse
    }>(queryUrl.toString())

    if (!raw.business_discovery) {
      throw new InstagramApiException(
        `Target profile lookup returned no data for username: ${targetUsername}`,
        0,
        'BusinessDiscoveryError',
      )
    }

    return this.mapProfileResponse(raw.business_discovery)
  }

  async getMediaInsights(
    accessToken: string,
    mediaId: string,
  ): Promise<InstagramMediaData> {
    const url = new URL(`/${this.apiVersion}/${mediaId}`, GRAPH_API_BASE)
    url.searchParams.set('fields', MEDIA_FIELDS)
    url.searchParams.set('access_token', accessToken)

    const raw = await this.get<InstagramApiMediaResponse>(url.toString())
    return this.mapMediaResponse(raw)
  }

  async getRecentMedia(
    accessToken: string,
    igUserId: string,
    limit = 25,
  ): Promise<InstagramMedia[]> {
    const url = new URL(`/${this.apiVersion}/${igUserId}/media`, GRAPH_API_BASE)
    url.searchParams.set('fields', RECENT_MEDIA_FIELDS)
    url.searchParams.set('limit', String(limit))
    url.searchParams.set('access_token', accessToken)

    const raw = await this.get<InstagramApiMediaListResponse>(url.toString())
    return (raw.data ?? []).map((item) => this.mapMediaListItem(item))
  }

  async getMediaInsightsForMedia(
    mediaId: string,
    accessToken: string,
  ): Promise<InstagramMediaInsights> {
    const url = new URL(
      `/${this.apiVersion}/${mediaId}/insights`,
      GRAPH_API_BASE,
    )
    url.searchParams.set('metric', MEDIA_INSIGHT_METRICS)
    url.searchParams.set('access_token', accessToken)

    const raw = await this.get<InstagramApiMediaInsightsResponse>(
      url.toString(),
    )
    return this.mapMediaInsightsResponse(raw)
  }

  async exchangeShortLivedToken(
    code: string,
  ): Promise<ShortLivedTokenResponse> {
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

    const raw = (await response.json()) as {
      access_token: string
      token_type: string
      user_id: number
    }

    return {
      accessToken: raw.access_token,
      tokenType: raw.token_type ?? 'bearer',
      userId: String(raw.user_id),
    }
  }

  async exchangeLongLivedToken(
    shortLivedToken: string,
  ): Promise<LongLivedTokenResponse> {
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

  private async get<T>(url: string): Promise<T> {
    return this.fetchWithRetry<T>(url, { method: 'GET' })
  }

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

        const delayMs =
          retryAfterSeconds != null
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

        this.logger.warn(
          `Instagram API error: code=${code} type=${type} message=${message}`,
        )

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

    throw new RateLimitException()
  }

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
