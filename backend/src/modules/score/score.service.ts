import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common'
import { PrismaService } from '../../common/prisma/prisma.service'
import { AiAnalysisService } from '../ai/ai-analysis.service'
import { LlmParseException } from '../ai/exceptions/llm-parse.exception'
import { calculateEngagementScore } from './calculators/engagement.calculator'
import { calculatePseudoActivityScore } from './calculators/pseudo-activity.calculator'
import { calculateRiskScore } from './calculators/risk.calculator'
import { calculateGrowthScore } from './calculators/growth.calculator'
import { calculateBrandFitScore } from './calculators/brand-fit.calculator'
import { calculateTotalScore, DEFAULT_WEIGHTS } from './calculators/total-score.calculator'
import type { SnapshotData, SubScoreMap, ScoreCategoryValue } from './types/score.types'
import type { ScoreRecordResponse } from './types/score-record.response'
import type { AnalysisProfileInput } from '../ai/types/ai-analysis.types'

/** スコアリングモデルバージョン。全スコアレコードに保存して再現性を確保する。 */
const SCORING_MODEL_VERSION = 'v1.0.0'

@Injectable()
export class ScoreService {
  private readonly logger = new Logger(ScoreService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiAnalysisService: AiAnalysisService,
  ) {}

  /**
   * 全サブスコアを計算して保存する。
   *
   * スコアリングフロー:
   * 1. プロフィールの存在確認
   * 2. 直近スナップショットを取得
   * 3. AiAnalysisService でブランド適合スコアを生成（失敗時は fallback）
   * 4. 全サブスコアを純粋関数で計算
   * 5. 合計スコアを計算
   * 6. スコアレコードとブレークダウンをDBに保存
   * 7. AI分析結果をDBに保存（失敗してもスコア保存には影響しない）
   *
   * スコアレコードはINSERT-ONLY（追記式）。UPDATE しない。
   */
  async calculateAndSave(profileId: string): Promise<ScoreRecordResponse> {
    // 1. プロフィール存在確認
    const profile = await this.prisma.influencerProfile.findFirst({
      where: { id: profileId, deletedAt: null },
    })

    if (!profile) {
      throw new NotFoundException({
        code: 'PROFILE_NOT_FOUND',
        message: `Influencer profile with id "${profileId}" was not found`,
      })
    }

    // 2. スナップショット取得（最新から最大10件、成長トレンド計算用）
    const snapshots = await this.prisma.profileSnapshot.findMany({
      where: { profileId, deletedAt: null },
      orderBy: { fetchedAt: 'desc' },
      take: 10,
    })

    if (snapshots.length === 0) {
      throw new NotFoundException({
        code: 'NO_SNAPSHOTS',
        message: `No snapshots found for profile "${profileId}". Fetch profile data first.`,
      })
    }

    const snapshotDataList = snapshots.map(mapPrismaSnapshotToData)
    const latestSnapshot = snapshotDataList[0]

    // 3. LLMでブランド適合スコアを生成
    //    失敗しても calculateAndSave 全体を止めない（fallback: 50/LOW）
    const analysisInput = buildAnalysisProfileInput(profile, latestSnapshot)
    let llmBrandFitResult: { score: number; confidence: 'LOW' | 'MEDIUM' | 'HIGH' } | undefined
    let brandFitAnalysisResult: Awaited<ReturnType<AiAnalysisService['analyzeBrandFit']>> | undefined

    try {
      brandFitAnalysisResult = await this.aiAnalysisService.analyzeBrandFit(analysisInput)
      llmBrandFitResult = {
        score: brandFitAnalysisResult.score,
        confidence: brandFitAnalysisResult.confidence,
      }
    } catch (err) {
      if (err instanceof LlmParseException) {
        this.logger.warn(
          `ブランド適合LLM分析に失敗しました。フォールバック値(50/LOW)を使用します。profileId=${profileId}`,
        )
      } else {
        this.logger.warn(
          `ブランド適合LLM分析で予期しないエラーが発生しました。フォールバック値を使用します。profileId=${profileId}`,
        )
      }
    }

    // 4. 全サブスコアを純粋関数で計算
    const brandFit = calculateBrandFitScore(llmBrandFitResult)
    const engagement = calculateEngagementScore(latestSnapshot)
    const pseudoActivity = calculatePseudoActivityScore(latestSnapshot)
    const growth = calculateGrowthScore(snapshotDataList)

    const partialScores: Partial<SubScoreMap> = { BRAND_FIT: brandFit }
    const followerCountAvailable =
      latestSnapshot.followerCount !== null &&
      latestSnapshot.followerCountStatus !== 'UNAVAILABLE'
    const risk = calculateRiskScore(partialScores, followerCountAvailable)

    const subScores: SubScoreMap = {
      BRAND_FIT: brandFit,
      ENGAGEMENT: engagement,
      PSEUDO_ACTIVITY: pseudoActivity,
      RISK: risk,
      GROWTH: growth,
    }

    // 5. 合計スコアを計算
    const total = calculateTotalScore(subScores)

    // 6. スコアレコードとブレークダウンをDBに保存（単一トランザクション）
    const scoreRecord = await this.prisma.scoreRecord.create({
      data: {
        profileId,
        totalScore: total.totalScore,
        confidence: total.confidence,
        dataType: total.status,
        scoringModel: SCORING_MODEL_VERSION,
        breakdowns: {
          create: (
            Object.entries(subScores) as Array<[ScoreCategoryValue, typeof subScores[ScoreCategoryValue]]>
          ).map(([category, sub]) => ({
            category,
            score: sub.score,
            confidence: sub.confidence,
            weight: DEFAULT_WEIGHTS[category],
            rationale: sub.rationale,
            dataType: sub.status,
          })),
        },
      },
      include: {
        breakdowns: { orderBy: { createdAt: 'asc' } },
      },
    })

    this.logger.log(
      `スコア計算が完了しました。profileId=${profileId} totalScore=${total.totalScore}/100 confidence=${total.confidence}`,
    )

    // 7. AI分析結果をDBに保存（失敗してもスコア保存結果に影響しない）
    if (brandFitAnalysisResult !== undefined) {
      try {
        await this.aiAnalysisService.saveAnalysis(
          profileId,
          'BRAND_FIT_COMMENT',
          brandFitAnalysisResult,
        )
      } catch (saveErr) {
        this.logger.warn(
          `AI分析結果のDB保存に失敗しました。スコアは正常に保存済みです。profileId=${profileId} error=${saveErr instanceof Error ? saveErr.message : String(saveErr)}`,
        )
      }
    }

    return mapRecordToResponse(scoreRecord)
  }

  /**
   * 指定プロフィールの最新スコアレコードを返す。存在しない場合は null。
   */
  async findLatest(profileId: string): Promise<ScoreRecordResponse | null> {
    const record = await this.prisma.scoreRecord.findFirst({
      where: { profileId, deletedAt: null },
      orderBy: { scoredAt: 'desc' },
      include: {
        breakdowns: { orderBy: { createdAt: 'asc' } },
      },
    })

    if (!record) return null
    return mapRecordToResponse(record)
  }

  /**
   * スコア履歴を新しい順に返す（デフォルト最大20件）。
   */
  async findHistory(
    profileId: string,
    limit = 20,
  ): Promise<ScoreRecordResponse[]> {
    const records = await this.prisma.scoreRecord.findMany({
      where: { profileId, deletedAt: null },
      orderBy: { scoredAt: 'desc' },
      take: limit,
      include: {
        breakdowns: { orderBy: { createdAt: 'asc' } },
      },
    })

    return records.map(mapRecordToResponse)
  }
}

// ---------------------------------------------------------------------------
// Mappers (module-private)
// ---------------------------------------------------------------------------

/**
 * PrismaのProfileSnapshotレコードをスコア計算用の SnapshotData に変換する。
 */
function mapPrismaSnapshotToData(row: {
  followerCount: number | null
  followerCountStatus: string
  followingCount: number | null
  followingCountStatus: string
  engagementRate: number | null
  engagementRateStatus: string
  avgLikesPerPost: number | null
  avgLikesPerPostStatus: string
  avgCommentsPerPost: number | null
  avgCommentsPerPostStatus: string
  mediaCount: number | null
  mediaCountStatus: string
  fetchedAt: Date
}): SnapshotData {
  return {
    followerCount: row.followerCount,
    followerCountStatus: coerceStatus(row.followerCountStatus),
    followingCount: row.followingCount,
    followingCountStatus: coerceStatus(row.followingCountStatus),
    engagementRate: row.engagementRate,
    engagementRateStatus: coerceStatus(row.engagementRateStatus),
    avgLikesPerPost: row.avgLikesPerPost,
    avgLikesPerPostStatus: coerceStatus(row.avgLikesPerPostStatus),
    avgCommentsPerPost: row.avgCommentsPerPost,
    avgCommentsPerPostStatus: coerceStatus(row.avgCommentsPerPostStatus),
    mediaCount: row.mediaCount,
    mediaCountStatus: coerceStatus(row.mediaCountStatus),
    fetchedAt: row.fetchedAt,
  }
}

function coerceStatus(
  value: string,
): 'FACT' | 'ESTIMATED' | 'UNAVAILABLE' {
  if (value === 'FACT' || value === 'ESTIMATED' || value === 'UNAVAILABLE') {
    return value
  }
  return 'UNAVAILABLE'
}

/**
 * プロフィールとスナップショットから AI分析用の入力型を構築する。
 * biography 等のテキストフィールドはプロンプト内で <user_input> タグで囲む。
 */
function buildAnalysisProfileInput(
  profile: { username: string; platform: string },
  snapshot: SnapshotData,
): AnalysisProfileInput {
  return {
    username: profile.username,
    platform: profile.platform,
    followerCount: snapshot.followerCount,
    followerCountStatus: snapshot.followerCountStatus,
    followingCount: snapshot.followingCount,
    engagementRate: snapshot.engagementRate,
    engagementRateStatus: snapshot.engagementRateStatus,
    biography: null,
    accountType: null,
  }
}

/**
 * Prisma ScoreRecord（ブレークダウン含む）を API レスポンス形式に変換する。
 */
function mapRecordToResponse(record: {
  id: string
  profileId: string
  totalScore: number
  confidence: string
  dataType: string
  scoringModel: string
  scoredAt: Date
  breakdowns: Array<{
    category: string
    score: number
    weight: number
    confidence: string
    dataType: string
    rationale: string | null
  }>
}): ScoreRecordResponse {
  return {
    id: record.id,
    profileId: record.profileId,
    totalScore: record.totalScore,
    confidence: record.confidence,
    dataType: record.dataType,
    scoringModel: record.scoringModel,
    scoredAt: record.scoredAt.toISOString(),
    breakdowns: record.breakdowns.map((b) => ({
      category: b.category,
      score: b.score,
      weight: b.weight,
      confidence: b.confidence,
      status: b.dataType,
      rationale: b.rationale ?? '',
    })),
  }
}
