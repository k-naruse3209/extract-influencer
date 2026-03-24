import { Injectable, Logger } from '@nestjs/common'
import Anthropic from '@anthropic-ai/sdk'
import { LlmParseException } from './exceptions/llm-parse.exception'
import { sleep } from '../../common/utils/retry'

/** モデルのデフォルト値。分析コメント生成にはHaikuで十分。 */
const DEFAULT_MODEL = 'claude-haiku-4-5-20251001'
const MAX_TOKENS = 1024
/** temperature=0 で再現性を確保する */
const TEMPERATURE = 0

/**
 * Anthropic Claude API クライアント。
 *
 * 設計上の制約:
 * - ANTHROPIC_API_KEY はログに絶対に出力しない
 * - JSON出力を強制し、パース失敗時はリトライ1回
 * - リトライ後も失敗した場合は LlmParseException を投げる
 * - 呼び出し元は LlmParseException をキャッチして fallback 処理を行うこと
 */
@Injectable()
export class ClaudeApiClient {
  private readonly logger = new Logger(ClaudeApiClient.name)
  private readonly client: Anthropic
  private readonly model: string

  constructor() {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })
    this.model = process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL
  }

  /**
   * JSON形式の構造化出力を生成する。
   *
   * リトライ戦略:
   * 1回目: 通常のリクエスト
   * 2回目 (リトライ): 「JSONのみ返してください」を追記して再送
   * 2回とも失敗 → LlmParseException
   *
   * @param systemPrompt システムプロンプト（出力フォーマット指示を含む）
   * @param userPrompt ユーザーメッセージ（プロフィールデータ等）
   * @param model 使用モデル（省略時は環境変数から取得）
   */
  async generateStructuredOutput<T>(
    systemPrompt: string,
    userPrompt: string,
    model?: string,
  ): Promise<T> {
    const targetModel = model ?? this.model

    const firstAttempt = await this.callApi(systemPrompt, userPrompt, targetModel)
    const firstResult = this.tryParseJson<T>(firstAttempt)
    if (firstResult !== null) {
      return firstResult
    }

    this.logger.warn(
      `LLMレスポンスのJSONパースに失敗しました（1回目）。リトライします。model=${targetModel}`,
    )

    const retryPrompt = `${userPrompt}\n\n【重要】必ずJSONのみを返してください。説明文やマークダウンは不要です。`
    const secondAttempt = await this.callApi(systemPrompt, retryPrompt, targetModel)
    const secondResult = this.tryParseJson<T>(secondAttempt)
    if (secondResult !== null) {
      return secondResult
    }

    this.logger.error(
      `LLMレスポンスのJSONパースに2回失敗しました。model=${targetModel}`,
    )
    throw new LlmParseException(
      `2回のリクエスト後もJSONを取得できませんでした。最後のレスポンス: ${secondAttempt.slice(0, 200)}`,
    )
  }

  /**
   * 使用中のモデル名を返す（AiAnalysisのDB保存に使用）。
   */
  getModel(): string {
    return this.model
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Anthropic API を呼び出す。
   *
   * 429 レート制限エラー時は指数バックオフで1回リトライする。
   * JSONパース失敗時のリトライは generateStructuredOutput 側で管理する。
   */
  private async callApi(
    systemPrompt: string,
    userPrompt: string,
    model: string,
  ): Promise<string> {
    for (let attempt = 0; attempt <= 1; attempt++) {
      try {
        const response = await this.client.messages.create({
          model,
          max_tokens: MAX_TOKENS,
          temperature: TEMPERATURE,
          system: systemPrompt,
          messages: [
            {
              role: 'user',
              content: userPrompt,
            },
          ],
        })

        const content = response.content[0]
        if (content.type !== 'text') {
          throw new LlmParseException(
            `予期しないコンテンツタイプ: ${content.type}`,
          )
        }

        return content.text
      } catch (error: unknown) {
        const isRateLimit =
          error !== null &&
          typeof error === 'object' &&
          'status' in error &&
          (error as { status: unknown }).status === 429

        if (isRateLimit && attempt === 0) {
          const delayMs = Math.pow(2, attempt) * 1000 // 1s
          this.logger.warn(
            `Anthropic API rate limit (429). Retrying after ${delayMs}ms. attempt=${attempt + 1}/2`,
          )
          await sleep(delayMs)
          continue
        }

        throw error
      }
    }

    // ループ終了後にここには到達しないが TypeScript の exhaustiveness のため
    throw new Error('callApi: unexpected exit from retry loop')
  }

  /**
   * JSONパースを試みる。成功したらパース済みオブジェクト、失敗したら null を返す。
   *
   * マークダウンコードブロック（```json ... ```）を除去してからパースする。
   */
  private tryParseJson<T>(text: string): T | null {
    try {
      const cleaned = this.stripMarkdownCodeBlock(text.trim())
      return JSON.parse(cleaned) as T
    } catch {
      return null
    }
  }

  /**
   * LLMがマークダウンのコードブロックで囲んで返すケースに対応する。
   * 例: ```json\n{...}\n``` → {...}
   */
  private stripMarkdownCodeBlock(text: string): string {
    const match = /^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/.exec(text)
    return match ? match[1].trim() : text
  }
}
