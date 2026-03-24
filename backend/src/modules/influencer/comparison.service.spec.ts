import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common'
import { ComparisonService } from './comparison.service'

// ---------------------------------------------------------------------------
// Minimal mock factory
// ---------------------------------------------------------------------------

function buildPrismaMock() {
  return {
    comparisonSession: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    comparisonItem: {
      delete: vi.fn(),
    },
    influencerProfile: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
  }
}

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makeProfileRow(id = 'profile-1') {
  return {
    id,
    platform: 'INSTAGRAM',
    username: `user_${id}`,
    displayName: null,
    profileUrl: null,
    deletedAt: null,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    snapshots: [],
    scoreRecords: [],
  }
}

function makeItem(profileId = 'profile-1', order = 0) {
  return {
    id: `item-${profileId}`,
    sessionId: 'session-1',
    profileId,
    displayOrder: order,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    profile: makeProfileRow(profileId),
  }
}

function makeSession(partial: Record<string, unknown> = {}) {
  return {
    id: 'session-1',
    userId: 'user-1',
    name: null,
    deletedAt: null,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    items: [],
    ...partial,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ComparisonService', () => {
  let service: ComparisonService
  let prisma: ReturnType<typeof buildPrismaMock>

  beforeEach(() => {
    prisma = buildPrismaMock()
    service = new ComparisonService(prisma as never)
  })

  // -------------------------------------------------------------------------
  // create
  // -------------------------------------------------------------------------

  describe('create', () => {
    it('creates a session and returns it', async () => {
      const profileIds = ['profile-1', 'profile-2']
      prisma.influencerProfile.findMany.mockResolvedValue(profileIds.map(makeProfileRow))
      prisma.comparisonSession.create.mockResolvedValue(
        makeSession({ items: profileIds.map((id, i) => makeItem(id, i)) }),
      )

      const result = await service.create('user-1', { profileIds })

      expect(result.id).toBe('session-1')
      expect(result.items).toHaveLength(2)
    })

    it('throws BadRequestException when more than 10 profiles are supplied', async () => {
      const profileIds = Array.from({ length: 11 }, (_, i) => `profile-${i}`)

      await expect(
        service.create('user-1', { profileIds }),
      ).rejects.toThrow(BadRequestException)
    })

    it('includes COMPARISON_LIMIT_EXCEEDED code when limit is exceeded', async () => {
      const profileIds = Array.from({ length: 11 }, (_, i) => `profile-${i}`)

      await expect(
        service.create('user-1', { profileIds }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'COMPARISON_LIMIT_EXCEEDED' }),
      })
    })

    it('throws NotFoundException when any profile id is missing', async () => {
      prisma.influencerProfile.findMany.mockResolvedValue([makeProfileRow('profile-1')])

      await expect(
        service.create('user-1', { profileIds: ['profile-1', 'does-not-exist'] }),
      ).rejects.toThrow(NotFoundException)
    })
  })

  // -------------------------------------------------------------------------
  // findById
  // -------------------------------------------------------------------------

  describe('findById', () => {
    it('returns the session when it belongs to the user', async () => {
      prisma.comparisonSession.findFirst.mockResolvedValue(makeSession())

      const result = await service.findById('user-1', 'session-1')

      expect(result.id).toBe('session-1')
    })

    it('throws NotFoundException when the session does not exist', async () => {
      prisma.comparisonSession.findFirst.mockResolvedValue(null)

      await expect(service.findById('user-1', 'missing')).rejects.toThrow(NotFoundException)
    })

    it('throws ForbiddenException when the session belongs to another user', async () => {
      prisma.comparisonSession.findFirst.mockResolvedValue(
        makeSession({ userId: 'other-user' }),
      )

      await expect(service.findById('user-1', 'session-1')).rejects.toThrow(ForbiddenException)
    })
  })

  // -------------------------------------------------------------------------
  // addItem
  // -------------------------------------------------------------------------

  describe('addItem', () => {
    it('adds a profile to the session', async () => {
      const existingItem = makeItem('profile-1', 0)
      prisma.comparisonSession.findFirst.mockResolvedValue(
        makeSession({ items: [existingItem] }),
      )
      prisma.influencerProfile.findFirst.mockResolvedValue(makeProfileRow('profile-2'))
      prisma.comparisonSession.update.mockResolvedValue(
        makeSession({ items: [existingItem, makeItem('profile-2', 1)] }),
      )

      const result = await service.addItem('user-1', 'session-1', {
        profileId: 'profile-2',
      })

      expect(result.items).toHaveLength(2)
    })

    it('throws BadRequestException when session already has 10 items', async () => {
      const items = Array.from({ length: 10 }, (_, i) => makeItem(`profile-${i}`, i))
      prisma.comparisonSession.findFirst.mockResolvedValue(makeSession({ items }))

      await expect(
        service.addItem('user-1', 'session-1', { profileId: 'profile-new' }),
      ).rejects.toThrow(BadRequestException)
    })

    it('includes COMPARISON_LIMIT_EXCEEDED code when 10-item limit is hit', async () => {
      const items = Array.from({ length: 10 }, (_, i) => makeItem(`profile-${i}`, i))
      prisma.comparisonSession.findFirst.mockResolvedValue(makeSession({ items }))

      await expect(
        service.addItem('user-1', 'session-1', { profileId: 'profile-new' }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'COMPARISON_LIMIT_EXCEEDED' }),
      })
    })

    it('throws BadRequestException when profile is already in the session', async () => {
      prisma.comparisonSession.findFirst.mockResolvedValue(
        makeSession({ items: [makeItem('profile-1', 0)] }),
      )

      await expect(
        service.addItem('user-1', 'session-1', { profileId: 'profile-1' }),
      ).rejects.toThrow(BadRequestException)
    })

    it('includes PROFILE_ALREADY_IN_SESSION code for duplicate profiles', async () => {
      prisma.comparisonSession.findFirst.mockResolvedValue(
        makeSession({ items: [makeItem('profile-1', 0)] }),
      )

      await expect(
        service.addItem('user-1', 'session-1', { profileId: 'profile-1' }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'PROFILE_ALREADY_IN_SESSION' }),
      })
    })

    it('throws NotFoundException when the profile to add does not exist', async () => {
      prisma.comparisonSession.findFirst.mockResolvedValue(makeSession())
      prisma.influencerProfile.findFirst.mockResolvedValue(null)

      await expect(
        service.addItem('user-1', 'session-1', { profileId: 'missing' }),
      ).rejects.toThrow(NotFoundException)
    })
  })

  // -------------------------------------------------------------------------
  // removeItem
  // -------------------------------------------------------------------------

  describe('removeItem', () => {
    it('deletes the item when it exists in the session', async () => {
      prisma.comparisonSession.findFirst.mockResolvedValue(
        makeSession({ items: [makeItem('profile-1', 0)] }),
      )
      prisma.comparisonItem.delete.mockResolvedValue({})

      await expect(
        service.removeItem('user-1', 'session-1', 'profile-1'),
      ).resolves.toBeUndefined()

      expect(prisma.comparisonItem.delete).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'item-profile-1' } }),
      )
    })

    it('throws NotFoundException when the profile is not in the session', async () => {
      prisma.comparisonSession.findFirst.mockResolvedValue(makeSession())

      await expect(
        service.removeItem('user-1', 'session-1', 'not-in-session'),
      ).rejects.toThrow(NotFoundException)
    })

    it('includes ITEM_NOT_FOUND code in the exception', async () => {
      prisma.comparisonSession.findFirst.mockResolvedValue(makeSession())

      await expect(
        service.removeItem('user-1', 'session-1', 'not-in-session'),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'ITEM_NOT_FOUND' }),
      })
    })
  })
})
