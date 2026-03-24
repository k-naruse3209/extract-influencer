import { describe, it, expect } from 'vitest'
import { clamp } from './clamp'

describe('clamp', () => {
  it('returns the value when it is within range', () => {
    expect(clamp(50, 0, 100)).toBe(50)
  })

  it('returns min when value is below range', () => {
    expect(clamp(-10, 0, 100)).toBe(0)
  })

  it('returns max when value is above range', () => {
    expect(clamp(150, 0, 100)).toBe(100)
  })

  it('returns min when value equals min', () => {
    expect(clamp(0, 0, 100)).toBe(0)
  })

  it('returns max when value equals max', () => {
    expect(clamp(100, 0, 100)).toBe(100)
  })

  it('handles negative ranges', () => {
    expect(clamp(-5, -10, -1)).toBe(-5)
    expect(clamp(-20, -10, -1)).toBe(-10)
  })
})
