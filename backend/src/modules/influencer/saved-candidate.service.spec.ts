import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common'
import { SavedCandidateService } from './saved-candidate.service'

function buildPrismaMock() {
  return {
    influencerProfile: {
      findFirst: vi.fn(),
    },
    savedCandidate: {
      findFirst: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
  }
}

function makeProfileRow() {
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
  }
}

function makeSavedCandidateRow(partial: Record<string, unknown> = {}) {
  return {
    id: 'saved-1',
    userId: 'user-1',
    profileId: 'profile-1',
    note: null,
    tags: [],
    deletedAt: null,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    profile: makeProfileRow(),
    ...partial,
  }
}

describe('SavedCandidateService', () => {
  let service: SavedCandidateService
  let prisma: ReturnType<typeof buildPrismaMock>

  beforeEach(() => {
    prisma = buildPrismaMock()
    service = new SavedCandidateService(prisma as never)
  })

  // -------------------------------------------------------------------------
  // save
  // -------------------------------------------------------------------------

  describe('save', () => {
    it('saves and returns a candidate when the profile exists', async () => {
      prisma.influencerProfile.findFirst.mockResolvedValue(makeProfileRow())
      prisma.savedCandidate.findFirst.mockResolvedValue(null)
      prisma.savedCandidate.create.mockResolvedValue(makeSavedCandidateRow())

      const result = await service.save('user-1', {
        profileId: 'profile-1',
        tags: [],
      })

      expect(result.id).toBe('saved-1')
      expect(result.profileId).toBe('profile-1')
    })

    it('throws NotFoundException when profile does not exist', async () => {
      prisma.influencerProfile.findFirst.mockResolvedValue(null)

      await expect(
        service.save('user-1', { profileId: 'missing', tags: [] }),
      ).rejects.toThrow(NotFoundException)
    })

    it('throws ConflictException when candidate is already saved', async () => {
      prisma.influencerProfile.findFirst.mockResolvedValue(makeProfileRow())
      prisma.savedCandidate.findFirst.mockResolvedValue(makeSavedCandidateRow())

      await expect(
        service.save('user-1', { profileId: 'profile-1', tags: [] }),
      ).rejects.toThrow(ConflictException)
    })

    it('includes CANDIDATE_ALREADY_SAVED code in the exception', async () => {
      prisma.influencerProfile.findFirst.mockResolvedValue(makeProfileRow())
      prisma.savedCandidate.findFirst.mockResolvedValue(makeSavedCandidateRow())

      await expect(
        service.save('user-1', { profileId: 'profile-1', tags: [] }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'CANDIDATE_ALREADY_SAVED' }),
      })
    })

    it('stores note and tags when provided', async () => {
      prisma.influencerProfile.findFirst.mockResolvedValue(makeProfileRow())
      prisma.savedCandidate.findFirst.mockResolvedValue(null)
      const row = makeSavedCandidateRow({ note: 'Great fit', tags: ['fashion'] })
      prisma.savedCandidate.create.mockResolvedValue(row)

      const result = await service.save('user-1', {
        profileId: 'profile-1',
        note: 'Great fit',
        tags: ['fashion'],
      })

      expect(result.note).toBe('Great fit')
      expect(result.tags).toEqual(['fashion'])
    })
  })

  // -------------------------------------------------------------------------
  // findAll
  // -------------------------------------------------------------------------

  describe('findAll', () => {
    it('returns all saved candidates for a user', async () => {
      prisma.savedCandidate.findMany.mockResolvedValue([makeSavedCandidateRow()])

      const result = await service.findAll('user-1')

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('saved-1')
    })

    it('returns an empty array when user has no saved candidates', async () => {
      prisma.savedCandidate.findMany.mockResolvedValue([])

      const result = await service.findAll('user-1')

      expect(result).toHaveLength(0)
    })
  })

  // -------------------------------------------------------------------------
  // remove
  // -------------------------------------------------------------------------

  describe('remove', () => {
    it('soft-deletes the candidate when the user owns it', async () => {
      prisma.savedCandidate.findFirst.mockResolvedValue(
        makeSavedCandidateRow({ userId: 'user-1' }),
      )
      prisma.savedCandidate.update.mockResolvedValue({})

      await expect(service.remove('user-1', 'saved-1')).resolves.toBeUndefined()
      expect(prisma.savedCandidate.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'saved-1' } }),
      )
    })

    it('throws NotFoundException when the candidate does not exist', async () => {
      prisma.savedCandidate.findFirst.mockResolvedValue(null)

      await expect(service.remove('user-1', 'missing')).rejects.toThrow(NotFoundException)
    })

    it('throws ForbiddenException when the candidate belongs to another user', async () => {
      prisma.savedCandidate.findFirst.mockResolvedValue(
        makeSavedCandidateRow({ userId: 'other-user' }),
      )

      await expect(service.remove('user-1', 'saved-1')).rejects.toThrow(ForbiddenException)
    })

    it('includes FORBIDDEN code in the exception', async () => {
      prisma.savedCandidate.findFirst.mockResolvedValue(
        makeSavedCandidateRow({ userId: 'other-user' }),
      )

      await expect(service.remove('user-1', 'saved-1')).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'FORBIDDEN' }),
      })
    })
  })
})
