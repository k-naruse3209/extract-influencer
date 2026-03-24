import { describe, it, expect } from 'vitest'
import { calculatePseudoActivityScore } from './pseudo-activity.calculator'
import type { SnapshotData } from '../types/score.types'

// ---------------------------------------------------------------------------
// Fixture factory
// ---------------------------------------------------------------------------

function makeSnapshot(
  overrides: Partial<SnapshotData> = {},
): SnapshotData {
  return {
    followerCount: 50_000,
    followerCountStatus: 'FACT',
    followingCount: 500,
    followingCountStatus: 'FACT',
    engagementRate: 0.03,
    engagementRateStatus: 'FACT',
    avgLikesPerPost: 1500,
    avgLikesPerPostStatus: 'FACT',
    avgCommentsPerPost: 50,
    avgCommentsPerPostStatus: 'FACT',
    mediaCount: 200,
    mediaCountStatus: 'FACT',
    fetchedAt: new Date('2024-06-01T00:00:00Z'),
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('calculatePseudoActivityScore', () => {
  describe('score ranges', () => {
    it('returns 80-100 for ratio <= 0.1 with followerCount >= 10000', () => {
      // followingCount=500, followerCount=50000 -> ratio=0.01
      const result = calculatePseudoActivityScore(makeSnapshot())
      expect(result.score).toBeGreaterThanOrEqual(80)
      expect(result.score).toBeLessThanOrEqual(100)
    })

    it('returns 60-79 for ratio <= 0.3', () => {
      // ratio = 2000/10000 = 0.2
      const result = calculatePseudoActivityScore(
        makeSnapshot({ followingCount: 2000, followerCount: 10_000 }),
      )
      expect(result.score).toBeGreaterThanOrEqual(60)
      expect(result.score).toBeLessThanOrEqual(79)
    })

    it('returns 40-59 for ratio <= 1.0', () => {
      // ratio = 5000/10000 = 0.5
      const result = calculatePseudoActivityScore(
        makeSnapshot({ followingCount: 5000, followerCount: 10_000 }),
      )
      expect(result.score).toBeGreaterThanOrEqual(40)
      expect(result.score).toBeLessThanOrEqual(59)
    })

    it('returns 0-39 for ratio > 1.0', () => {
      // ratio = 15000/10000 = 1.5
      const result = calculatePseudoActivityScore(
        makeSnapshot({ followingCount: 15_000, followerCount: 10_000 }),
      )
      expect(result.score).toBeGreaterThanOrEqual(0)
      expect(result.score).toBeLessThanOrEqual(39)
    })
  })

  describe('small accounts', () => {
    it('does not assign 80-100 tier even with low ratio when followerCount < 10000', () => {
      // ratio = 50/5000 = 0.01, but followers < 10000 -> tier 60-79
      const result = calculatePseudoActivityScore(
        makeSnapshot({ followingCount: 50, followerCount: 5000 }),
      )
      expect(result.score).toBeGreaterThanOrEqual(60)
      expect(result.score).toBeLessThanOrEqual(79)
    })
  })

  describe('unavailable data', () => {
    it('returns UNAVAILABLE when followerCount is null', () => {
      const result = calculatePseudoActivityScore(
        makeSnapshot({ followerCount: null }),
      )
      expect(result.status).toBe('UNAVAILABLE')
      expect(result.confidence).toBe('LOW')
      expect(result.score).toBe(0)
    })

    it('returns UNAVAILABLE when followingCount is null', () => {
      const result = calculatePseudoActivityScore(
        makeSnapshot({ followingCount: null }),
      )
      expect(result.status).toBe('UNAVAILABLE')
      expect(result.confidence).toBe('LOW')
    })

    it('returns UNAVAILABLE when followerCount is 0', () => {
      const result = calculatePseudoActivityScore(
        makeSnapshot({ followerCount: 0 }),
      )
      expect(result.status).toBe('UNAVAILABLE')
    })

    it('returns UNAVAILABLE when followerCount is negative', () => {
      const result = calculatePseudoActivityScore(
        makeSnapshot({ followerCount: -100 }),
      )
      expect(result.status).toBe('UNAVAILABLE')
    })
  })

  describe('confidence derivation', () => {
    it('returns HIGH when both follower and following are FACT', () => {
      const result = calculatePseudoActivityScore(makeSnapshot())
      expect(result.confidence).toBe('HIGH')
    })

    it('returns MEDIUM when followerCount is ESTIMATED', () => {
      const result = calculatePseudoActivityScore(
        makeSnapshot({ followerCountStatus: 'ESTIMATED' }),
      )
      expect(result.confidence).toBe('MEDIUM')
    })
  })

  describe('rationale', () => {
    it('includes the ratio in the rationale text', () => {
      const result = calculatePseudoActivityScore(makeSnapshot())
      expect(result.rationale).toContain('ratio')
    })
  })

  describe('score range invariant', () => {
    it('always returns score between 0 and 100', () => {
      const cases = [
        { followingCount: 0, followerCount: 100_000 },
        { followingCount: 1, followerCount: 100_000 },
        { followingCount: 100_000, followerCount: 100_000 },
        { followingCount: 500_000, followerCount: 100_000 },
      ]
      for (const c of cases) {
        const result = calculatePseudoActivityScore(makeSnapshot(c))
        expect(result.score).toBeGreaterThanOrEqual(0)
        expect(result.score).toBeLessThanOrEqual(100)
      }
    })
  })
})
