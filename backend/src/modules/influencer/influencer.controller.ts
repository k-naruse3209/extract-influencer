import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  BadRequestException,
} from '@nestjs/common'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import type { JwtPayload } from '../../common/decorators/current-user.decorator'
import { InfluencerService } from './influencer.service'
import { SavedCandidateService } from './saved-candidate.service'
import { ComparisonService } from './comparison.service'
import {
  CreateInfluencerSchema,
  type CreateInfluencerDto,
} from './dto/create-influencer.dto'
import {
  FindInfluencerQuerySchema,
  type FindInfluencerQueryDto,
} from './dto/find-influencer-query.dto'
import {
  SaveCandidateSchema,
  type SaveCandidateDto,
} from './dto/save-candidate.dto'
import {
  CreateComparisonSchema,
  type CreateComparisonDto,
} from './dto/create-comparison.dto'
import {
  AddComparisonItemSchema,
  type AddComparisonItemDto,
} from './dto/add-comparison-item.dto'
import type { InfluencerProfileResponse } from './types/influencer-profile.response'
import type { SavedCandidateResponse } from './types/saved-candidate.response'
import type { ComparisonSessionResponse } from './types/comparison-session.response'
import type { PaginatedResponse } from '../../common/types/pagination'

/**
 * Parse and validate an incoming body with a Zod schema.
 * Throws BadRequestException with the first validation error message on failure.
 */
function parseBody<T>(schema: { safeParse: (v: unknown) => { success: boolean; data?: T; error?: { errors: { message: string }[] } } }, body: unknown): T {
  const result = schema.safeParse(body)
  if (!result.success) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: result.error?.errors[0]?.message ?? 'Invalid request body',
    })
  }
  return result.data as T
}

@UseGuards(JwtAuthGuard)
@Controller()
export class InfluencerController {
  constructor(
    private readonly influencerService: InfluencerService,
    private readonly savedCandidateService: SavedCandidateService,
    private readonly comparisonService: ComparisonService,
  ) {}

  // ---------------------------------------------------------------------------
  // Influencer Profiles
  // ---------------------------------------------------------------------------

  /**
   * POST /api/v1/influencer-profiles
   * Create a new InfluencerProfile by username / URL.
   */
  @Post('influencer-profiles')
  @HttpCode(HttpStatus.CREATED)
  async createProfile(
    @Body() body: unknown,
  ): Promise<InfluencerProfileResponse> {
    const dto: CreateInfluencerDto = parseBody(CreateInfluencerSchema, body)
    return this.influencerService.create(dto)
  }

  /**
   * GET /api/v1/influencer-profiles
   * Paginated list with optional platform / username filters.
   */
  @Get('influencer-profiles')
  async listProfiles(
    @Query() query: unknown,
  ): Promise<PaginatedResponse<InfluencerProfileResponse>> {
    const dto: FindInfluencerQueryDto = parseBody(FindInfluencerQuerySchema, query)
    return this.influencerService.findAll(dto)
  }

  /**
   * GET /api/v1/influencer-profiles/:id
   * Fetch a single profile with its latest snapshot and score.
   */
  @Get('influencer-profiles/:id')
  async getProfile(
    @Param('id') id: string,
  ): Promise<InfluencerProfileResponse> {
    return this.influencerService.findById(id)
  }

  // ---------------------------------------------------------------------------
  // Saved Candidates
  // ---------------------------------------------------------------------------

  /**
   * POST /api/v1/saved-candidates
   * Save an InfluencerProfile as a candidate for the authenticated user.
   */
  @Post('saved-candidates')
  @HttpCode(HttpStatus.CREATED)
  async saveCandidate(
    @CurrentUser() user: JwtPayload,
    @Body() body: unknown,
  ): Promise<SavedCandidateResponse> {
    const dto: SaveCandidateDto = parseBody(SaveCandidateSchema, body)
    return this.savedCandidateService.save(user.sub, dto)
  }

  /**
   * GET /api/v1/saved-candidates
   * List all saved candidates for the authenticated user.
   */
  @Get('saved-candidates')
  async listCandidates(
    @CurrentUser() user: JwtPayload,
  ): Promise<SavedCandidateResponse[]> {
    return this.savedCandidateService.findAll(user.sub)
  }

  /**
   * DELETE /api/v1/saved-candidates/:id
   * Remove a saved candidate (soft delete).
   */
  @Delete('saved-candidates/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeCandidate(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ): Promise<void> {
    return this.savedCandidateService.remove(user.sub, id)
  }

  // ---------------------------------------------------------------------------
  // Comparison Sessions
  // ---------------------------------------------------------------------------

  /**
   * POST /api/v1/comparison-sessions
   * Create a new comparison session with up to 10 profiles.
   */
  @Post('comparison-sessions')
  @HttpCode(HttpStatus.CREATED)
  async createSession(
    @CurrentUser() user: JwtPayload,
    @Body() body: unknown,
  ): Promise<ComparisonSessionResponse> {
    const dto: CreateComparisonDto = parseBody(CreateComparisonSchema, body)
    return this.comparisonService.create(user.sub, dto)
  }

  /**
   * GET /api/v1/comparison-sessions/:id
   * Retrieve a session with all nested profiles and scores.
   */
  @Get('comparison-sessions/:id')
  async getSession(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ): Promise<ComparisonSessionResponse> {
    return this.comparisonService.findById(user.sub, id)
  }

  /**
   * POST /api/v1/comparison-sessions/:id/items
   * Add a profile to an existing comparison session.
   */
  @Post('comparison-sessions/:id/items')
  @HttpCode(HttpStatus.CREATED)
  async addSessionItem(
    @CurrentUser() user: JwtPayload,
    @Param('id') sessionId: string,
    @Body() body: unknown,
  ): Promise<ComparisonSessionResponse> {
    const dto: AddComparisonItemDto = parseBody(AddComparisonItemSchema, body)
    return this.comparisonService.addItem(user.sub, sessionId, dto)
  }

  /**
   * DELETE /api/v1/comparison-sessions/:id/items/:profileId
   * Remove a profile from a comparison session.
   */
  @Delete('comparison-sessions/:id/items/:profileId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeSessionItem(
    @CurrentUser() user: JwtPayload,
    @Param('id') sessionId: string,
    @Param('profileId') profileId: string,
  ): Promise<void> {
    return this.comparisonService.removeItem(user.sub, sessionId, profileId)
  }
}
