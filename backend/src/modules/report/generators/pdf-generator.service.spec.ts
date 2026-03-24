import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock puppeteer.
// vi.mock() is hoisted by Vitest, so the factory must be self-contained.
// We expose the inner mock fns through vi.hoisted() so tests can configure them.
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
  launch: vi.fn(),
  newPage: vi.fn(),
  setContent: vi.fn(),
  pdf: vi.fn(),
  close: vi.fn(),
}))

vi.mock('puppeteer', () => ({
  default: {
    launch: mocks.launch,
  },
}))

import { PdfGeneratorService } from './pdf-generator.service'
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
    username: 'test_influencer',
    displayName: 'Test Influencer',
    profileUrl: 'https://instagram.com/test_influencer',
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
      {
        category: 'BRAND_FIT',
        score: 70,
        weight: 0.3,
        confidence: 'MEDIUM',
        status: 'ESTIMATED',
        rationale: 'Brand fit based on content analysis',
      },
      {
        category: 'ENGAGEMENT',
        score: 75,
        weight: 0.25,
        confidence: 'HIGH',
        status: 'ESTIMATED',
        rationale: 'Engagement rate above average',
      },
      {
        category: 'RISK',
        score: 80,
        weight: 0.2,
        confidence: 'MEDIUM',
        status: 'ESTIMATED',
        rationale: 'Low risk detected',
      },
      {
        category: 'PSEUDO_ACTIVITY',
        score: 65,
        weight: 0.15,
        confidence: 'LOW',
        status: 'ESTIMATED',
        rationale: 'Some suspicious patterns',
      },
      {
        category: 'GROWTH',
        score: 68,
        weight: 0.1,
        confidence: 'LOW',
        status: 'ESTIMATED',
        rationale: 'Moderate growth trend',
      },
    ],
    ...overrides,
  }
}

function makeUnavailableProfile(): ReportProfileData {
  return makeProfile({
    followerCount: null,
    followerCountStatus: 'UNAVAILABLE',
    followingCount: null,
    followingCountStatus: 'UNAVAILABLE',
    engagementRate: null,
    engagementRateStatus: 'UNAVAILABLE',
    totalScore: null,
    scoreConfidence: null,
    scoringModel: null,
    scoredAt: null,
    breakdowns: [],
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PdfGeneratorService', () => {
  let service: PdfGeneratorService

  beforeEach(() => {
    service = new PdfGeneratorService()
    vi.clearAllMocks()

    mocks.setContent.mockResolvedValue(undefined)
    mocks.pdf.mockResolvedValue(new Uint8Array(Buffer.from('%PDF-fake')))
    mocks.close.mockResolvedValue(undefined)
    mocks.newPage.mockResolvedValue({
      setContent: mocks.setContent,
      pdf: mocks.pdf,
    })
    mocks.launch.mockResolvedValue({
      newPage: mocks.newPage,
      close: mocks.close,
    })
  })

  describe('buildSingleProfileHtml', () => {
    it('includes the username in the output', () => {
      const html = service.buildSingleProfileHtml(makeProfile())
      expect(html).toContain('test_influencer')
    })

    it('includes the platform', () => {
      const html = service.buildSingleProfileHtml(makeProfile())
      expect(html).toContain('INSTAGRAM')
    })

    it('includes FACT badge (事実) for follower count with FACT status', () => {
      const html = service.buildSingleProfileHtml(makeProfile())
      expect(html).toContain('事実')
    })

    it('includes ESTIMATED badge (推定) for engagement rate with ESTIMATED status', () => {
      const html = service.buildSingleProfileHtml(makeProfile())
      expect(html).toContain('推定')
    })

    it('includes UNAVAILABLE badge (未取得) when followerCountStatus is UNAVAILABLE', () => {
      const html = service.buildSingleProfileHtml(makeUnavailableProfile())
      expect(html).toContain('未取得')
    })

    it('includes total score when score data is present', () => {
      const html = service.buildSingleProfileHtml(makeProfile())
      expect(html).toContain('72.5')
    })

    it('shows score-not-available message when totalScore is null', () => {
      const html = service.buildSingleProfileHtml(makeUnavailableProfile())
      expect(html).toContain('スコアデータなし')
    })

    it('includes scoring model version when present', () => {
      const html = service.buildSingleProfileHtml(makeProfile())
      expect(html).toContain('v1.0.0')
    })

    it('includes data legend section', () => {
      const html = service.buildSingleProfileHtml(makeProfile())
      expect(html).toContain('データ区分について')
    })

    it('includes disclaimer section', () => {
      const html = service.buildSingleProfileHtml(makeProfile())
      expect(html).toContain('免責事項')
    })

    it('includes fetch date', () => {
      const html = service.buildSingleProfileHtml(makeProfile())
      expect(html).toContain('2026-01-15')
    })

    it('includes score breakdowns with rationale', () => {
      const html = service.buildSingleProfileHtml(makeProfile())
      expect(html).toContain('BRAND_FIT')
      expect(html).toContain('Brand fit based on content analysis')
    })

    it('escapes HTML special characters in username to prevent XSS', () => {
      const profile = makeProfile({ username: '<script>alert(1)</script>' })
      const html = service.buildSingleProfileHtml(profile)
      expect(html).not.toContain('<script>')
      expect(html).toContain('&lt;script&gt;')
    })

    it('escapes HTML special characters in rationale to prevent XSS', () => {
      const profile = makeProfile({
        breakdowns: [
          {
            category: 'RISK',
            score: 50,
            weight: 0.2,
            confidence: 'LOW',
            status: 'ESTIMATED',
            rationale: '<img src=x onerror=alert(1)>',
          },
        ],
      })
      const html = service.buildSingleProfileHtml(profile)
      expect(html).not.toContain('<img src=x')
      expect(html).toContain('&lt;img')
    })

    it('produces valid HTML document structure', () => {
      const html = service.buildSingleProfileHtml(makeProfile())
      expect(html).toContain('<!DOCTYPE html>')
      expect(html).toContain('<html lang="ja">')
      expect(html).toContain('</html>')
      expect(html).toContain('charset="UTF-8"')
    })

    it('includes Japanese font in CSS', () => {
      const html = service.buildSingleProfileHtml(makeProfile())
      expect(html).toContain('Noto Sans JP')
    })
  })

  describe('buildComparisonHtml', () => {
    it('includes all profile usernames', () => {
      const profiles = [
        makeProfile({ username: 'user_alpha' }),
        makeProfile({ username: 'user_beta', id: 'profile-2' }),
      ]
      const html = service.buildComparisonHtml(profiles)
      expect(html).toContain('user_alpha')
      expect(html).toContain('user_beta')
    })

    it('includes エグゼクティブサマリー heading', () => {
      const html = service.buildComparisonHtml([makeProfile()])
      expect(html).toContain('エグゼクティブサマリー')
    })

    it('includes profile count in title', () => {
      const profiles = [makeProfile(), makeProfile({ id: 'profile-2', username: 'user2' })]
      const html = service.buildComparisonHtml(profiles)
      expect(html).toContain('2件')
    })

    it('includes data legend and disclaimer', () => {
      const html = service.buildComparisonHtml([makeProfile()])
      expect(html).toContain('データ区分について')
      expect(html).toContain('免責事項')
    })
  })

  describe('generateFromHtml', () => {
    it('calls puppeteer.launch and returns a Buffer', async () => {
      const html = '<html><body>test</body></html>'
      const result = await service.generateFromHtml(html)

      expect(Buffer.isBuffer(result)).toBe(true)
      expect(mocks.launch).toHaveBeenCalledWith(
        expect.objectContaining({ headless: true }),
      )
      expect(mocks.close).toHaveBeenCalled()
      expect(mocks.pdf).toHaveBeenCalledWith(
        expect.objectContaining({ format: 'A4' }),
      )
    })

    it('closes the browser even when pdf() throws', async () => {
      mocks.pdf.mockRejectedValueOnce(new Error('PDF generation failed'))

      await expect(service.generateFromHtml('<html></html>')).rejects.toThrow(
        'PDF generation failed',
      )
      expect(mocks.close).toHaveBeenCalled()
    })
  })
})
