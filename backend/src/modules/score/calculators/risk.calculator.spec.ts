import { describe, it, expect } from 'vitest'
import { calculateRiskScore } from './risk.calculator'

describe('calculateRiskScore', () => {
  it('returns base score 70 when no penalties apply', () => {
    const result = calculateRiskScore(
      { BRAND_FIT: { score: 50, confidence: 'MEDIUM', status: 'ESTIMATED', rationale: '' } },
      true,
    )
    expect(result.score).toBe(70)
  })

  it('applies -10 penalty when BRAND_FIT confidence is LOW', () => {
    const result = calculateRiskScore(
      { BRAND_FIT: { score: 50, confidence: 'LOW', status: 'ESTIMATED', rationale: '' } },
      true,
    )
    expect(result.score).toBe(60)
  })

  it('applies -5 penalty when follower count is unavailable', () => {
    const result = calculateRiskScore({}, false)
    expect(result.score).toBe(65)
  })

  it('applies both penalties cumulatively', () => {
    const result = calculateRiskScore(
      { BRAND_FIT: { score: 50, confidence: 'LOW', status: 'ESTIMATED', rationale: '' } },
      false,
    )
    expect(result.score).toBe(55)
  })

  it('always returns ESTIMATED status', () => {
    const result = calculateRiskScore({}, true)
    expect(result.status).toBe('ESTIMATED')
  })

  it('always returns LOW confidence in MVP', () => {
    const result = calculateRiskScore({}, true)
    expect(result.confidence).toBe('LOW')
  })

  it('includes penalty details in rationale when penalties apply', () => {
    const result = calculateRiskScore(
      { BRAND_FIT: { score: 50, confidence: 'LOW', status: 'ESTIMATED', rationale: '' } },
      false,
    )
    expect(result.rationale).toContain('BRAND_FIT')
    expect(result.rationale).toContain('UNAVAILABLE')
  })

  it('score is always between 0 and 100', () => {
    const result = calculateRiskScore(
      { BRAND_FIT: { score: 50, confidence: 'LOW', status: 'ESTIMATED', rationale: '' } },
      false,
    )
    expect(result.score).toBeGreaterThanOrEqual(0)
    expect(result.score).toBeLessThanOrEqual(100)
  })
})
