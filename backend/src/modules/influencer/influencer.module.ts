import { Module } from '@nestjs/common'
import { InfluencerController } from './influencer.controller'
import { InfluencerService } from './influencer.service'
import { SavedCandidateService } from './saved-candidate.service'
import { ComparisonService } from './comparison.service'

/**
 * InfluencerModule
 *
 * Registers all providers and the single controller that handles:
 *
 *   Profile management:
 *     POST   /api/v1/influencer-profiles
 *     GET    /api/v1/influencer-profiles
 *     GET    /api/v1/influencer-profiles/:id
 *
 *   Saved candidates:
 *     POST   /api/v1/saved-candidates
 *     GET    /api/v1/saved-candidates
 *     DELETE /api/v1/saved-candidates/:id
 *
 *   Comparison sessions:
 *     POST   /api/v1/comparison-sessions
 *     GET    /api/v1/comparison-sessions/:id
 *     POST   /api/v1/comparison-sessions/:id/items
 *     DELETE /api/v1/comparison-sessions/:id/items/:profileId
 *
 * PrismaService is injected globally via PrismaModule (@Global).
 * JwtAuthGuard relies on PassportModule being available in this module's scope.
 */
@Module({
  controllers: [InfluencerController],
  providers: [InfluencerService, SavedCandidateService, ComparisonService],
})
export class InfluencerModule {}
