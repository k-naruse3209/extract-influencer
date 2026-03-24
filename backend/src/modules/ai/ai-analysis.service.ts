import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../common/prisma/prisma.service'
import { ClaudeApiClient } from './claude-api.client'
import { LlmParseException } from './exceptions/llm-parse.exception'
import {
  BRAND_FIT_SYSTEM_PROMPT,
  BRAND_FIT_PROMPT_VERSION,
  buildBrandFitPrompt,
} from './prompts/brand-fit.prompt'
import {
  RISK_SYSTEM_PROMPT,
  RISK_PROMPT_VERSION,
  buildRiskPrompt,
} from './prompts/risk.prompt'
import { PromptSanitizer } from './prompt-sanitizer'
import type {
  AnalysisProfileInput,
  AnalysisResultBase,
  AnalysisType,
  BrandFitAnalysisResult,
  BrandFitLlmResponse,
  RiskAnalysisResult,
  RiskLlmResponse,
} from './types/ai-analysis.types'
import { clamp } from '../score/calculators/clamp'

/** LLM confidence文字列を内部ConfidenceLevelに変換するマッピング */
const CONFIDENCE_MAP: Record<string, 'LOW' | 'MEDIUM' | 'HIGH'> = {
  low: 'LOW',
  medium: 'MEDIUM',
  high: 'HIGH',
}

/**
 * AI分析サービス。
 *
 * ブランド適合コメントとリスクコメントをClaude APIで生成し、
 * 生成結果をDBに保存する。
 *
 * 設計上の制約:
 * - LLM出力は常に dataType: "ESTIMATED" として扱う（断定禁止）
 * - スコアは必ず0〜100にclampする
 * - LLMのパース失敗はこのサービスの呼び出し元が fallback する
 *   （LlmParseException をそのまま伝播させる）
 * - ANTHROPIC_API_KEY はログに出力しない
 */
@Injectable()
export class AiAnalysisService {
  private readonly logger = new Logger(AiAnalysisService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly claudeClient: ClaudeApiClient,
  ) {}

  /**
   * ブランド適合スコアとコメントをLLMで生成する。
   *
   * @param profile 分析対象プロフィール（事実・推定データを含む）
   * @param brandContext ブランド情報（省略可）
   * @returns スコア・信頼度・根拠・推奨コメント
   * @throws LlmParseException JSONパースに2回失敗した場合
   */
  async analyzeBrandFit(
    profile: AnalysisProfileInput,
    brandContext?: string,
  ): Promise<BrandFitAnalysisResult> {
    const sanitizedProfile: AnalysisProfileInput = {
      ...profile,
      biography: PromptSanitizer.sanitize(profile.biography),
    }
    const sanitizedBrandContext = brandContext !== undefined
      ? PromptSanitizer.sanitize(brandContext)
      : undefined

    const userPrompt = buildBrandFitPrompt(sanitizedProfile, sanitizedBrandContext)
    const model = this.claudeClient.getModel()

    this.logger.log(
      `ブランド適合分析を開始します。username=${profile.username} promptVersion=${BRAND_FIT_PROMPT_VERSION}`,
    )

    const raw = await this.claudeClient.generateStructuredOutput<BrandFitLlmResponse>(
      BRAND_FIT_SYSTEM_PROMPT,
      userPrompt,
    )

    const confidence = this.parseConfidence(raw.confidence)
    const score = clamp(Math.round(raw.score), 0, 100)

    this.logger.log(
      `ブランド適合分析が完了しました。username=${profile.username} score=${score} confidence=${confidence}`,
    )

    return {
      score,
      confidence,
      rationale: raw.rationale ?? '',
      strengths: Array.isArray(raw.strengths) ? raw.strengths : [],
      concerns: Array.isArray(raw.concerns) ? raw.concerns : [],
      recommendation: raw.recommendation ?? '',
      promptVersion: BRAND_FIT_PROMPT_VERSION,
      model,
    }
  }

  /**
   * リスクスコアとコメントをLLMで生成する。
   *
   * @param profile 分析対象プロフィール
   * @returns リスクスコア・信頼度・リスク要因・ポジティブ要因
   * @throws LlmParseException JSONパースに2回失敗した場合
   */
  async analyzeRisk(
    profile: AnalysisProfileInput,
  ): Promise<RiskAnalysisResult> {
    const sanitizedProfile: AnalysisProfileInput = {
      ...profile,
      biography: PromptSanitizer.sanitize(profile.biography),
    }

    const userPrompt = buildRiskPrompt(sanitizedProfile)
    const model = this.claudeClient.getModel()

    this.logger.log(
      `リスク分析を開始します。username=${profile.username} promptVersion=${RISK_PROMPT_VERSION}`,
    )

    const raw = await this.claudeClient.generateStructuredOutput<RiskLlmResponse>(
      RISK_SYSTEM_PROMPT,
      userPrompt,
    )

    const confidence = this.parseConfidence(raw.confidence)
    const riskScore = clamp(Math.round(raw.riskScore), 0, 100)

    this.logger.log(
      `リスク分析が完了しました。username=${profile.username} riskScore=${riskScore} confidence=${confidence}`,
    )

    return {
      riskScore,
      confidence,
      riskFactors: Array.isArray(raw.riskFactors) ? raw.riskFactors : [],
      positiveFactors: Array.isArray(raw.positiveFactors) ? raw.positiveFactors : [],
      overallAssessment: raw.overallAssessment ?? '',
      promptVersion: RISK_PROMPT_VERSION,
      model,
    }
  }

  /**
   * LLM生成結果をDBに保存する。
   *
   * LLM出力は常に dataType: ESTIMATED として保存する（断定禁止の原則）。
   * 保存失敗はスコアリングパイプラインをブロックしないため、
   * 上位層でのエラーハンドリングを推奨する。
   *
   * @param profileId プロフィールID
   * @param type 分析タイプ（BRAND_FIT_COMMENT / RISK_COMMENT 等）
   * @param result 分析結果（AnalysisResultBaseを実装している型）
   */
  async saveAnalysis(
    profileId: string,
    type: AnalysisType,
    result: AnalysisResultBase & { score?: number; riskScore?: number; rationale?: string; overallAssessment?: string },
  ): Promise<void> {
    const content = JSON.stringify(result)

    await this.prisma.aiAnalysis.create({
      data: {
        profileId,
        analysisType: type,
        content,
        llmModel: result.model,
        promptVersion: result.promptVersion,
        confidence: result.confidence,
        dataType: 'ESTIMATED',
      },
    })

    this.logger.log(
      `AI分析結果をDBに保存しました。profileId=${profileId} type=${type} model=${result.model}`,
    )
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * LLMが返す confidence 文字列（"low"/"medium"/"high"）を
   * 内部形式（"LOW"/"MEDIUM"/"HIGH"）に変換する。
   *
   * 未知の値は LOW にフォールバックする（安全側）。
   */
  private parseConfidence(raw: string): 'LOW' | 'MEDIUM' | 'HIGH' {
    return CONFIDENCE_MAP[raw?.toLowerCase()] ?? 'LOW'
  }
}

export { LlmParseException }
