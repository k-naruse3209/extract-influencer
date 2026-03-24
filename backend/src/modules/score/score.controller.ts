import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  NotFoundException,
} from '@nestjs/common'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import {
  CurrentUser,
  type JwtPayload,
} from '../../common/decorators/current-user.decorator'
import { ScoreService } from './score.service'
import { AuditLogService } from '../../common/audit/audit-log.service'
import type { ScoreRecordResponse } from './types/score-record.response'

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('influencer-profiles/:profileId/scores')
export class ScoreController {
  constructor(
    private readonly scoreService: ScoreService,
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * POST /api/v1/influencer-profiles/:profileId/scores
   *
   * Trigger score calculation for a profile.
   * Requires ADMIN or ANALYST role.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles('ADMIN', 'ANALYST')
  async calculate(
    @Param('profileId') profileId: string,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<ScoreRecordResponse> {
    const result = await this.scoreService.calculateAndSave(profileId)

    await this.auditLogService.log({
      userId: currentUser.sub,
      action: 'SCORE_CALCULATE',
      entity: 'ScoreRecord',
      entityId: result.id,
      details: {
        profileId,
        totalScore: result.totalScore,
        confidence: result.confidence,
        scoringModel: result.scoringModel,
      },
    })

    return result
  }

  /**
   * GET /api/v1/influencer-profiles/:profileId/scores/latest
   *
   * Return the most recent score record.
   */
  @Get('latest')
  async getLatest(
    @Param('profileId') profileId: string,
  ): Promise<ScoreRecordResponse> {
    const result = await this.scoreService.findLatest(profileId)
    if (!result) {
      throw new NotFoundException({
        code: 'SCORE_NOT_FOUND',
        message: `No score record found for profile "${profileId}"`,
      })
    }
    return result
  }

  /**
   * GET /api/v1/influencer-profiles/:profileId/scores
   *
   * Return score history (newest first).
   * Optional query parameter `limit` (default 20, max 100).
   */
  @Get()
  async getHistory(
    @Param('profileId') profileId: string,
    @Query('limit') limitParam?: string,
  ): Promise<ScoreRecordResponse[]> {
    const limit = parseLimit(limitParam)
    return this.scoreService.findHistory(profileId, limit)
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseLimit(raw: string | undefined): number {
  if (raw === undefined) return 20
  const parsed = Number(raw)
  if (Number.isNaN(parsed) || parsed < 1) return 20
  if (parsed > 100) return 100
  return Math.floor(parsed)
}
