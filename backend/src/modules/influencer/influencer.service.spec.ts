import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ConflictException, NotFoundException } from '@nestjs/common'
import { InfluencerService } from './influencer.service'

// ---------------------------------------------------------------------------
// Minimal PrismaService mock factory
// ---------------------------------------------------------------------------

function buildPrismaMock(overrides: Record<string, unknown> = {}) {
  return {
    influencerProfile: {
      findFirst: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn(),
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makeProfileRow(partial: Partial<{
  id: string
  platform: string
  username: string
  displayName: string | null
  profileUrl: string | null
  deletedAt: Date | null
  createdAt: Date
  updatedAt: Date
}> = {}) {
  return {
    id: 'profile-1',
    platform: 'INSTAGRAM',
    username: 'test_user',
    displayName: null,
    profileUrl: null,
    deletedAt: null,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    snapshots: [],
    scoreRecords: [],
    ...partial,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('InfluencerService', () => {
  let service: InfluencerService
  let prisma: ReturnType<typeof buildPrismaMock>

  beforeEach(() => {
    prisma = buildPrismaMock()
    service = new InfluencerService(prisma as never)
  })

  // -------------------------------------------------------------------------
  // create
  // -------------------------------------------------------------------------

  describe('create', () => {
    it('creates and returns a profile when no duplicate exists', async () => {
      prisma.influencerProfile.findFirst.mockResolvedValue(null)
      const row = makeProfileRow()
      prisma.influencerProfile.create.mockResolvedValue(row)

      const result = await service.create({
        platform: 'INSTAGRAM',
        username: 'test_user',
      })

      expect(result.id).toBe('profile-1')
      expect(result.username).toBe('test_user')
      expect(result.latestSnapshot).toBeNull()
      expect(result.latestScore).toBeNull()
    })

    it('throws ConflictException when a duplicate profile exists', async () => {
      prisma.influencerProfile.findFirst.mockResolvedValue(makeProfileRow())

      await expect(
        service.create({ platform: 'INSTAGRAM', username: 'test_user' }),
      ).rejects.toThrow(ConflictException)
    })

    it('includes PROFILE_ALREADY_EXISTS error code in the exception', async () => {
      prisma.influencerProfile.findFirst.mockResolvedValue(makeProfileRow())

      await expect(
        service.create({ platform: 'INSTAGRAM', username: 'test_user' }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'PROFILE_ALREADY_EXISTS' }),
      })
    })

    it('stores profileUrl when provided', async () => {
      prisma.influencerProfile.findFirst.mockResolvedValue(null)
      const row = makeProfileRow({ profileUrl: 'https://instagram.com/test' })
      prisma.influencerProfile.create.mockResolvedValue(row)

      const result = await service.create({
        platform: 'INSTAGRAM',
        username: 'test_user',
        profileUrl: 'https://instagram.com/test',
      })

      expect(result.profileUrl).toBe('https://instagram.com/test')
    })
  })

  // -------------------------------------------------------------------------
  // findById
  // -------------------------------------------------------------------------

  describe('findById', () => {
    it('returns the profile when it exists', async () => {
      prisma.influencerProfile.findFirst.mockResolvedValue(makeProfileRow())

      const result = await service.findById('profile-1')

      expect(result.id).toBe('profile-1')
    })

    it('throws NotFoundException when profile does not exist', async () => {
      prisma.influencerProfile.findFirst.mockResolvedValue(null)

      await expect(service.findById('missing-id')).rejects.toThrow(NotFoundException)
    })

    it('includes PROFILE_NOT_FOUND code in the exception', async () => {
      prisma.influencerProfile.findFirst.mockResolvedValue(null)

      await expect(service.findById('missing-id')).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'PROFILE_NOT_FOUND' }),
      })
    })

    it('maps a snapshot to the response when one exists', async () => {
      const snapshot = {
        id: 'snap-1',
        profileId: 'profile-1',
        dataSource: 'instagram_graph_api',
        fetchedAt: new Date('2024-06-01T00:00:00Z'),
        followerCount: 12500,
        followerCountStatus: 'FACT',
        followingCount: 300,
        followingCountStatus: 'FACT',
        mediaCount: 80,
        mediaCountStatus: 'FACT',
        biography: 'Hello world',
        biographyStatus: 'FACT',
        profilePictureUrl: null,
        isVerified: false,
        isPrivate: false,
        externalUrl: null,
        category: null,
        engagementRate: 0.032,
        engagementRateStatus: 'ESTIMATED',
        engagementRateConfidence: 'HIGH',
        avgLikesPerPost: null,
        avgLikesPerPostStatus: 'ESTIMATED',
        avgCommentsPerPost: null,
        avgCommentsPerPostStatus: 'ESTIMATED',
        rawResponse: null,
        deletedAt: null,
        createdAt: new Date('2024-06-01T00:00:00Z'),
      }
      const row = makeProfileRow({ snapshots: [snapshot] } as never)
      prisma.influencerProfile.findFirst.mockResolvedValue(row)

      const result = await service.findById('profile-1')

      expect(result.latestSnapshot).not.toBeNull()
      expect(result.latestSnapshot?.followerCount).toMatchObject({
        value: 12500,
        status: 'FACT',
      })
      expect(result.latestSnapshot?.engagementRate).toMatchObject({
        value: 0.032,
        status: 'ESTIMATED',
        confidence: 'HIGH',
      })
    })

    it('maps a score record with breakdowns to latestScore', async () => {
      const scoreRecord = {
        id: 'score-1',
        profileId: 'profile-1',
        totalScore: 78.5,
        confidence: 'HIGH',
        dataType: 'ESTIMATED',
        scoringModel: 'v1.0.0',
        scoredAt: new Date('2024-07-01T00:00:00Z'),
        deletedAt: null,
        createdAt: new Date('2024-07-01T00:00:00Z'),
        breakdowns: [
          {
            id: 'bd-1',
            scoreRecordId: 'score-1',
            category: 'ENGAGEMENT',
            score: 82,
            confidence: 'HIGH',
            weight: 0.3,
            rationale: 'Good engagement rate',
            dataType: 'ESTIMATED',
            createdAt: new Date('2024-07-01T00:00:00Z'),
          },
        ],
      }
      const row = makeProfileRow({ scoreRecords: [scoreRecord] } as never)
      prisma.influencerProfile.findFirst.mockResolvedValue(row)

      const result = await service.findById('profile-1')

      expect(result.latestScore).not.toBeNull()
      expect(result.latestScore?.totalScore).toBe(78.5)
      expect(result.latestScore?.confidence).toBe('HIGH')
      expect(result.latestScore?.breakdowns).toHaveLength(1)
      expect(result.latestScore?.breakdowns[0]).toMatchObject({
        category: 'ENGAGEMENT',
        score: 82,
        confidence: 'HIGH',
      })
      expect(result.latestScore?.scoredAt).toBe('2024-07-01T00:00:00.000Z')
    })

    it('returns UNAVAILABLE when followerCount is null in snapshot', async () => {
      const snapshot = {
        id: 'snap-2',
        profileId: 'profile-1',
        dataSource: 'instagram_graph_api',
        fetchedAt: new Date(),
        followerCount: null,
        followerCountStatus: 'FACT',
        followingCount: null,
        followingCountStatus: 'FACT',
        mediaCount: null,
        mediaCountStatus: 'FACT',
        biography: null,
        biographyStatus: 'FACT',
        profilePictureUrl: null,
        isVerified: null,
        isPrivate: null,
        externalUrl: null,
        category: null,
        engagementRate: null,
        engagementRateStatus: 'ESTIMATED',
        engagementRateConfidence: null,
        avgLikesPerPost: null,
        avgLikesPerPostStatus: 'ESTIMATED',
        avgCommentsPerPost: null,
        avgCommentsPerPostStatus: 'ESTIMATED',
        rawResponse: null,
        deletedAt: null,
        createdAt: new Date(),
      }
      const row = makeProfileRow({ snapshots: [snapshot] } as never)
      prisma.influencerProfile.findFirst.mockResolvedValue(row)

      const result = await service.findById('profile-1')

      expect(result.latestSnapshot?.followerCount.status).toBe('UNAVAILABLE')
      expect(result.latestSnapshot?.followerCount.value).toBeNull()
    })
  })

  // -------------------------------------------------------------------------
  // findAll
  // -------------------------------------------------------------------------

  describe('findAll', () => {
    it('returns paginated profiles', async () => {
      const rows = [makeProfileRow(), makeProfileRow({ id: 'profile-2', username: 'user2' })]
      prisma.$transaction.mockResolvedValue([rows, 2])

      const result = await service.findAll({ page: 1, limit: 20 })

      expect(result.data).toHaveLength(2)
      expect(result.meta).toMatchObject({
        page: 1,
        limit: 20,
        total: 2,
        totalPages: 1,
      })
    })

    it('calculates totalPages correctly', async () => {
      prisma.$transaction.mockResolvedValue([[], 45])

      const result = await service.findAll({ page: 3, limit: 20 })

      expect(result.meta.totalPages).toBe(3)
    })

    it('returns empty data array when no profiles exist', async () => {
      prisma.$transaction.mockResolvedValue([[], 0])

      const result = await service.findAll({ page: 1, limit: 20 })

      expect(result.data).toHaveLength(0)
      expect(result.meta.total).toBe(0)
    })
  })
})
