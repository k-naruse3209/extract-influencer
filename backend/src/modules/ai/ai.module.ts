import { Module } from '@nestjs/common'
import { ClaudeApiClient } from './claude-api.client'
import { AiAnalysisService } from './ai-analysis.service'

/**
 * AI分析モジュール。
 *
 * ClaudeApiClient と AiAnalysisService を提供する。
 * ScoreModule など他モジュールからは imports: [AiModule] でインポートして使う。
 *
 * PrismaModule はグローバル登録済みのため再インポート不要。
 */
@Module({
  providers: [ClaudeApiClient, AiAnalysisService],
  exports: [AiAnalysisService],
})
export class AiModule {}
