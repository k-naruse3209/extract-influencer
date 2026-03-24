/**
 * 指数バックオフ付きリトライユーティリティ。
 *
 * Thundering Herd 対策としてジッターを加える:
 *   delay = baseDelayMs * 2^attempt * (0.5 + Math.random() * 0.5)
 *
 * shouldRetry が false を返した場合はリトライせずにエラーをスローする。
 */
export interface RetryOptions {
  maxRetries: number
  baseDelayMs: number
  /** エラーを受け取り、リトライすべきかどうかを返す。省略時は常に true。 */
  shouldRetry?: (error: unknown) => boolean
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  const { maxRetries, baseDelayMs, shouldRetry } = options

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error: unknown) {
      const isLastAttempt = attempt === maxRetries - 1
      const canRetry = shouldRetry ? shouldRetry(error) : true

      if (isLastAttempt || !canRetry) {
        throw error
      }

      const exponentialDelay = baseDelayMs * Math.pow(2, attempt)
      // ジッター: 0.5〜1.0 の係数でばらつかせ thundering herd を防ぐ
      const jitter = 0.5 + Math.random() * 0.5
      const delayMs = Math.round(exponentialDelay * jitter)

      await sleep(delayMs)
    }
  }

  // ループ条件上ここには到達しないが TypeScript の exhaustiveness のため
  throw new Error('withRetry: unexpected exit from retry loop')
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
