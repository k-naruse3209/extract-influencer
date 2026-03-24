import { describe, it, expect, beforeEach } from 'vitest'
import { HealthController } from './health.controller'

describe('HealthController', () => {
  let controller: HealthController

  beforeEach(() => {
    controller = new HealthController()
  })

  it('returns status ok', () => {
    const result = controller.check()
    expect(result.status).toBe('ok')
  })

  it('returns a valid ISO 8601 timestamp', () => {
    const result = controller.check()
    const parsed = new Date(result.timestamp)
    expect(parsed.toISOString()).toBe(result.timestamp)
  })

  it('timestamp reflects current time within 1 second', () => {
    const before = Date.now()
    const result = controller.check()
    const after = Date.now()
    const ts = new Date(result.timestamp).getTime()
    expect(ts).toBeGreaterThanOrEqual(before)
    expect(ts).toBeLessThanOrEqual(after)
  })
})
