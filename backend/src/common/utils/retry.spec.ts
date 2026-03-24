import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { withRetry, sleep } from './retry'

describe('withRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('成功した場合はリトライせずに結果を返す', async () => {
    const fn = vi.fn().mockResolvedValue('success')

    const result = await withRetry(fn, { maxRetries: 3, baseDelayMs: 100 })

    expect(result).toBe('success')
    expect(fn).toHaveBeenCalledOnce()
  })

  it('1回失敗した後に成功した場合は結果を返す', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('temporary error'))
      .mockResolvedValueOnce('success after retry')

    const promise = withRetry(fn, { maxRetries: 3, baseDelayMs: 100 })
    // タイマーを進めてリトライ待機を解消する
    await vi.runAllTimersAsync()

    const result = await promise
    expect(result).toBe('success after retry')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('最大リトライ回数を超えた場合は最後のエラーをスローする', async () => {
    const error = new Error('persistent error')
    const fn = vi.fn().mockRejectedValue(error)

    // promise を先に catch に繋げて unhandled rejection を防ぐ
    let caught: unknown
    const promise = withRetry(fn, { maxRetries: 3, baseDelayMs: 100 }).catch(
      (e) => {
        caught = e
      },
    )
    await vi.runAllTimersAsync()
    await promise

    expect(caught).toBe(error)
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('shouldRetry が false を返した場合は即座にエラーをスローする', async () => {
    const nonRetryableError = new Error('non-retryable')
    const fn = vi.fn().mockRejectedValue(nonRetryableError)
    const shouldRetry = vi.fn().mockReturnValue(false)

    await expect(
      withRetry(fn, { maxRetries: 3, baseDelayMs: 100, shouldRetry }),
    ).rejects.toThrow('non-retryable')

    expect(fn).toHaveBeenCalledOnce()
    expect(shouldRetry).toHaveBeenCalledWith(nonRetryableError)
  })

  it('shouldRetry が true を返す場合はリトライする', async () => {
    const retryableError = new Error('retryable')
    const fn = vi
      .fn()
      .mockRejectedValueOnce(retryableError)
      .mockResolvedValueOnce('ok')
    const shouldRetry = vi.fn().mockReturnValue(true)

    const promise = withRetry(fn, {
      maxRetries: 3,
      baseDelayMs: 100,
      shouldRetry,
    })
    await vi.runAllTimersAsync()

    const result = await promise
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('maxRetries=1 の場合はリトライなしで1回だけ実行する', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('error'))

    await expect(
      withRetry(fn, { maxRetries: 1, baseDelayMs: 100 }),
    ).rejects.toThrow('error')

    expect(fn).toHaveBeenCalledOnce()
  })

  it('遅延は指数バックオフ + ジッターで計算される', async () => {
    // ジッターをなくして決定論的にテストするため Math.random を 1.0 に固定
    vi.spyOn(Math, 'random').mockReturnValue(1.0) // jitter = 0.5 + 1.0 * 0.5 = 1.0

    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('error1'))
      .mockRejectedValueOnce(new Error('error2'))
      .mockResolvedValueOnce('ok')

    const setTimeoutSpy = vi.spyOn(global, 'setTimeout')

    const promise = withRetry(fn, { maxRetries: 3, baseDelayMs: 1000 })
    await vi.runAllTimersAsync()
    await promise

    // attempt=0: delay = 1000 * 2^0 * 1.0 = 1000ms
    // attempt=1: delay = 1000 * 2^1 * 1.0 = 2000ms
    const delays = setTimeoutSpy.mock.calls.map((call) => call[1] as number)
    expect(delays).toContain(1000)
    expect(delays).toContain(2000)
  })

  it('エラーオブジェクトが shouldRetry に渡される', async () => {
    const customError = { code: 429, message: 'rate limited' }
    const fn = vi.fn().mockRejectedValue(customError)
    const shouldRetry = vi.fn().mockReturnValue(false)

    await expect(
      withRetry(fn, { maxRetries: 3, baseDelayMs: 100, shouldRetry }),
    ).rejects.toBe(customError)

    expect(shouldRetry).toHaveBeenCalledWith(customError)
  })
})

describe('sleep', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('指定したミリ秒後に解決する', async () => {
    const promise = sleep(500)
    vi.advanceTimersByTime(500)
    await expect(promise).resolves.toBeUndefined()
  })
})
