import { describe, it, expect } from 'vitest'
import { calculateBrandFitScore } from './brand-fit.calculator'

describe('calculateBrandFitScore', () => {
  // -------------------------------------------------------------------------
  // フォールバック（LLMスコアなし）
  // -------------------------------------------------------------------------

  describe('llmResultなし（フォールバック）', () => {
    it('引数なしのとき50を返す', () => {
      const result = calculateBrandFitScore()
      expect(result.score).toBe(50)
    })

    it('引数なしのとき LOW confidence を返す', () => {
      const result = calculateBrandFitScore()
      expect(result.confidence).toBe('LOW')
    })

    it('引数なしのとき ESTIMATED status を返す', () => {
      const result = calculateBrandFitScore()
      expect(result.status).toBe('ESTIMATED')
    })

    it('フォールバックであることを rationale に含める', () => {
      const result = calculateBrandFitScore()
      expect(result.rationale.toLowerCase()).toMatch(/fallback|フォールバック/i)
    })

    it('スコアは0〜100の範囲内（フォールバック）', () => {
      const result = calculateBrandFitScore()
      expect(result.score).toBeGreaterThanOrEqual(0)
      expect(result.score).toBeLessThanOrEqual(100)
    })

    it('undefined を明示的に渡したときもフォールバックを返す', () => {
      const result = calculateBrandFitScore(undefined)
      expect(result.score).toBe(50)
      expect(result.confidence).toBe('LOW')
    })
  })

  // -------------------------------------------------------------------------
  // LLMスコアあり
  // -------------------------------------------------------------------------

  describe('llmResultあり', () => {
    it('LLMスコア75・MEDIUM confidence を正しく返す', () => {
      const result = calculateBrandFitScore({ score: 75, confidence: 'MEDIUM' })
      expect(result.score).toBe(75)
      expect(result.confidence).toBe('MEDIUM')
    })

    it('LLMスコア90・HIGH confidence を正しく返す', () => {
      const result = calculateBrandFitScore({ score: 90, confidence: 'HIGH' })
      expect(result.score).toBe(90)
      expect(result.confidence).toBe('HIGH')
    })

    it('LLMスコア30・LOW confidence を正しく返す', () => {
      const result = calculateBrandFitScore({ score: 30, confidence: 'LOW' })
      expect(result.score).toBe(30)
      expect(result.confidence).toBe('LOW')
    })

    it('LLMスコアがある場合は status が ESTIMATED になる', () => {
      const result = calculateBrandFitScore({ score: 80, confidence: 'HIGH' })
      expect(result.status).toBe('ESTIMATED')
    })

    it('スコアが小数のとき整数にroundする', () => {
      const result = calculateBrandFitScore({ score: 74.6, confidence: 'MEDIUM' })
      expect(result.score).toBe(75)
    })

    it('スコアが100を超えているとき100にclampする', () => {
      const result = calculateBrandFitScore({ score: 150, confidence: 'HIGH' })
      expect(result.score).toBe(100)
    })

    it('スコアが0未満のとき0にclampする', () => {
      const result = calculateBrandFitScore({ score: -20, confidence: 'LOW' })
      expect(result.score).toBe(0)
    })

    it('スコアが0のとき0を返す（境界値）', () => {
      const result = calculateBrandFitScore({ score: 0, confidence: 'LOW' })
      expect(result.score).toBe(0)
    })

    it('スコアが100のとき100を返す（境界値）', () => {
      const result = calculateBrandFitScore({ score: 100, confidence: 'HIGH' })
      expect(result.score).toBe(100)
    })

    it('rationalに LLM評価であることと推定値であることを含める', () => {
      const result = calculateBrandFitScore({ score: 75, confidence: 'MEDIUM' })
      expect(result.rationale).toContain('LLM')
      expect(result.rationale).toMatch(/推定|estimated/i)
    })
  })
})
