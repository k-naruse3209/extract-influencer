import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ScoreBar } from '../score-bar'

describe('ScoreBar', () => {
  it('score が null のとき "—" を表示する', () => {
    render(<ScoreBar score={null} />)
    expect(screen.getByText('—')).toBeDefined()
  })

  it('score=80 のとき緑色のバーを表示する', () => {
    const { container } = render(<ScoreBar score={80} />)
    const bar = container.querySelector('.bg-green-500')
    expect(bar).not.toBeNull()
  })

  it('score=55 のとき黄色のバーを表示する', () => {
    const { container } = render(<ScoreBar score={55} />)
    const bar = container.querySelector('.bg-yellow-500')
    expect(bar).not.toBeNull()
  })

  it('score=20 のとき赤色のバーを表示する', () => {
    const { container } = render(<ScoreBar score={20} />)
    const bar = container.querySelector('.bg-red-500')
    expect(bar).not.toBeNull()
  })

  it('isInverted=true で score=20 のとき緑色のバーを表示する（低いほど良い）', () => {
    const { container } = render(<ScoreBar score={20} isInverted />)
    const bar = container.querySelector('.bg-green-500')
    expect(bar).not.toBeNull()
  })

  it('isInverted=true で score=50 のとき黄色のバーを表示する', () => {
    const { container } = render(<ScoreBar score={50} isInverted />)
    const bar = container.querySelector('.bg-yellow-500')
    expect(bar).not.toBeNull()
  })

  it('isInverted=true で score=80 のとき赤色のバーを表示する', () => {
    const { container } = render(<ScoreBar score={80} isInverted />)
    const bar = container.querySelector('.bg-red-500')
    expect(bar).not.toBeNull()
  })

  it('スコア値がテキストとして表示される', () => {
    render(<ScoreBar score={75} />)
    expect(screen.getByText('75')).toBeDefined()
  })

  it('バーの width がスコアのパーセンテージで設定される', () => {
    const { container } = render(<ScoreBar score={60} />)
    const bar = container.querySelector('[style*="width"]') as HTMLElement | null
    expect(bar).not.toBeNull()
    expect(bar?.style.width).toBe('60%')
  })
})
