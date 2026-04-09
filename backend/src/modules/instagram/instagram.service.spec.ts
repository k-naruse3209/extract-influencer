import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ConfigService } from '@nestjs/config'
import { InstagramService } from './instagram.service'
import { InstagramOfficialProvider } from './providers/instagram-official.provider'
import { InstagramRateLimitService } from './instagram-rate-limit.service'
import type { PrismaService } from '../../common/prisma/prisma.service'

const mockPrisma = {
  instagramToken: {
    upsert: vi.fn().mockResolvedValue({}),
    findUnique: vi.fn(),
  },
  influencerProfile: {
    findUnique: vi.fn(),
  },
  profileSnapshot: {
    create: vi.fn().mockResolvedValue({ id: 'snap_1' }),
    findFirst: vi.fn(),
    update: vi.fn().mockResolvedValue({}),
  },
} as unknown as PrismaService

const mockProvider = {
  exchangeCode: vi.fn(),
  getConnectedAccount: vi.fn(),
} as unknown as InstagramOfficialProvider

const mockRateLimitService = {
  waitForRequestWindow: vi.fn().mockResolvedValue(undefined),
  runExclusive: vi.fn().mockImplementation(async (_provider: string, _userId: string, fn: () => unknown) => await fn()),
} as unknown as InstagramRateLimitService

const mockQueue = {
  add: vi.fn().mockResolvedValue({ id: 'job_1' }),
}

const mockConfigService = {
  getOrThrow: (key: string) => {
    if (key === 'TOKEN_ENCRYPTION_KEY') return 'a'.repeat(64)
    if (key === 'INSTAGRAM_OAUTH_SCOPES') {
      return 'instagram_business_basic,instagram_business_manage_insights'
    }
    throw new Error(`Missing: ${key}`)
  },
} as unknown as ConfigService

describe('InstagramService', () => {
  let service: InstagramService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new InstagramService(
      mockPrisma,
      mockProvider,
      mockConfigService,
      mockRateLimitService,
      mockQueue as never,
    )
  })

  describe('handleOAuthCallback', () => {
    it('コード交換と接続済みアカウント取得の結果を拡張メタデータ付きで保存する', async () => {
      vi.mocked(mockProvider.exchangeCode).mockResolvedValue({
        accessToken: 'long_token',
        tokenType: 'bearer',
        expiresIn: 5184000,
        grantedScopes: [
          'instagram_business_basic',
          'instagram_business_manage_insights',
        ],
      })
      vi.mocked(mockProvider.getConnectedAccount).mockResolvedValue({
        id: 'ig_user_123',
        username: 'testuser',
        name: 'Test User',
      })

      await service.handleOAuthCallback('user_1', 'auth_code')

      expect(mockProvider.exchangeCode).toHaveBeenCalledWith('auth_code')
      expect(mockProvider.getConnectedAccount).toHaveBeenCalledWith('long_token')

      const upsertCall = vi.mocked(mockPrisma.instagramToken.upsert).mock.calls[0]?.[0]
      expect(upsertCall?.create?.encryptedToken).not.toBe('long_token')
      expect(upsertCall?.create?.encryptedToken).toContain(':')
      expect(upsertCall?.create).toMatchObject({
        providerVariant: 'INSTAGRAM_LOGIN',
        grantedScopes: 'instagram_business_basic,instagram_business_manage_insights',
        tokenStatus: 'ACTIVE',
        instagramUserId: 'ig_user_123',
        instagramUsername: 'testuser',
      })
      expect(upsertCall?.create?.lastValidatedAt).toBeInstanceOf(Date)
    })
  })

  describe('getConnectionStatus', () => {
    it('接続情報に provider/scopes/expiresAt/tokenStatus を含める', async () => {
      vi.mocked(mockPrisma.instagramToken.findUnique).mockResolvedValue({
        instagramUserId: 'ig_123',
        instagramUsername: 'testuser',
        refreshedAt: new Date('2026-04-09T08:00:00Z'),
        createdAt: new Date('2026-04-09T07:00:00Z'),
        providerVariant: 'INSTAGRAM_LOGIN',
        grantedScopes:
          'instagram_business_basic,instagram_business_manage_insights',
        expiresAt: new Date('2026-06-08T08:00:00Z'),
        tokenStatus: 'ACTIVE',
      })

      await expect(service.getConnectionStatus('user_1')).resolves.toMatchObject({
        connected: true,
        username: 'testuser',
        provider: 'INSTAGRAM_LOGIN',
        scopes: [
          'instagram_business_basic',
          'instagram_business_manage_insights',
        ],
        expiresAt: '2026-06-08T08:00:00.000Z',
        tokenStatus: 'ACTIVE',
      })
    })
  })

  describe('enqueueProfileFetch', () => {
    it('PROFILE ジョブを拡張 payload でキューに追加する', async () => {
      vi.mocked(mockPrisma.influencerProfile.findUnique).mockResolvedValue({
        id: 'profile_1',
        username: 'target_user',
      })

      await service.enqueueProfileFetch('profile_1', 'user_1')

      expect(mockQueue.add).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'PROFILE',
          profileId: 'profile_1',
          requestedByUserId: 'user_1',
          targetUsername: 'target_user',
          providerVariant: 'INSTAGRAM_LOGIN',
        }),
        expect.objectContaining({ priority: 1, attempts: 3 }),
      )
    })
  })

  describe('saveSnapshot', () => {
    it('PERSONAL アカウントの followerCount は UNAVAILABLE として provider metadata 付きで保存される', async () => {
      await service.saveSnapshot(
        'profile_1',
        {
          id: 'ig_123',
          username: 'personal_user',
          name: null,
          biography: null,
          followersCount: 5000,
          followsCount: 200,
          mediaCount: 30,
          profilePictureUrl: null,
          website: null,
          accountType: 'PERSONAL',
        },
        {
          providerVariant: 'INSTAGRAM_LOGIN',
          subjectType: 'TARGET_PROFILE',
          providerPayload: { id: 'ig_123', username: 'personal_user' },
        },
      )

      const createCall = vi.mocked(mockPrisma.profileSnapshot.create).mock.calls[0]?.[0]
      expect(createCall?.data).toMatchObject({
        followerCount: null,
        followerCountStatus: 'UNAVAILABLE',
        providerVariant: 'INSTAGRAM_LOGIN',
        subjectType: 'TARGET_PROFILE',
      })
      expect(createCall?.data?.rawResponse).toMatchObject({
        providerVariant: 'INSTAGRAM_LOGIN',
        subjectType: 'TARGET_PROFILE',
        providerPayload: { id: 'ig_123', username: 'personal_user' },
        normalizedPayload: expect.objectContaining({
          id: 'ig_123',
          username: 'personal_user',
        }),
      })
    })
  })
})
