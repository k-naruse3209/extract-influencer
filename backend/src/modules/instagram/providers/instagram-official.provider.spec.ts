import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ConfigService } from '@nestjs/config'
import { InstagramOfficialProvider } from './instagram-official.provider'

function makeConfigService(
  overrides: Record<string, string> = {},
): ConfigService {
  const defaults: Record<string, string> = {
    INSTAGRAM_CLIENT_ID: 'test_client_id',
    INSTAGRAM_CLIENT_SECRET: 'test_client_secret',
    INSTAGRAM_REDIRECT_URI:
      'http://localhost:3001/api/v1/auth/instagram/callback',
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

function mockFetch(status: number, body: unknown): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      headers: { get: () => null },
      json: () => Promise.resolve(body),
      text: () => Promise.resolve(JSON.stringify(body)),
    }),
  )
}

describe('InstagramOfficialProvider', () => {
  let provider: InstagramOfficialProvider

  beforeEach(() => {
    vi.restoreAllMocks()
    provider = new InstagramOfficialProvider(makeConfigService())
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('設定値から OAuth URL を組み立てる', () => {
    const url = provider.buildAuthorizationUrl('user_1', 'csrf_123')
    const parsed = new URL(url)

    expect(parsed.origin).toBe('https://www.instagram.com')
    expect(parsed.searchParams.get('client_id')).toBe('test_client_id')
    expect(parsed.searchParams.get('redirect_uri')).toBe(
      'http://localhost:3001/api/v1/auth/instagram/callback',
    )
    expect(parsed.searchParams.get('scope')).toBe(
      'instagram_business_basic,instagram_business_manage_insights',
    )
    expect(parsed.searchParams.get('response_type')).toBe('code')

    const state = parsed.searchParams.get('state')
    const decoded = JSON.parse(
      Buffer.from(state ?? '', 'base64url').toString('utf-8'),
    ) as { userId?: string; csrf?: string }
    expect(decoded).toEqual({
      userId: 'user_1',
      csrf: 'csrf_123',
    })
  })

  it('コード交換は長命トークンと granted scopes を返す', async () => {
    mockFetch(200, {
      access_token: 'short_token',
      token_type: 'bearer',
      user_id: 123,
    })

    let callCount = 0
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => {
        callCount += 1
        if (callCount === 1) {
          return Promise.resolve({
            ok: true,
            status: 200,
            headers: { get: () => null },
            json: () =>
              Promise.resolve({
                access_token: 'short_token',
                token_type: 'bearer',
                user_id: 123,
              }),
            text: () =>
              Promise.resolve(
                JSON.stringify({
                  access_token: 'short_token',
                  token_type: 'bearer',
                  user_id: 123,
                }),
              ),
          })
        }

        return Promise.resolve({
          ok: true,
          status: 200,
          headers: { get: () => null },
          json: () =>
            Promise.resolve({
              access_token: 'long_token',
              token_type: 'bearer',
              expires_in: 5184000,
            }),
          text: () =>
            Promise.resolve(
              JSON.stringify({
                access_token: 'long_token',
                token_type: 'bearer',
                expires_in: 5184000,
              }),
            ),
        })
      }),
    )

    await expect(provider.exchangeCode('auth_code')).resolves.toMatchObject({
      accessToken: 'long_token',
      tokenType: 'bearer',
      expiresIn: 5184000,
      grantedScopes: [
        'instagram_business_basic',
        'instagram_business_manage_insights',
      ],
    })
  })
})
