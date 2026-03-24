import { HttpException, HttpStatus } from '@nestjs/common'

/**
 * LLM レスポンスの JSON パースに2回失敗した場合に投げる例外。
 *
 * 上位のサービス層は必ずこの例外をキャッチして fallback 処理を行うこと。
 * スコアリングパイプラインをLLMのパース失敗でブロックしないための設計。
 */
export class LlmParseException extends HttpException {
  constructor(reason: string) {
    super(
      {
        error: {
          code: 'LLM_PARSE_FAILURE',
          message: `LLM レスポンスの JSON パースに失敗しました: ${reason}`,
        },
      },
      HttpStatus.INTERNAL_SERVER_ERROR,
    )
  }
}
