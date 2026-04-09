import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ConfigService } from '@nestjs/config'
import { InstagramApiClient } from './instagram-api.client'
import { RateLimitException } from './exceptions/rate-limit.exception'
import { InstagramApiException } from './exceptions/instagram-api.exception'

function makeConfigService(overrides: Record<string, string> = {}): ConfigService {
  const defaults: Record<string, string> = {
    INSTAGRAM_CLIENT_ID: 'test_client_id',
    INSTAGRAM_CLIENT_SECRET: 'test_client_secret',
    INSTAGRAM_REDIRECT_URI: 'http://localhost:3001/api/v1/auth/instagram/callback',
    INSTAGRAM_API_VERSION: 'v21.0',
    INSTAGRAM_OAUTH_SCOPES:
      'instagram_business_basic,instagram_business_manage_insights',
    ...overrides,
  }
  return {
    getOrThrow: (key: string) => {
      if (key in defaults) return defaults[key]
      throw new Error(`Missing config: ${key}`)
    },
    get: (key: string, defaultValue?: string) => defaults[key] ?? defaultValue,
  } as unknown as ConfigService
}

function mockFetch(status: number, body: unknown, headers: Record<string, string> = {}): void {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (name: string) => headers[name] ?? null,
    },
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  }))
}

describe('InstagramApiClient', () => {
  let client: InstagramApiClient

  beforeEach(() => {
    vi.useFakeTimers()
    client = new InstagramApiClient(makeConfigService())
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('getProfile', () => {
    it('正常なレスポンスをInstagramProfileDataにマップできる', async () => {
      mockFetch(200, {
        id: '123456',
        username: 'testuser',
        name: 'Test User',
        biography: 'Test bio',
        followers_count: 10000,
        follows_count: 500,
        media_count: 120,
        profile_picture_url: 'https://example.com/pic.jpg',
        website: 'https://example.com',
        account_type: 'BUSINESS',
      })

      const result = await client.getProfile('test_token')
      expect(result.username).toBe('testuser')
      expect(result.followersCount).toBe(10000)
      expect(result.accountType).toBe('BUSINESS')
    })

    it('HTTP 429 のときは RateLimitException を投げる', async () => {
      mockFetch(429, {})
      let caught: unknown
      const promise = client.getProfile('token').catch((e) => { caught = e })
      await vi.runAllTimersAsync()
      await promise
      expect(caught).toBeInstanceOf(RateLimitException)
    })

    it('Instagram error code 32 のときは RateLimitException を投げる', async () => {
      mockFetch(400, {
        error: { code: 32, type: 'OAuthException', message: 'rate limit' },
      })
      let caught: unknown
      const promise = client.getProfile('token').catch((e) => { caught = e })
      await vi.runAllTimersAsync()
      await promise
      expect(caught).toBeInstanceOf(RateLimitException)
    })

    it('トークン失効（code 190）のときは InstagramApiException（401）を投げる', async () => {
      mockFetch(400, {
        error: { code: 190, type: 'OAuthException', message: 'Token expired' },
      })
      await expect(client.getProfile('token')).rejects.toThrow(InstagramApiException)
    })

    it('ネットワークエラーのときは InstagramApiException を投げる', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network failure')))
      await expect(client.getProfile('token')).rejects.toThrow(InstagramApiException)
    })

    it('フィールドが欠けている場合は null にフォールバックする', async () => {
      mockFetch(200, { id: '999', username: 'minuser' })
      const result = await client.getProfile('token')
      expect(result.followersCount).toBeNull()
      expect(result.biography).toBeNull()
      expect(result.accountType).toBe('BUSINESS')
    })
  })

  describe('exchangeShortLivedToken', () => {
    it('正常にトークンを取得できる', async () => {
      mockFetch(200, { access_token: 'short_token', token_type: 'bearer' })
      const result = await client.exchangeShortLivedToken('auth_code')
      expect(result.accessToken).toBe('short_token')
    })

    it('APIエラー時は InstagramApiException を投げる', async () => {
      mockFetch(400, { error_message: 'Invalid code' })
      await expect(client.exchangeShortLivedToken('bad_code')).rejects.toThrow(InstagramApiException)
    })
  })

  describe('getRecentMedia', () => {
    it('メディア一覧を正常に取得してマッピングできる', async () => {
      mockFetch(200, {
        data: [
          {
            id: 'media_1',
            timestamp: '2024-01-15T10:00:00+0000',
            media_type: 'IMAGE',
            like_count: 120,
            comments_count: 8,
            caption: 'Test caption',
            permalink: 'https://www.instagram.com/p/abc123/',
          },
          {
            id: 'media_2',
            timestamp: '2024-01-10T09:00:00+0000',
            media_type: 'VIDEO',
            like_count: 250,
            comments_count: 15,
            caption: null,
            permalink: 'https://www.instagram.com/p/def456/',
          },
        ],
        paging: { cursors: { before: 'cursor_a', after: 'cursor_b' } },
      })

      const result = await client.getRecentMedia('test_token', 'ig_user_1')
      expect(result).toHaveLength(2)
      expect(result[0]).toMatchObject({
        id: 'media_1',
        mediaType: 'IMAGE',
        likeCount: 120,
        commentsCount: 8,
        caption: 'Test caption',
        permalink: 'https://www.instagram.com/p/abc123/',
      })
      expect(result[1]).toMatchObject({
        id: 'media_2',
        mediaType: 'VIDEO',
        likeCount: 250,
        caption: null,
      })
    })

    it('data が空配列のときは空配列を返す', async () => {
      mockFetch(200, { data: [] })
      const result = await client.getRecentMedia('test_token', 'ig_user_1')
      expect(result).toEqual([])
    })

    it('フィールドが欠けている場合は null にフォールバックする', async () => {
      mockFetch(200, {
        data: [{ id: 'media_minimal' }],
      })
      const result = await client.getRecentMedia('test_token', 'ig_user_1')
      expect(result[0]).toMatchObject({
        id: 'media_minimal',
        timestamp: '',
        mediaType: null,
        likeCount: null,
        commentsCount: null,
        caption: null,
        permalink: null,
      })
    })

    it('カスタム limit をクエリパラメータに含める', async () => {
      let capturedUrl = ''
      vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
        capturedUrl = url
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: { get: () => null },
          json: () => Promise.resolve({ data: [] }),
        })
      }))

      await client.getRecentMedia('test_token', 'ig_user_1', 10)
      expect(capturedUrl).toContain('limit=10')
    })

    it('HTTP 429 のときは RateLimitException を投げる', async () => {
      mockFetch(429, {})
      let caught: unknown
      const promise = client.getRecentMedia('token', 'ig_user_1').catch((e) => { caught = e })
      await vi.runAllTimersAsync()
      await promise
      expect(caught).toBeInstanceOf(RateLimitException)
    })
  })

  describe('getMediaInsightsForMedia', () => {
    it('インサイトデータを正常に取得してマッピングできる', async () => {
      mockFetch(200, {
        data: [
          { name: 'reach', period: 'lifetime', values: [{ value: 1500 }] },
          { name: 'impressions', period: 'lifetime', values: [{ value: 3200 }] },
          { name: 'engagement', period: 'lifetime', values: [{ value: 128 }] },
          { name: 'saved', period: 'lifetime', values: [{ value: 45 }] },
        ],
      })

      const result = await client.getMediaInsightsForMedia('media_1', 'test_token')
      expect(result).toEqual({
        reach: 1500,
        impressions: 3200,
        engagement: 128,
        saved: 45,
      })
    })

    it('一部のメトリクスが欠けている場合は null を返す', async () => {
      mockFetch(200, {
        data: [
          { name: 'reach', period: 'lifetime', values: [{ value: 800 }] },
          // impressions, engagement, saved が存在しない
        ],
      })

      const result = await client.getMediaInsightsForMedia('media_2', 'test_token')
      expect(result.reach).toBe(800)
      expect(result.impressions).toBeNull()
      expect(result.engagement).toBeNull()
      expect(result.saved).toBeNull()
    })

    it('data が空のときはすべて null を返す', async () => {
      mockFetch(200, { data: [] })
      const result = await client.getMediaInsightsForMedia('media_3', 'test_token')
      expect(result).toEqual({
        reach: null,
        impressions: null,
        engagement: null,
        saved: null,
      })
    })

    it('PERSONAL アカウント（error code 10）は InstagramApiException(403) を投げる', async () => {
      mockFetch(403, {
        error: {
          code: 10,
          type: 'OAuthException',
          message: 'Insufficient developer role',
        },
      })
      const error = await client
        .getMediaInsightsForMedia('media_4', 'token')
        .catch((e: unknown) => e)
      expect(error).toBeInstanceOf(InstagramApiException)
      expect((error as InstagramApiException).getStatus()).toBe(403)
    })

    it('HTTP 429 のときは RateLimitException を投げる', async () => {
      mockFetch(429, {})
      let caught: unknown
      const promise = client
        .getMediaInsightsForMedia('media_5', 'token')
        .catch((e) => { caught = e })
      await vi.runAllTimersAsync()
      await promise
      expect(caught).toBeInstanceOf(RateLimitException)
    })
  })
})
