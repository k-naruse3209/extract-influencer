import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NotFoundException } from '@nestjs/common'
import { ScoreService } from './score.service'
import { LlmParseException } from '../ai/exceptions/llm-parse.exception'

// ---------------------------------------------------------------------------
// モックファクトリ
// ---------------------------------------------------------------------------

function buildPrismaMock(
  overrides: Record<string, unknown> = {},
) {
  return {
    influencerProfile: {
      findFirst: vi.fn(),
    },
    profileSnapshot: {
      findMany: vi.fn(),
    },
    scoreRecord: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    ...overrides,
  }
}

function buildAiAnalysisServiceMock() {
  return {
    analyzeBrandFit: vi.fn().mockResolvedValue({
      score: 72,
      confidence: 'MEDIUM',
      rationale: 'テスト用ブランド適合分析',
      strengths: ['テスト強み'],
      concerns: ['テスト懸念'],
      recommendation: '条件付き推奨',
      promptVersion: 'v1.0.0',
      model: 'claude-haiku-4-5-20251001',
    }),
    saveAnalysis: vi.fn().mockResolvedValue(undefined),
  }
}

// ---------------------------------------------------------------------------
// フィクスチャ
// ---------------------------------------------------------------------------

function makeSnapshotRow(partial: Partial<{
  id: string
  profileId: string
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
}> = {}) {
  return {
    id: 'snap-1',
    profileId: 'profile-1',
    followerCount: 10_000,
    followerCountStatus: 'FACT',
    followingCount: 500,
    followingCountStatus: 'FACT',
    engagementRate: 0.03,
    engagementRateStatus: 'FACT',
    avgLikesPerPost: 300,
    avgLikesPerPostStatus: 'FACT',
    avgCommentsPerPost: 10,
    avgCommentsPerPostStatus: 'FACT',
    mediaCount: 100,
    mediaCountStatus: 'FACT',
    fetchedAt: new Date('2024-06-01T00:00:00Z'),
    ...partial,
  }
}

function makeScoreRecordRow() {
  return {
    id: 'score-1',
    profileId: 'profile-1',
    totalScore: 65,
    confidence: 'MEDIUM',
    dataType: 'ESTIMATED',
    scoringModel: 'v1.0.0',
    scoredAt: new Date('2024-06-01T12:00:00Z'),
    breakdowns: [
      {
        category: 'ENGAGEMENT',
        score: 70,
        weight: 0.25,
        confidence: 'HIGH',
        dataType: 'FACT',
        rationale: 'Engagement rate 3.00% mapped to score 70/100.',
      },
    ],
  }
}

function makeCreatedScoreRecord() {
  return {
    id: 'score-new',
    profileId: 'profile-1',
    totalScore: 60,
    confidence: 'MEDIUM',
    dataType: 'ESTIMATED',
    scoringModel: 'v1.0.0',
    scoredAt: new Date('2024-06-01T12:00:00Z'),
    breakdowns: [
      {
        category: 'BRAND_FIT',
        score: 72,
        weight: 0.3,
        confidence: 'MEDIUM',
        dataType: 'ESTIMATED',
        rationale: 'LLM評価によるブランド適合スコア',
      },
      {
        category: 'ENGAGEMENT',
        score: 70,
        weight: 0.25,
        confidence: 'HIGH',
        dataType: 'FACT',
        rationale: 'Engagement rate 3.00%',
      },
    ],
  }
}

// ---------------------------------------------------------------------------
// テスト
// ---------------------------------------------------------------------------

describe('ScoreService', () => {
  let service: ScoreService
  let prisma: ReturnType<typeof buildPrismaMock>
  let aiAnalysisService: ReturnType<typeof buildAiAnalysisServiceMock>

  beforeEach(() => {
    prisma = buildPrismaMock()
    aiAnalysisService = buildAiAnalysisServiceMock()
    service = new ScoreService(prisma as never, aiAnalysisService as never)
  })

  describe('calculateAndSave', () => {
    it('プロフィールが存在しないとき NotFoundException を投げる', async () => {
      prisma.influencerProfile.findFirst.mockResolvedValue(null)

      await expect(service.calculateAndSave('non-existent')).rejects.toThrow(
        NotFoundException,
      )
    })

    it('スナップショットがないとき NotFoundException を投げる', async () => {
      prisma.influencerProfile.findFirst.mockResolvedValue({ id: 'profile-1', username: 'test', platform: 'INSTAGRAM' })
      prisma.profileSnapshot.findMany.mockResolvedValue([])

      await expect(service.calculateAndSave('profile-1')).rejects.toThrow(
        NotFoundException,
      )
    })

    it('LLM分析が成功したとき、LLMスコアを使ってスコアレコードを作成する', async () => {
      prisma.influencerProfile.findFirst.mockResolvedValue({
        id: 'profile-1',
        username: 'test_user',
        platform: 'INSTAGRAM',
      })
      prisma.profileSnapshot.findMany.mockResolvedValue([makeSnapshotRow()])
      prisma.scoreRecord.create.mockResolvedValue(makeCreatedScoreRecord())

      const result = await service.calculateAndSave('profile-1')

      expect(result.id).toBe('score-new')
      expect(result.scoringModel).toBe('v1.0.0')
      expect(result.breakdowns.length).toBeGreaterThan(0)
      expect(prisma.scoreRecord.create).toHaveBeenCalledOnce()
      expect(aiAnalysisService.analyzeBrandFit).toHaveBeenCalledOnce()
    })

    it('LLM分析が成功したとき saveAnalysis を呼び出す', async () => {
      prisma.influencerProfile.findFirst.mockResolvedValue({
        id: 'profile-1',
        username: 'test_user',
        platform: 'INSTAGRAM',
      })
      prisma.profileSnapshot.findMany.mockResolvedValue([makeSnapshotRow()])
      prisma.scoreRecord.create.mockResolvedValue(makeCreatedScoreRecord())

      await service.calculateAndSave('profile-1')

      expect(aiAnalysisService.saveAnalysis).toHaveBeenCalledWith(
        'profile-1',
        'BRAND_FIT_COMMENT',
        expect.objectContaining({ promptVersion: 'v1.0.0' }),
      )
    })

    it('LLM分析が LlmParseException を投げたとき、フォールバックで処理を続行してスコアを保存する', async () => {
      aiAnalysisService.analyzeBrandFit.mockRejectedValueOnce(
        new LlmParseException('パース失敗'),
      )
      prisma.influencerProfile.findFirst.mockResolvedValue({
        id: 'profile-1',
        username: 'test_user',
        platform: 'INSTAGRAM',
      })
      prisma.profileSnapshot.findMany.mockResolvedValue([makeSnapshotRow()])
      prisma.scoreRecord.create.mockResolvedValue(makeCreatedScoreRecord())

      const result = await service.calculateAndSave('profile-1')

      expect(result).toBeDefined()
      expect(prisma.scoreRecord.create).toHaveBeenCalledOnce()
      expect(aiAnalysisService.saveAnalysis).not.toHaveBeenCalled()
    })

    it('LLM分析で予期しないエラーが発生したとき、フォールバックで処理を続行する', async () => {
      aiAnalysisService.analyzeBrandFit.mockRejectedValueOnce(
        new Error('ネットワークエラー'),
      )
      prisma.influencerProfile.findFirst.mockResolvedValue({
        id: 'profile-1',
        username: 'test_user',
        platform: 'INSTAGRAM',
      })
      prisma.profileSnapshot.findMany.mockResolvedValue([makeSnapshotRow()])
      prisma.scoreRecord.create.mockResolvedValue(makeCreatedScoreRecord())

      const result = await service.calculateAndSave('profile-1')

      expect(result).toBeDefined()
      expect(prisma.scoreRecord.create).toHaveBeenCalledOnce()
    })

    it('saveAnalysis が失敗してもスコア保存結果は正常に返す', async () => {
      aiAnalysisService.saveAnalysis.mockRejectedValueOnce(new Error('DB保存エラー'))
      prisma.influencerProfile.findFirst.mockResolvedValue({
        id: 'profile-1',
        username: 'test_user',
        platform: 'INSTAGRAM',
      })
      prisma.profileSnapshot.findMany.mockResolvedValue([makeSnapshotRow()])
      prisma.scoreRecord.create.mockResolvedValue(makeCreatedScoreRecord())

      const result = await service.calculateAndSave('profile-1')

      expect(result.id).toBe('score-new')
    })
  })

  describe('findLatest', () => {
    it('スコアが存在しないとき null を返す', async () => {
      prisma.scoreRecord.findFirst.mockResolvedValue(null)

      const result = await service.findLatest('profile-1')
      expect(result).toBeNull()
    })

    it('スコアが存在するとき正しくマップして返す', async () => {
      prisma.scoreRecord.findFirst.mockResolvedValue(makeScoreRecordRow())

      const result = await service.findLatest('profile-1')
      expect(result).not.toBeNull()
      expect(result?.totalScore).toBe(65)
      expect(result?.scoredAt).toBe('2024-06-01T12:00:00.000Z')
    })
  })

  describe('findHistory', () => {
    it('スコアが存在しないとき空配列を返す', async () => {
      prisma.scoreRecord.findMany.mockResolvedValue([])

      const result = await service.findHistory('profile-1')
      expect(result).toEqual([])
    })

    it('指定した limit でクエリを実行する', async () => {
      prisma.scoreRecord.findMany.mockResolvedValue([makeScoreRecordRow()])

      const result = await service.findHistory('profile-1', 5)
      expect(result).toHaveLength(1)
      expect(prisma.scoreRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5 }),
      )
    })
  })
})
