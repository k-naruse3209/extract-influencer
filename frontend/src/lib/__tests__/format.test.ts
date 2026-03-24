import { describe, it, expect } from 'vitest'
import { formatFollowerCount, formatScore, formatDate } from '../format'

describe('formatFollowerCount', () => {
  it('null のとき "—" を返す', () => {
    expect(formatFollowerCount(null)).toBe('—')
  })

  it('0 のときカンマなしで "0" を返す', () => {
    expect(formatFollowerCount(0)).toBe('0')
  })

  it('9999 以下のときカンマ区切りで返す', () => {
    expect(formatFollowerCount(9999)).toBe('9,999')
    expect(formatFollowerCount(5234)).toBe('5,234')
    expect(formatFollowerCount(1)).toBe('1')
  })

  it('10000 以上 99999 以下のとき X.X万 形式を返す', () => {
    expect(formatFollowerCount(10000)).toBe('1.0万')
    expect(formatFollowerCount(12500)).toBe('1.3万')
    expect(formatFollowerCount(99999)).toBe('10.0万')
  })

  it('100000 以上 999999 以下のとき XX.X万 形式を返す', () => {
    expect(formatFollowerCount(100000)).toBe('10.0万')
    expect(formatFollowerCount(123456)).toBe('12.3万')
    expect(formatFollowerCount(999999)).toBe('100.0万')
  })

  it('1000000 以上のとき X.XM 形式を返す', () => {
    expect(formatFollowerCount(1_000_000)).toBe('1.0M')
    expect(formatFollowerCount(1_200_000)).toBe('1.2M')
    expect(formatFollowerCount(5_600_000)).toBe('5.6M')
  })
})

describe('formatScore', () => {
  it('null のとき "—" を返す', () => {
    expect(formatScore(null)).toBe('—')
  })

  it('0 のとき "0.0" を返す', () => {
    expect(formatScore(0)).toBe('0.0')
  })

  it('整数スコアを小数点1桁で返す', () => {
    expect(formatScore(75)).toBe('75.0')
    expect(formatScore(100)).toBe('100.0')
  })

  it('小数スコアを小数点1桁で四捨五入して返す', () => {
    expect(formatScore(75.36)).toBe('75.4')
    expect(formatScore(75.34)).toBe('75.3')
  })
})

describe('formatDate', () => {
  it('null のとき "—" を返す', () => {
    expect(formatDate(null)).toBe('—')
  })

  it('無効な日付文字列のとき "—" を返す', () => {
    expect(formatDate('invalid-date')).toBe('—')
    expect(formatDate('')).toBe('—')
  })

  it('有効な ISO 日付文字列を日本語形式で返す', () => {
    const result = formatDate('2026-03-20T00:00:00.000Z')
    expect(result).toContain('2026')
    expect(result).toContain('3')
    expect(result).toContain('20')
  })

  it('日付のみの文字列も処理できる', () => {
    const result = formatDate('2026-01-15')
    expect(result).toContain('2026')
    expect(result).toContain('1')
    expect(result).toContain('15')
  })
})
