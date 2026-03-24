import { describe, it, expect } from 'vitest'
import { cn } from '../utils'

describe('cn', () => {
  it('単一クラスをそのまま返す', () => {
    expect(cn('text-sm')).toBe('text-sm')
  })

  it('複数クラスをスペース結合する', () => {
    expect(cn('text-sm', 'font-bold')).toBe('text-sm font-bold')
  })

  it('Tailwind の競合クラスを後勝ちでマージする', () => {
    expect(cn('text-sm', 'text-lg')).toBe('text-lg')
  })

  it('条件付きクラスを正しく処理する', () => {
    expect(cn('base', false && 'hidden', 'visible')).toBe('base visible')
  })

  it('undefined や null を無視する', () => {
    expect(cn('text-sm', undefined, null, 'font-bold')).toBe(
      'text-sm font-bold',
    )
  })
})
