import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common'
import { PrismaService } from '../../common/prisma/prisma.service'
import { mapProfileToResponse } from './mappers/profile.mapper'
import type { SaveCandidateDto } from './dto/save-candidate.dto'
import type { SavedCandidateResponse } from './types/saved-candidate.response'

/**
 * Minimum include block for the nested InfluencerProfile within a
 * SavedCandidate query. Re-uses the same ordering convention as InfluencerService
 * so mapProfileToResponse receives the expected shape.
 */
const PROFILE_INCLUDE = {
  snapshots: {
    where: { deletedAt: null },
    orderBy: { fetchedAt: 'desc' as const },
    take: 1,
  },
  scoreRecords: {
    where: { deletedAt: null },
    orderBy: { scoredAt: 'desc' as const },
    take: 1,
    include: {
      breakdowns: {
        orderBy: { createdAt: 'asc' as const },
      },
    },
  },
} as const

@Injectable()
export class SavedCandidateService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Save an InfluencerProfile as a candidate for the given user.
   *
   * Throws NotFoundException when the referenced profile does not exist.
   * Throws ConflictException when the user has already saved this profile.
   */
  async save(userId: string, dto: SaveCandidateDto): Promise<SavedCandidateResponse> {
    const profile = await this.prisma.influencerProfile.findFirst({
      where: { id: dto.profileId, deletedAt: null },
    })

    if (!profile) {
      throw new NotFoundException({
        code: 'PROFILE_NOT_FOUND',
        message: `Influencer profile with id "${dto.profileId}" was not found`,
      })
    }

    const existing = await this.prisma.savedCandidate.findFirst({
      where: {
        userId,
        profileId: dto.profileId,
        deletedAt: null,
      },
    })

    if (existing) {
      throw new ConflictException({
        code: 'CANDIDATE_ALREADY_SAVED',
        message: 'This influencer profile is already saved',
      })
    }

    const saved = await this.prisma.savedCandidate.create({
      data: {
        userId,
        profileId: dto.profileId,
        note: dto.note ?? null,
        tags: dto.tags,
      },
      include: {
        profile: {
          include: PROFILE_INCLUDE,
        },
      },
    })

    return {
      id: saved.id,
      profileId: saved.profileId,
      note: saved.note ?? null,
      tags: saved.tags,
      profile: mapProfileToResponse(saved.profile),
      createdAt: saved.createdAt.toISOString(),
    }
  }

  /**
   * List all non-deleted saved candidates for the given user.
   */
  async findAll(userId: string): Promise<SavedCandidateResponse[]> {
    const candidates = await this.prisma.savedCandidate.findMany({
      where: { userId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: {
        profile: {
          include: PROFILE_INCLUDE,
        },
      },
    })

    return candidates.map((c) => ({
      id: c.id,
      profileId: c.profileId,
      note: c.note ?? null,
      tags: c.tags,
      profile: mapProfileToResponse(c.profile),
      createdAt: c.createdAt.toISOString(),
    }))
  }

  /**
   * Soft-delete a saved candidate.
   *
   * Throws NotFoundException when the record does not exist (or is already deleted).
   * Throws ForbiddenException when the record belongs to a different user.
   */
  async remove(userId: string, id: string): Promise<void> {
    const candidate = await this.prisma.savedCandidate.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, userId: true },
    })

    if (!candidate) {
      throw new NotFoundException({
        code: 'CANDIDATE_NOT_FOUND',
        message: `Saved candidate with id "${id}" was not found`,
      })
    }

    if (candidate.userId !== userId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'You do not have permission to remove this saved candidate',
      })
    }

    await this.prisma.savedCandidate.update({
      where: { id },
      data: { deletedAt: new Date() },
    })
  }
}
