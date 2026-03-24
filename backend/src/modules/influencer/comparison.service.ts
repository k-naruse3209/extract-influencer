import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common'
import { PrismaService } from '../../common/prisma/prisma.service'
import { mapProfileToResponse } from './mappers/profile.mapper'
import type { CreateComparisonDto } from './dto/create-comparison.dto'
import type { AddComparisonItemDto } from './dto/add-comparison-item.dto'
import type { ComparisonSessionResponse } from './types/comparison-session.response'

const MAX_COMPARISON_ITEMS = 10

/**
 * Include clause for loading a ComparisonSession with all its items and their
 * associated InfluencerProfile data (latest snapshot + score).
 */
const SESSION_INCLUDE = {
  items: {
    orderBy: { displayOrder: 'asc' as const },
    include: {
      profile: {
        include: {
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
        },
      },
    },
  },
} as const

@Injectable()
export class ComparisonService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Build the serialisable ComparisonSessionResponse from a Prisma result.
   * Kept private to avoid duplication across methods.
   */
  private mapSession(
    session: Awaited<
      ReturnType<typeof this.prisma.comparisonSession.findFirst>
    > & {
      items: {
        id: string
        profileId: string
        displayOrder: number
        profile: Parameters<typeof mapProfileToResponse>[0]
      }[]
    },
  ): ComparisonSessionResponse {
    return {
      id: session.id,
      name: session.name ?? null,
      items: session.items.map((item) => ({
        id: item.id,
        profileId: item.profileId,
        displayOrder: item.displayOrder,
        profile: mapProfileToResponse(item.profile),
      })),
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
    }
  }

  /**
   * Verify that a session exists, is not soft-deleted, and belongs to the
   * requesting user.  Returns the raw session record on success.
   */
  private async resolveSession(userId: string, sessionId: string) {
    const session = await this.prisma.comparisonSession.findFirst({
      where: { id: sessionId, deletedAt: null },
      include: SESSION_INCLUDE,
    })

    if (!session) {
      throw new NotFoundException({
        code: 'SESSION_NOT_FOUND',
        message: `Comparison session with id "${sessionId}" was not found`,
      })
    }

    if (session.userId !== userId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'You do not have permission to access this comparison session',
      })
    }

    return session
  }

  /**
   * Create a new ComparisonSession.
   *
   * Initial profileIds are optional — the session can be populated via addItem.
   * Throws BadRequestException when more than MAX_COMPARISON_ITEMS are supplied.
   */
  async create(userId: string, dto: CreateComparisonDto): Promise<ComparisonSessionResponse> {
    if (dto.profileIds.length > MAX_COMPARISON_ITEMS) {
      throw new BadRequestException({
        code: 'COMPARISON_LIMIT_EXCEEDED',
        message: `A comparison session cannot contain more than ${MAX_COMPARISON_ITEMS} profiles`,
      })
    }

    // Validate that all referenced profiles exist and are not soft-deleted.
    const profiles = await this.prisma.influencerProfile.findMany({
      where: {
        id: { in: dto.profileIds },
        deletedAt: null,
      },
      select: { id: true },
    })

    if (profiles.length !== dto.profileIds.length) {
      const foundIds = new Set(profiles.map((p) => p.id))
      const missing = dto.profileIds.filter((id) => !foundIds.has(id))
      throw new NotFoundException({
        code: 'PROFILE_NOT_FOUND',
        message: `The following profile ids were not found: ${missing.join(', ')}`,
      })
    }

    const session = await this.prisma.comparisonSession.create({
      data: {
        userId,
        name: dto.name ?? null,
        items: {
          create: dto.profileIds.map((profileId, index) => ({
            profileId,
            displayOrder: index,
          })),
        },
      },
      include: SESSION_INCLUDE,
    })

    return this.mapSession(session)
  }

  /**
   * Retrieve a ComparisonSession by id.
   * The session must belong to the requesting user.
   */
  async findById(userId: string, id: string): Promise<ComparisonSessionResponse> {
    const session = await this.resolveSession(userId, id)
    return this.mapSession(session)
  }

  /**
   * Add a single InfluencerProfile to an existing ComparisonSession.
   *
   * Throws BadRequestException when the session already contains
   * MAX_COMPARISON_ITEMS profiles.
   * Throws BadRequestException when the profile is already in the session.
   */
  async addItem(
    userId: string,
    sessionId: string,
    dto: AddComparisonItemDto,
  ): Promise<ComparisonSessionResponse> {
    const session = await this.resolveSession(userId, sessionId)

    if (session.items.length >= MAX_COMPARISON_ITEMS) {
      throw new BadRequestException({
        code: 'COMPARISON_LIMIT_EXCEEDED',
        message: `A comparison session cannot contain more than ${MAX_COMPARISON_ITEMS} profiles`,
      })
    }

    const alreadyAdded = session.items.some((item) => item.profileId === dto.profileId)
    if (alreadyAdded) {
      throw new BadRequestException({
        code: 'PROFILE_ALREADY_IN_SESSION',
        message: 'This profile is already part of the comparison session',
      })
    }

    const profile = await this.prisma.influencerProfile.findFirst({
      where: { id: dto.profileId, deletedAt: null },
      select: { id: true },
    })

    if (!profile) {
      throw new NotFoundException({
        code: 'PROFILE_NOT_FOUND',
        message: `Influencer profile with id "${dto.profileId}" was not found`,
      })
    }

    const nextOrder = session.items.length

    const updated = await this.prisma.comparisonSession.update({
      where: { id: sessionId },
      data: {
        updatedAt: new Date(),
        items: {
          create: {
            profileId: dto.profileId,
            displayOrder: nextOrder,
          },
        },
      },
      include: SESSION_INCLUDE,
    })

    return this.mapSession(updated)
  }

  /**
   * Remove a single profile from a ComparisonSession by hard-deleting the
   * ComparisonItem row (ComparisonItem has no deletedAt column per schema).
   *
   * Throws NotFoundException when the profile is not in the session.
   */
  async removeItem(userId: string, sessionId: string, profileId: string): Promise<void> {
    const session = await this.resolveSession(userId, sessionId)

    const item = session.items.find((i) => i.profileId === profileId)
    if (!item) {
      throw new NotFoundException({
        code: 'ITEM_NOT_FOUND',
        message: `Profile "${profileId}" is not part of this comparison session`,
      })
    }

    await this.prisma.comparisonItem.delete({
      where: { id: item.id },
    })
  }
}
