import { HttpException, HttpStatus } from '@nestjs/common'

/**
 * Instagram Graph API から返却されたエラーを表す例外。
 *
 * エラーコードマッピング（主要なもの）:
 *   10  → OAuthException: 非公開アカウントまたは権限不足
 *   32  → レート制限超過（RateLimitException を使うこと）
 *   100 → パラメータエラー
 *   190 → アクセストークン失効
 */
export class InstagramApiException extends HttpException {
  readonly instagramErrorCode: number
  readonly instagramErrorType: string

  constructor(
    message: string,
    instagramErrorCode: number,
    instagramErrorType: string,
    httpStatus: HttpStatus = HttpStatus.BAD_GATEWAY,
  ) {
    super(
      {
        error: {
          code: InstagramApiException.mapInstagramErrorCode(instagramErrorCode),
          message,
          instagramErrorCode,
          instagramErrorType,
          status:
            instagramErrorCode === 10 || instagramErrorCode === 190
              ? 'unavailable'
              : 'error',
        },
      },
      httpStatus,
    )
    this.instagramErrorCode = instagramErrorCode
    this.instagramErrorType = instagramErrorType
  }

  /**
   * Instagram API エラーコードをプラットフォーム内部エラーコードに変換する。
   */
  private static mapInstagramErrorCode(code: number): string {
    const mapping: Record<number, string> = {
      10: 'INSTAGRAM_PRIVATE_ACCOUNT',
      32: 'INSTAGRAM_RATE_LIMIT',
      100: 'INSTAGRAM_INVALID_PARAMETER',
      190: 'INSTAGRAM_TOKEN_EXPIRED',
      200: 'INSTAGRAM_PERMISSION_DENIED',
    }
    return mapping[code] ?? 'INSTAGRAM_API_ERROR'
  }
}
