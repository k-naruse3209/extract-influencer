import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common'
import { PrismaService } from '../../common/prisma/prisma.service'
import { mapProfileToResponse } from './mappers/profile.mapper'
import type { CreateInfluencerDto } from './dto/create-influencer.dto'
import type { FindInfluencerQueryDto } from './dto/find-influencer-query.dto'
import type { InfluencerProfileResponse } from './types/influencer-profile.response'
import type { PaginatedResponse } from '../../common/types/pagination'

/**
 * Prisma include clause reused for profile detail queries.
 * Always loads the most-recent snapshot and score record.
 *
 * Ordering descending ensures index [0] is always the latest entry
 * in the mapped arrays.
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
export class InfluencerService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new InfluencerProfile record.
   *
   * The platform + username combination is unique in the DB (@@unique constraint).
   * If a duplicate is detected we throw ConflictException so callers can decide
   * whether to return the existing record or surface an error.
   */
  async create(dto: CreateInfluencerDto): Promise<InfluencerProfileResponse> {
    const existing = await this.prisma.influencerProfile.findFirst({
      where: {
        platform: dto.platform,
        username: dto.username,
        deletedAt: null,
      },
    })

    if (existing) {
      const full = await this.prisma.influencerProfile.findUniqueOrThrow({
        where: { id: existing.id },
        include: PROFILE_INCLUDE,
      })
      return mapProfileToResponse(full)
    }

    const profile = await this.prisma.influencerProfile.create({
      data: {
        platform: dto.platform,
        username: dto.username,
        profileUrl: dto.profileUrl ?? null,
      },
      include: PROFILE_INCLUDE,
    })

    return mapProfileToResponse(profile)
  }

  /**
   * Fetch a single profile by id with its latest snapshot and score.
   * Soft-deleted profiles are not visible.
   */
  async findById(id: string): Promise<InfluencerProfileResponse> {
    const profile = await this.prisma.influencerProfile.findFirst({
      where: { id, deletedAt: null },
      include: PROFILE_INCLUDE,
    })

    if (!profile) {
      throw new NotFoundException({
        code: 'PROFILE_NOT_FOUND',
        message: `Influencer profile with id "${id}" was not found`,
      })
    }

    return mapProfileToResponse(profile)
  }

  /**
   * Paginated list of profiles with optional platform / username filters.
   * Soft-deleted profiles are excluded.
   */
  async findAll(
    query: FindInfluencerQueryDto,
  ): Promise<PaginatedResponse<InfluencerProfileResponse>> {
    const { page, limit, platform, username } = query
    const skip = (page - 1) * limit

    const where = {
      deletedAt: null,
      ...(platform ? { platform } : {}),
      ...(username
        ? { username: { contains: username, mode: 'insensitive' as const } }
        : {}),
    }

    const [profiles, total] = await this.prisma.$transaction([
      this.prisma.influencerProfile.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: PROFILE_INCLUDE,
      }),
      this.prisma.influencerProfile.count({ where }),
    ])

    return {
      data: profiles.map(mapProfileToResponse),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }
  }
}
