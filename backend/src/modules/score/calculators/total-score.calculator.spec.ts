import { describe, it, expect } from 'vitest'
import {
  calculateTotalScore,
  DEFAULT_WEIGHTS,
} from './total-score.calculator'
import type { SubScoreMap, SubScoreResult } from '../types/score.types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSub(overrides: Partial<SubScoreResult> = {}): SubScoreResult {
  return {
    score: 50,
    confidence: 'MEDIUM',
    status: 'ESTIMATED',
    rationale: 'test',
    ...overrides,
  }
}

function makeSubScores(
  overrides: Partial<Record<keyof SubScoreMap, Partial<SubScoreResult>>> = {},
): SubScoreMap {
  return {
    BRAND_FIT: makeSub(overrides.BRAND_FIT),
    ENGAGEMENT: makeSub(overrides.ENGAGEMENT),
    PSEUDO_ACTIVITY: makeSub(overrides.PSEUDO_ACTIVITY),
    RISK: makeSub(overrides.RISK),
    GROWTH: makeSub(overrides.GROWTH),
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('calculateTotalScore', () => {
  describe('weighted aggregation', () => {
    it('returns 50 when all sub-scores are 50', () => {
      const result = calculateTotalScore(makeSubScores())
      expect(result.totalScore).toBe(50)
    })

    it('returns 100 when all sub-scores are 100', () => {
      const subScores = makeSubScores({
        BRAND_FIT: { score: 100 },
        ENGAGEMENT: { score: 100 },
        PSEUDO_ACTIVITY: { score: 100 },
        RISK: { score: 100 },
        GROWTH: { score: 100 },
      })
      const result = calculateTotalScore(subScores)
      expect(result.totalScore).toBe(100)
    })

    it('returns 0 when all sub-scores are 0', () => {
      const subScores = makeSubScores({
        BRAND_FIT: { score: 0 },
        ENGAGEMENT: { score: 0 },
        PSEUDO_ACTIVITY: { score: 0 },
        RISK: { score: 0 },
        GROWTH: { score: 0 },
      })
      const result = calculateTotalScore(subScores)
      expect(result.totalScore).toBe(0)
    })

    it('correctly applies weights', () => {
      const subScores = makeSubScores({
        BRAND_FIT: { score: 100 },      // 100 * 0.3 = 30
        ENGAGEMENT: { score: 80 },      // 80 * 0.25 = 20
        PSEUDO_ACTIVITY: { score: 60 }, // 60 * 0.25 = 15
        RISK: { score: 40 },            // 40 * 0.1 = 4
        GROWTH: { score: 20 },          // 20 * 0.1 = 2
      })
      const result = calculateTotalScore(subScores)
      // 30 + 20 + 15 + 4 + 2 = 71
      expect(result.totalScore).toBe(71)
    })
  })

  describe('weights sum to 1.0', () => {
    it('DEFAULT_WEIGHTS sum to 1.0', () => {
      const sum = Object.values(DEFAULT_WEIGHTS).reduce((a, b) => a + b, 0)
      expect(sum).toBeCloseTo(1.0, 10)
    })
  })

  describe('overall confidence', () => {
    it('returns HIGH when both ENGAGEMENT and PSEUDO_ACTIVITY are FACT', () => {
      const subScores = makeSubScores({
        ENGAGEMENT: { status: 'FACT' },
        PSEUDO_ACTIVITY: { status: 'FACT' },
      })
      const result = calculateTotalScore(subScores)
      expect(result.confidence).toBe('HIGH')
    })

    it('returns MEDIUM when one of ENGAGEMENT/PSEUDO_ACTIVITY is ESTIMATED', () => {
      const subScores = makeSubScores({
        ENGAGEMENT: { status: 'FACT' },
        PSEUDO_ACTIVITY: { status: 'ESTIMATED' },
      })
      const result = calculateTotalScore(subScores)
      expect(result.confidence).toBe('MEDIUM')
    })

    it('returns LOW when ENGAGEMENT is UNAVAILABLE', () => {
      const subScores = makeSubScores({
        ENGAGEMENT: { status: 'UNAVAILABLE' },
        PSEUDO_ACTIVITY: { status: 'FACT' },
      })
      const result = calculateTotalScore(subScores)
      expect(result.confidence).toBe('LOW')
    })

    it('returns LOW when PSEUDO_ACTIVITY is UNAVAILABLE', () => {
      const subScores = makeSubScores({
        ENGAGEMENT: { status: 'FACT' },
        PSEUDO_ACTIVITY: { status: 'UNAVAILABLE' },
      })
      const result = calculateTotalScore(subScores)
      expect(result.confidence).toBe('LOW')
    })
  })

  describe('overall status', () => {
    it('returns ESTIMATED when any sub-score is UNAVAILABLE', () => {
      const subScores = makeSubScores({
        GROWTH: { status: 'UNAVAILABLE' },
      })
      const result = calculateTotalScore(subScores)
      expect(result.status).toBe('ESTIMATED')
    })

    it('returns FACT when all sub-scores are FACT', () => {
      const subScores = makeSubScores({
        BRAND_FIT: { status: 'FACT' },
        ENGAGEMENT: { status: 'FACT' },
        PSEUDO_ACTIVITY: { status: 'FACT' },
        RISK: { status: 'FACT' },
        GROWTH: { status: 'FACT' },
      })
      const result = calculateTotalScore(subScores)
      expect(result.status).toBe('FACT')
    })
  })

  describe('totalScore clamping', () => {
    it('totalScore is always between 0 and 100', () => {
      const result = calculateTotalScore(makeSubScores())
      expect(result.totalScore).toBeGreaterThanOrEqual(0)
      expect(result.totalScore).toBeLessThanOrEqual(100)
    })
  })
})
