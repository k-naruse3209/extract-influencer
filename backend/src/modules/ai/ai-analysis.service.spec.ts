import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AiAnalysisService } from './ai-analysis.service'
import { LlmParseException } from './exceptions/llm-parse.exception'
import type { AnalysisProfileInput, BrandFitLlmResponse, RiskLlmResponse } from './types/ai-analysis.types'

// ---------------------------------------------------------------------------
// モックファクトリ
// ---------------------------------------------------------------------------

function buildClaudeClientMock() {
  return {
    generateStructuredOutput: vi.fn(),
    getModel: vi.fn().mockReturnValue('claude-haiku-4-5-20251001'),
  }
}

function buildPrismaMock() {
  return {
    aiAnalysis: {
      create: vi.fn().mockResolvedValue({ id: 'analysis-1' }),
    },
  }
}

// ---------------------------------------------------------------------------
// フィクスチャ
// ---------------------------------------------------------------------------

function makeProfileInput(partial: Partial<AnalysisProfileInput> = {}): AnalysisProfileInput {
  return {
    username: 'test_user',
    platform: 'INSTAGRAM',
    followerCount: 12500,
    followerCountStatus: 'FACT',
    followingCount: 300,
    engagementRate: 0.035,
    engagementRateStatus: 'ESTIMATED',
    biography: '美容系インフルエンサー',
    accountType: 'CREATOR',
    ...partial,
  }
}

function makeBrandFitLlmResponse(partial: Partial<BrandFitLlmResponse> = {}): BrandFitLlmResponse {
  return {
    score: 75,
    confidence: 'medium',
    rationale: 'フォロワー数とエンゲージメント率が基準値を満たしています',
    strengths: ['美容系コンテンツとの親和性が高い'],
    concerns: ['エンゲージメント率は推定値'],
    recommendation: '条件付き推奨',
    ...partial,
  }
}

function makeRiskLlmResponse(partial: Partial<RiskLlmResponse> = {}): RiskLlmResponse {
  return {
    riskScore: 25,
    confidence: 'medium',
    riskFactors: ['エンゲージメント率が推定値のため不確実性あり'],
    positiveFactors: ['エンゲージメント率が平均以上'],
    overallAssessment: '低〜中リスク',
    ...partial,
  }
}

// ---------------------------------------------------------------------------
// テスト
// ---------------------------------------------------------------------------

describe('AiAnalysisService', () => {
  let service: AiAnalysisService
  let claudeClient: ReturnType<typeof buildClaudeClientMock>
  let prisma: ReturnType<typeof buildPrismaMock>

  beforeEach(() => {
    claudeClient = buildClaudeClientMock()
    prisma = buildPrismaMock()
    service = new AiAnalysisService(prisma as never, claudeClient as never)
  })

  // -------------------------------------------------------------------------
  // analyzeBrandFit
  // -------------------------------------------------------------------------

  describe('analyzeBrandFit', () => {
    it('LLMが有効なレスポンスを返したとき、スコアと信頼度を正しく変換して返す', async () => {
      claudeClient.generateStructuredOutput.mockResolvedValueOnce(
        makeBrandFitLlmResponse({ score: 75, confidence: 'medium' }),
      )

      const result = await service.analyzeBrandFit(makeProfileInput())

      expect(result.score).toBe(75)
      expect(result.confidence).toBe('MEDIUM')
      expect(result.promptVersion).toBe('v1.1.0')
      expect(result.model).toBe('claude-haiku-4-5-20251001')
      expect(result.strengths).toHaveLength(1)
      expect(result.concerns).toHaveLength(1)
      expect(result.recommendation).toBe('条件付き推奨')
    })

    it('LLM confidenceが "low" のとき "LOW" に変換する', async () => {
      claudeClient.generateStructuredOutput.mockResolvedValueOnce(
        makeBrandFitLlmResponse({ confidence: 'low' }),
      )

      const result = await service.analyzeBrandFit(makeProfileInput())

      expect(result.confidence).toBe('LOW')
    })

    it('LLM confidenceが "high" のとき "HIGH" に変換する', async () => {
      claudeClient.generateStructuredOutput.mockResolvedValueOnce(
        makeBrandFitLlmResponse({ confidence: 'high' }),
      )

      const result = await service.analyzeBrandFit(makeProfileInput())

      expect(result.confidence).toBe('HIGH')
    })

    it('LLMが未知の confidence を返したとき "LOW" にフォールバックする', async () => {
      claudeClient.generateStructuredOutput.mockResolvedValueOnce(
        makeBrandFitLlmResponse({ confidence: 'unknown_value' }),
      )

      const result = await service.analyzeBrandFit(makeProfileInput())

      expect(result.confidence).toBe('LOW')
    })

    it('スコアが100を超えているとき100にclampする', async () => {
      claudeClient.generateStructuredOutput.mockResolvedValueOnce(
        makeBrandFitLlmResponse({ score: 150 }),
      )

      const result = await service.analyzeBrandFit(makeProfileInput())

      expect(result.score).toBe(100)
    })

    it('スコアが0未満のとき0にclampする', async () => {
      claudeClient.generateStructuredOutput.mockResolvedValueOnce(
        makeBrandFitLlmResponse({ score: -10 }),
      )

      const result = await service.analyzeBrandFit(makeProfileInput())

      expect(result.score).toBe(0)
    })

    it('LLMがJSONパース失敗（LlmParseException）を投げたとき、そのまま伝播する', async () => {
      claudeClient.generateStructuredOutput.mockRejectedValueOnce(
        new LlmParseException('テスト用パース失敗'),
      )

      await expect(service.analyzeBrandFit(makeProfileInput())).rejects.toThrow(
        LlmParseException,
      )
    })

    it('strengths/concerns が配列でない場合は空配列にフォールバックする', async () => {
      claudeClient.generateStructuredOutput.mockResolvedValueOnce({
        score: 50,
        confidence: 'low',
        rationale: 'テスト',
        strengths: null,
        concerns: 'not-an-array',
        recommendation: '推奨しない',
      })

      const result = await service.analyzeBrandFit(makeProfileInput())

      expect(result.strengths).toEqual([])
      expect(result.concerns).toEqual([])
    })
  })

  // -------------------------------------------------------------------------
  // analyzeRisk
  // -------------------------------------------------------------------------

  describe('analyzeRisk', () => {
    it('LLMが有効なレスポンスを返したとき、リスクスコアと信頼度を正しく変換して返す', async () => {
      claudeClient.generateStructuredOutput.mockResolvedValueOnce(
        makeRiskLlmResponse({ riskScore: 30, confidence: 'medium' }),
      )

      const result = await service.analyzeRisk(makeProfileInput())

      expect(result.riskScore).toBe(30)
      expect(result.confidence).toBe('MEDIUM')
      expect(result.promptVersion).toBe('v1.1.0')
      expect(result.model).toBe('claude-haiku-4-5-20251001')
      expect(result.riskFactors).toHaveLength(1)
      expect(result.positiveFactors).toHaveLength(1)
      expect(result.overallAssessment).toBe('低〜中リスク')
    })

    it('riskScoreが100を超えているとき100にclampする', async () => {
      claudeClient.generateStructuredOutput.mockResolvedValueOnce(
        makeRiskLlmResponse({ riskScore: 120 }),
      )

      const result = await service.analyzeRisk(makeProfileInput())

      expect(result.riskScore).toBe(100)
    })

    it('riskScoreが0未満のとき0にclampする', async () => {
      claudeClient.generateStructuredOutput.mockResolvedValueOnce(
        makeRiskLlmResponse({ riskScore: -5 }),
      )

      const result = await service.analyzeRisk(makeProfileInput())

      expect(result.riskScore).toBe(0)
    })

    it('LllmParseException が投げられたとき伝播する', async () => {
      claudeClient.generateStructuredOutput.mockRejectedValueOnce(
        new LlmParseException('リスク分析パース失敗'),
      )

      await expect(service.analyzeRisk(makeProfileInput())).rejects.toThrow(
        LlmParseException,
      )
    })
  })

  // -------------------------------------------------------------------------
  // saveAnalysis
  // -------------------------------------------------------------------------

  describe('saveAnalysis', () => {
    it('正常にDBに保存し、dataType=ESTIMATEDを設定する', async () => {
      const brandFitResult = {
        score: 75,
        confidence: 'MEDIUM' as const,
        rationale: 'テスト',
        strengths: [],
        concerns: [],
        recommendation: '推奨',
        promptVersion: 'v1.0.0',
        model: 'claude-haiku-4-5-20251001',
      }

      await service.saveAnalysis('profile-1', 'BRAND_FIT_COMMENT', brandFitResult)

      expect(prisma.aiAnalysis.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            profileId: 'profile-1',
            analysisType: 'BRAND_FIT_COMMENT',
            dataType: 'ESTIMATED',
            llmModel: 'claude-haiku-4-5-20251001',
            promptVersion: 'v1.0.0',
            confidence: 'MEDIUM',
          }),
        }),
      )
    })

    it('DB保存に失敗したとき例外が伝播する', async () => {
      prisma.aiAnalysis.create.mockRejectedValueOnce(new Error('DB接続エラー'))

      await expect(
        service.saveAnalysis('profile-1', 'BRAND_FIT_COMMENT', {
          score: 50,
          confidence: 'LOW',
          rationale: '',
          strengths: [],
          concerns: [],
          recommendation: '',
          promptVersion: 'v1.0.0',
          model: 'claude-haiku-4-5-20251001',
        }),
      ).rejects.toThrow('DB接続エラー')
    })
  })
})
