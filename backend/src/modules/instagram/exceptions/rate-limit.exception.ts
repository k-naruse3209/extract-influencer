import { HttpException, HttpStatus } from '@nestjs/common'

/**
 * Instagram API のレート制限超過（エラーコード #32）を表す例外。
 *
 * レート制限: 200 calls / hour / user token
 * 発生時はキューワーカーが job.moveToDelayed で 60 秒後にリトライする。
 */
export class RateLimitException extends HttpException {
  /** リトライまでの推奨待機時間（秒） */
  readonly retryAfterSeconds: number

  constructor(retryAfterSeconds = 60) {
    super(
      {
        error: {
          code: 'INSTAGRAM_RATE_LIMIT',
          message:
            'Instagram API レート制限に達しました。しばらく後に再試行してください。',
          instagramErrorCode: 32,
          status: 'rate_limited',
          retryAfterSeconds,
        },
      },
      HttpStatus.TOO_MANY_REQUESTS,
    )
    this.retryAfterSeconds = retryAfterSeconds
  }
}
