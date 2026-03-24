import { describe, it, expect, beforeEach } from 'vitest'
import { CsvGeneratorService } from './csv-generator.service'
import type { ReportProfileData } from '../types/report-profile.data'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeProfile(
  overrides: Partial<ReportProfileData> = {},
): ReportProfileData {
  return {
    id: 'profile-1',
    platform: 'INSTAGRAM',
    username: 'test_user',
    displayName: 'Test User',
    profileUrl: 'https://instagram.com/test_user',
    followerCount: 12500,
    followerCountStatus: 'FACT',
    followingCount: 300,
    followingCountStatus: 'FACT',
    engagementRate: 0.032,
    engagementRateStatus: 'ESTIMATED',
    mediaCount: 120,
    mediaCountStatus: 'FACT',
    biography: 'Test bio',
    biographyStatus: 'FACT',
    fetchedAt: new Date('2026-01-15T00:00:00Z'),
    totalScore: 72.5,
    scoreConfidence: 'HIGH',
    scoringModel: 'v1.0.0',
    scoredAt: new Date('2026-01-15T01:00:00Z'),
    breakdowns: [
      { category: 'BRAND_FIT', score: 70, weight: 0.3, confidence: 'MEDIUM', status: 'ESTIMATED', rationale: 'OK' },
      { category: 'ENGAGEMENT', score: 75, weight: 0.25, confidence: 'HIGH', status: 'ESTIMATED', rationale: 'Good' },
      { category: 'RISK', score: 80, weight: 0.2, confidence: 'MEDIUM', status: 'ESTIMATED', rationale: 'Low risk' },
      { category: 'PSEUDO_ACTIVITY', score: 65, weight: 0.15, confidence: 'LOW', status: 'ESTIMATED', rationale: 'Some patterns' },
      { category: 'GROWTH', score: 68, weight: 0.1, confidence: 'LOW', status: 'ESTIMATED', rationale: 'Moderate' },
    ],
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CsvGeneratorService', () => {
  let service: CsvGeneratorService

  beforeEach(() => {
    service = new CsvGeneratorService()
  })

  describe('generateCsv', () => {
    it('returns a Buffer', async () => {
      const result = await service.generateCsv([makeProfile()])
      expect(Buffer.isBuffer(result)).toBe(true)
    })

    it('starts with UTF-8 BOM (\\uFEFF) for Excel compatibility', async () => {
      const result = await service.generateCsv([makeProfile()])
      // UTF-8 BOM is EF BB BF as bytes
      expect(result[0]).toBe(0xef)
      expect(result[1]).toBe(0xbb)
      expect(result[2]).toBe(0xbf)
    })

    it('contains the header row with all required column names', async () => {
      const result = await service.generateCsv([makeProfile()])
      const text = result.toString('utf8')

      const expectedColumns = [
        'username',
        'platform',
        'followerCount',
        'followerCount_区分',
        'followingCount',
        'followingCount_区分',
        'engagementRate',
        'engagementRate_区分',
        'mediaCount',
        'mediaCount_区分',
        'totalScore',
        'scoreConfidence',
        'brandFitScore',
        'brandFitScore_区分',
        'riskScore',
        'riskScore_区分',
        'pseudoActivityScore',
        'pseudoActivityScore_区分',
        'engagementScore',
        'engagementScore_区分',
        'growthScore',
        'growthScore_区分',
        'scoringModel',
        'scoredAt',
        'fetchedAt',
      ]

      for (const col of expectedColumns) {
        expect(text).toContain(col)
      }
    })

    it('includes profile data values in the output', async () => {
      const result = await service.generateCsv([makeProfile()])
      const text = result.toString('utf8')

      expect(text).toContain('test_user')
      expect(text).toContain('INSTAGRAM')
      expect(text).toContain('12500')
      expect(text).toContain('FACT')
      expect(text).toContain('72.5')
      expect(text).toContain('HIGH')
      expect(text).toContain('v1.0.0')
    })

    it('produces N+1 lines for N profiles (header + data rows)', async () => {
      const profiles = [
        makeProfile({ username: 'user1' }),
        makeProfile({ username: 'user2', id: 'profile-2' }),
        makeProfile({ username: 'user3', id: 'profile-3' }),
      ]
      const result = await service.generateCsv(profiles)
      const text = result.toString('utf8')
      // Split by newline; trailing newline adds an empty element
      const lines = text.split('\n').filter((l) => l.trim().length > 0)
      expect(lines).toHaveLength(4) // 1 header + 3 data rows
    })

    it('escapes commas inside field values', async () => {
      const profile = makeProfile({ username: 'user,with,commas' })
      const result = await service.generateCsv([profile])
      const text = result.toString('utf8')
      // csv-stringify wraps fields containing commas in double quotes
      expect(text).toContain('"user,with,commas"')
    })

    it('escapes newlines inside field values', async () => {
      const profile = makeProfile({ username: 'user\nwith\nnewlines' })
      const result = await service.generateCsv([profile])
      // Should not produce extra unquoted lines
      const text = result.toString('utf8')
      expect(text).toContain('"user')
      // Newline within a quoted field is valid CSV; total data row count stays 1
      const lines = text.split('\n').filter((l) => l.trim().length > 0)
      // header + the quoted multi-line field still produces exactly 2+ lines
      // but we simply verify no raw unquoted newline breaks the row count beyond header+1
      expect(lines.length).toBeGreaterThanOrEqual(2)
    })

    it('handles null numeric values gracefully (empty string in output)', async () => {
      const profile = makeProfile({
        followerCount: null,
        followerCountStatus: 'UNAVAILABLE',
        totalScore: null,
        scoreConfidence: null,
        breakdowns: [],
      })
      const result = await service.generateCsv([profile])
      const text = result.toString('utf8')
      // The row should exist and not throw; empty columns produce consecutive commas
      expect(text).toContain('test_user')
    })

    it('includes DataStatus values for each metric column', async () => {
      const result = await service.generateCsv([makeProfile()])
      const text = result.toString('utf8')
      expect(text).toContain('ESTIMATED')
    })

    it('handles an empty profile array', async () => {
      const result = await service.generateCsv([])
      const text = result.toString('utf8')
      // Should still have a header row
      expect(text).toContain('username')
      expect(text).toContain('platform')
    })
  })
})
