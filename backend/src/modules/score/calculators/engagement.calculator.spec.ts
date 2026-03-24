import { describe, it, expect } from 'vitest'
import { calculateEngagementScore } from './engagement.calculator'
import type { SnapshotData } from '../types/score.types'

// ---------------------------------------------------------------------------
// Fixture factory
// ---------------------------------------------------------------------------

function makeSnapshot(
  overrides: Partial<SnapshotData> = {},
): SnapshotData {
  return {
    followerCount: 10_000,
    followerCountStatus: 'FACT',
    followingCount: 500,
    followingCountStatus: 'FACT',
    engagementRate: null,
    engagementRateStatus: 'ESTIMATED',
    avgLikesPerPost: 300,
    avgLikesPerPostStatus: 'FACT',
    avgCommentsPerPost: 10,
    avgCommentsPerPostStatus: 'FACT',
    mediaCount: 100,
    mediaCountStatus: 'FACT',
    fetchedAt: new Date('2024-06-01T00:00:00Z'),
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('calculateEngagementScore', () => {
  describe('score ranges', () => {
    it('returns 90-100 for engagement rate >= 0.06', () => {
      const result = calculateEngagementScore(
        makeSnapshot({ engagementRate: 0.08, engagementRateStatus: 'FACT' }),
      )
      expect(result.score).toBeGreaterThanOrEqual(90)
      expect(result.score).toBeLessThanOrEqual(100)
    })

    it('returns 70-89 for engagement rate >= 0.03 and < 0.06', () => {
      const result = calculateEngagementScore(
        makeSnapshot({ engagementRate: 0.04, engagementRateStatus: 'FACT' }),
      )
      expect(result.score).toBeGreaterThanOrEqual(70)
      expect(result.score).toBeLessThanOrEqual(89)
    })

    it('returns 50-69 for engagement rate >= 0.01 and < 0.03', () => {
      const result = calculateEngagementScore(
        makeSnapshot({ engagementRate: 0.02, engagementRateStatus: 'FACT' }),
      )
      expect(result.score).toBeGreaterThanOrEqual(50)
      expect(result.score).toBeLessThanOrEqual(69)
    })

    it('returns 30-49 for engagement rate >= 0.005 and < 0.01', () => {
      const result = calculateEngagementScore(
        makeSnapshot({ engagementRate: 0.007, engagementRateStatus: 'FACT' }),
      )
      expect(result.score).toBeGreaterThanOrEqual(30)
      expect(result.score).toBeLessThanOrEqual(49)
    })

    it('returns 0-29 for engagement rate < 0.005', () => {
      const result = calculateEngagementScore(
        makeSnapshot({ engagementRate: 0.002, engagementRateStatus: 'FACT' }),
      )
      expect(result.score).toBeGreaterThanOrEqual(0)
      expect(result.score).toBeLessThanOrEqual(29)
    })
  })

  describe('fallback calculation', () => {
    it('computes rate from avgLikesPerPost / followerCount when engagementRate is null', () => {
      // avgLikesPerPost=600, followerCount=10000 -> rate=0.06 -> score 90+
      const result = calculateEngagementScore(
        makeSnapshot({
          engagementRate: null,
          avgLikesPerPost: 600,
          followerCount: 10_000,
        }),
      )
      expect(result.score).toBeGreaterThanOrEqual(90)
    })
  })

  describe('unavailable data', () => {
    it('returns UNAVAILABLE when both engagementRate and avgLikesPerPost are null', () => {
      const result = calculateEngagementScore(
        makeSnapshot({
          engagementRate: null,
          avgLikesPerPost: null,
        }),
      )
      expect(result.score).toBe(0)
      expect(result.status).toBe('UNAVAILABLE')
      expect(result.confidence).toBe('LOW')
    })

    it('returns UNAVAILABLE when followerCount is 0 and engagementRate is null', () => {
      const result = calculateEngagementScore(
        makeSnapshot({
          engagementRate: null,
          followerCount: 0,
          avgLikesPerPost: 300,
        }),
      )
      expect(result.status).toBe('UNAVAILABLE')
    })

    it('returns UNAVAILABLE when followerCount is null and engagementRate is null', () => {
      const result = calculateEngagementScore(
        makeSnapshot({
          engagementRate: null,
          followerCount: null,
          avgLikesPerPost: 300,
        }),
      )
      expect(result.status).toBe('UNAVAILABLE')
    })
  })

  describe('boundary values', () => {
    it('handles engagement rate of exactly 0', () => {
      const result = calculateEngagementScore(
        makeSnapshot({ engagementRate: 0, engagementRateStatus: 'FACT' }),
      )
      expect(result.score).toBe(0)
      expect(result.score).toBeGreaterThanOrEqual(0)
      expect(result.score).toBeLessThanOrEqual(100)
    })

    it('handles very high engagement rate', () => {
      const result = calculateEngagementScore(
        makeSnapshot({ engagementRate: 0.5, engagementRateStatus: 'FACT' }),
      )
      expect(result.score).toBe(100)
    })
  })

  describe('confidence derivation', () => {
    it('returns HIGH confidence when engagementRate status is FACT', () => {
      const result = calculateEngagementScore(
        makeSnapshot({ engagementRate: 0.03, engagementRateStatus: 'FACT' }),
      )
      expect(result.confidence).toBe('HIGH')
    })

    it('returns HIGH confidence when avgLikes and follower are both FACT', () => {
      const result = calculateEngagementScore(
        makeSnapshot({
          engagementRate: null,
          avgLikesPerPost: 300,
          avgLikesPerPostStatus: 'FACT',
          followerCount: 10_000,
          followerCountStatus: 'FACT',
        }),
      )
      expect(result.confidence).toBe('HIGH')
    })

    it('returns MEDIUM confidence when avgLikes is ESTIMATED', () => {
      const result = calculateEngagementScore(
        makeSnapshot({
          engagementRate: null,
          engagementRateStatus: 'ESTIMATED',
          avgLikesPerPost: 300,
          avgLikesPerPostStatus: 'ESTIMATED',
        }),
      )
      expect(result.confidence).toBe('MEDIUM')
    })
  })

  describe('rationale', () => {
    it('includes engagement rate percentage in rationale', () => {
      const result = calculateEngagementScore(
        makeSnapshot({ engagementRate: 0.04, engagementRateStatus: 'FACT' }),
      )
      expect(result.rationale).toContain('4.00%')
    })
  })

  describe('score range invariant', () => {
    it('always returns score between 0 and 100', () => {
      const rates = [-0.1, 0, 0.001, 0.005, 0.01, 0.03, 0.06, 0.12, 1.0]
      for (const rate of rates) {
        const result = calculateEngagementScore(
          makeSnapshot({ engagementRate: rate, engagementRateStatus: 'FACT' }),
        )
        expect(result.score).toBeGreaterThanOrEqual(0)
        expect(result.score).toBeLessThanOrEqual(100)
      }
    })
  })
})
