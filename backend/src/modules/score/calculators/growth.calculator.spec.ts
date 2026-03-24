import { describe, it, expect } from 'vitest'
import { calculateGrowthScore } from './growth.calculator'
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
    engagementRate: 0.03,
    engagementRateStatus: 'FACT',
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

describe('calculateGrowthScore', () => {
  describe('single snapshot', () => {
    it('returns neutral 50 with UNAVAILABLE when only one snapshot exists', () => {
      const result = calculateGrowthScore([makeSnapshot()])
      expect(result.score).toBe(50)
      expect(result.status).toBe('UNAVAILABLE')
      expect(result.confidence).toBe('LOW')
    })

    it('returns neutral 50 with UNAVAILABLE for empty array', () => {
      const result = calculateGrowthScore([])
      expect(result.score).toBe(50)
      expect(result.status).toBe('UNAVAILABLE')
    })
  })

  describe('rapid growth (> 10%/month)', () => {
    it('returns 80-100 for rapid growth', () => {
      const older = makeSnapshot({
        followerCount: 10_000,
        fetchedAt: new Date('2024-01-01T00:00:00Z'),
      })
      // After 2 months, 15000 followers -> rawGrowth=0.5, monthlyRate=0.25
      const newer = makeSnapshot({
        followerCount: 15_000,
        fetchedAt: new Date('2024-03-01T00:00:00Z'),
      })
      const result = calculateGrowthScore([older, newer])
      expect(result.score).toBeGreaterThanOrEqual(80)
      expect(result.score).toBeLessThanOrEqual(100)
    })
  })

  describe('steady growth (5-10%/month)', () => {
    it('returns 60-79 for steady growth', () => {
      const older = makeSnapshot({
        followerCount: 10_000,
        fetchedAt: new Date('2024-01-01T00:00:00Z'),
      })
      // After ~2 months, 11500 -> rawGrowth=0.15, monthlyRate~0.075
      const newer = makeSnapshot({
        followerCount: 11_500,
        fetchedAt: new Date('2024-03-01T00:00:00Z'),
      })
      const result = calculateGrowthScore([older, newer])
      expect(result.score).toBeGreaterThanOrEqual(60)
      expect(result.score).toBeLessThanOrEqual(79)
    })
  })

  describe('stable / stagnant (0-5%/month)', () => {
    it('returns 40-59 for stable growth', () => {
      const older = makeSnapshot({
        followerCount: 10_000,
        fetchedAt: new Date('2024-01-01T00:00:00Z'),
      })
      // After 2 months, 10200 -> rawGrowth=0.02, monthlyRate~0.01
      const newer = makeSnapshot({
        followerCount: 10_200,
        fetchedAt: new Date('2024-03-01T00:00:00Z'),
      })
      const result = calculateGrowthScore([older, newer])
      expect(result.score).toBeGreaterThanOrEqual(40)
      expect(result.score).toBeLessThanOrEqual(59)
    })
  })

  describe('declining (negative growth)', () => {
    it('returns 20-39 for negative growth', () => {
      const older = makeSnapshot({
        followerCount: 10_000,
        fetchedAt: new Date('2024-01-01T00:00:00Z'),
      })
      const newer = makeSnapshot({
        followerCount: 9_000,
        fetchedAt: new Date('2024-03-01T00:00:00Z'),
      })
      const result = calculateGrowthScore([older, newer])
      expect(result.score).toBeGreaterThanOrEqual(20)
      expect(result.score).toBeLessThanOrEqual(39)
    })
  })

  describe('missing follower data', () => {
    it('returns UNAVAILABLE when older snapshot has null followerCount', () => {
      const older = makeSnapshot({
        followerCount: null,
        fetchedAt: new Date('2024-01-01T00:00:00Z'),
      })
      const newer = makeSnapshot({
        followerCount: 10_000,
        fetchedAt: new Date('2024-03-01T00:00:00Z'),
      })
      const result = calculateGrowthScore([older, newer])
      expect(result.status).toBe('UNAVAILABLE')
      expect(result.score).toBe(50)
    })

    it('returns UNAVAILABLE when newer snapshot has null followerCount', () => {
      const older = makeSnapshot({
        followerCount: 10_000,
        fetchedAt: new Date('2024-01-01T00:00:00Z'),
      })
      const newer = makeSnapshot({
        followerCount: null,
        fetchedAt: new Date('2024-03-01T00:00:00Z'),
      })
      const result = calculateGrowthScore([older, newer])
      expect(result.status).toBe('UNAVAILABLE')
    })
  })

  describe('same timestamp snapshots', () => {
    it('returns neutral 50 when snapshots have the same fetchedAt', () => {
      const ts = new Date('2024-06-01T00:00:00Z')
      const result = calculateGrowthScore([
        makeSnapshot({ fetchedAt: ts }),
        makeSnapshot({ fetchedAt: ts }),
      ])
      expect(result.score).toBe(50)
    })
  })

  describe('confidence', () => {
    it('returns HIGH when both snapshots have FACT follower counts', () => {
      const older = makeSnapshot({
        followerCount: 10_000,
        followerCountStatus: 'FACT',
        fetchedAt: new Date('2024-01-01T00:00:00Z'),
      })
      const newer = makeSnapshot({
        followerCount: 15_000,
        followerCountStatus: 'FACT',
        fetchedAt: new Date('2024-03-01T00:00:00Z'),
      })
      const result = calculateGrowthScore([older, newer])
      expect(result.confidence).toBe('HIGH')
    })

    it('returns MEDIUM when one snapshot has ESTIMATED follower count', () => {
      const older = makeSnapshot({
        followerCount: 10_000,
        followerCountStatus: 'ESTIMATED',
        fetchedAt: new Date('2024-01-01T00:00:00Z'),
      })
      const newer = makeSnapshot({
        followerCount: 15_000,
        followerCountStatus: 'FACT',
        fetchedAt: new Date('2024-03-01T00:00:00Z'),
      })
      const result = calculateGrowthScore([older, newer])
      expect(result.confidence).toBe('MEDIUM')
    })
  })

  describe('score range invariant', () => {
    it('always returns score between 0 and 100', () => {
      const cases = [
        { older: 100, newer: 100_000 }, // massive growth
        { older: 100_000, newer: 100 }, // massive decline
        { older: 10_000, newer: 10_000 }, // zero growth
      ]
      for (const c of cases) {
        const result = calculateGrowthScore([
          makeSnapshot({
            followerCount: c.older,
            fetchedAt: new Date('2024-01-01T00:00:00Z'),
          }),
          makeSnapshot({
            followerCount: c.newer,
            fetchedAt: new Date('2024-03-01T00:00:00Z'),
          }),
        ])
        expect(result.score).toBeGreaterThanOrEqual(0)
        expect(result.score).toBeLessThanOrEqual(100)
      }
    })
  })
})
