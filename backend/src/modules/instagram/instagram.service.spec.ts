import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ConfigService } from '@nestjs/config'
import { InstagramService } from './instagram.service'
import { InstagramApiClient } from './instagram-api.client'
import type { PrismaService } from '../../common/prisma/prisma.service'

const mockPrisma = {
  instagramToken: {
    upsert: vi.fn().mockResolvedValue({}),
  },
  profileSnapshot: {
    create: vi.fn().mockResolvedValue({ id: 'snap_1' }),
  },
} as unknown as PrismaService

const mockApiClient = {
  exchangeShortLivedToken: vi.fn(),
  exchangeLongLivedToken: vi.fn(),
  getProfile: vi.fn(),
} as unknown as InstagramApiClient

const mockQueue = {
  add: vi.fn().mockResolvedValue({ id: 'job_1' }),
}

const mockConfigService = {
  getOrThrow: (key: string) => {
    if (key === 'TOKEN_ENCRYPTION_KEY') return 'a'.repeat(64)
    throw new Error(`Missing: ${key}`)
  },
} as unknown as ConfigService

describe('InstagramService', () => {
  let service: InstagramService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new InstagramService(
      mockPrisma,
      mockApiClient,
      mockConfigService,
      mockQueue as never,
    )
  })

  describe('handleOAuthCallback', () => {
    it('短命→長命トークン交換→DB保存の一連のフローが正しく動作する', async () => {
      vi.mocked(mockApiClient.exchangeShortLivedToken).mockResolvedValue({
        accessToken: 'short_token',
        tokenType: 'bearer',
      })
      vi.mocked(mockApiClient.exchangeLongLivedToken).mockResolvedValue({
        accessToken: 'long_token',
        tokenType: 'bearer',
        expiresIn: 5184000, // 60日
      })
      vi.mocked(mockApiClient.getProfile).mockResolvedValue({
        id: 'ig_user_123',
        username: 'testuser',
        name: null,
        biography: null,
        followersCount: null,
        followsCount: null,
        mediaCount: null,
        profilePictureUrl: null,
        website: null,
        accountType: 'BUSINESS',
      })

      await service.handleOAuthCallback('user_1', 'auth_code')

      expect(mockApiClient.exchangeShortLivedToken).toHaveBeenCalledWith('auth_code')
      expect(mockApiClient.exchangeLongLivedToken).toHaveBeenCalledWith('short_token')
      expect(mockPrisma.instagramToken.upsert).toHaveBeenCalledOnce()

      // 平文トークンが保存されていないことを確認（暗号化されているはず）
      const upsertCall = vi.mocked(mockPrisma.instagramToken.upsert).mock.calls[0]?.[0]
      expect(upsertCall?.create?.encryptedToken).not.toBe('long_token')
      expect(upsertCall?.create?.encryptedToken).toContain(':') // iv:authTag:ciphertext 形式
    })
  })

  describe('enqueueProfileFetch', () => {
    it('PROFILE ジョブをキューに追加できる', async () => {
      await service.enqueueProfileFetch('profile_1', 'user_1')
      expect(mockQueue.add).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'PROFILE', profileId: 'profile_1' }),
        expect.objectContaining({ priority: 1, attempts: 3 }),
      )
    })
  })

  describe('saveSnapshot', () => {
    it('PERSONAL アカウントの followerCount は UNAVAILABLE として保存される', async () => {
      await service.saveSnapshot('profile_1', {
        id: 'ig_123',
        username: 'personal_user',
        name: null,
        biography: null,
        followersCount: 5000, // APIが返しても無視する
        followsCount: 200,
        mediaCount: 30,
        profilePictureUrl: null,
        website: null,
        accountType: 'PERSONAL',
      })

      const createCall = vi.mocked(mockPrisma.profileSnapshot.create).mock.calls[0]?.[0]
      expect(createCall?.data?.followerCount).toBeNull()
      expect(createCall?.data?.followerCountStatus).toBe('UNAVAILABLE')
    })

    it('BUSINESS アカウントの followerCount は FACT として保存される', async () => {
      await service.saveSnapshot('profile_1', {
        id: 'ig_456',
        username: 'business_user',
        name: 'Biz User',
        biography: 'A business',
        followersCount: 20000,
        followsCount: 300,
        mediaCount: 80,
        profilePictureUrl: null,
        website: null,
        accountType: 'BUSINESS',
      })

      const createCall = vi.mocked(mockPrisma.profileSnapshot.create).mock.calls[0]?.[0]
      expect(createCall?.data?.followerCount).toBe(20000)
      expect(createCall?.data?.followerCountStatus).toBe('FACT')
    })
  })
})
