import { Logger } from '@nestjs/common'

/**
 * LLM プロンプトに含めるユーザー入力（Instagram biography, caption 等）をサニタイズする。
 *
 * 対策:
 * 1. システムプロンプト偽装の防止（"System:", "Assistant:" 等のプレフィックス除去）
 * 2. インジェクション命令の無害化（"Ignore previous instructions" 等）
 * 3. 長さ制限（過度に長い入力のトランケーション）
 * 4. 制御文字の除去
 *
 * 設計上の注意:
 * - ステートレスなユーティリティクラス（NestJS の Injectable は不要）
 * - PII の可能性があるため、検出時も入力内容自体はログに含めない
 * - 正常な日本語テキストを誤検知しないよう、パターンは英語キーワードに限定する
 */
export class PromptSanitizer {
  static readonly MAX_INPUT_LENGTH = 2000

  private static readonly logger = new Logger(PromptSanitizer.name)

  /**
   * ユーザー生成コンテンツをサニタイズしてLLMに安全に渡す。
   *
   * @param input サニタイズ対象の文字列（null/undefined は空文字を返す）
   * @returns サニタイズ済み文字列
   */
  static sanitize(input: string | null | undefined): string {
    if (input === null || input === undefined || input === '') return ''

    let sanitized = input

    // 1. 制御文字を除去（改行 \n・タブ \t は正常テキストに必要なため許可）
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')

    // 2. ロールプレフィックスを無害化
    //    「System: ...」「Assistant: ...」等のプロンプト構造偽装を防ぐ
    sanitized = sanitized.replace(
      /^(system|assistant|human|user)\s*:/gim,
      '[role-prefix-removed]:',
    )

    // 3. 一般的なプロンプトインジェクションパターンをマーク
    //    英語パターンに限定（日本語テキストの誤検知を防ぐ）
    const injectionPatterns: RegExp[] = [
      /ignore\s+(all\s+)?previous\s+instructions/gi,
      /forget\s+(all\s+)?previous\s+instructions/gi,
      /disregard\s+(all\s+)?previous/gi,
      /you\s+are\s+now\s+/gi,
      /act\s+as\s+(if\s+)?you\s+are/gi,
      /new\s+instructions?\s*:/gi,
      /override\s+(all\s+)?instructions/gi,
    ]

    for (const pattern of injectionPatterns) {
      sanitized = sanitized.replace(pattern, '[filtered]')
    }

    // 4. 長さ制限（MAX_INPUT_LENGTH 超は末尾をトランケート）
    if (sanitized.length > PromptSanitizer.MAX_INPUT_LENGTH) {
      sanitized = sanitized.slice(0, PromptSanitizer.MAX_INPUT_LENGTH) + '...[truncated]'
    }

    // 5. サニタイズが発動した場合のみ警告ログを出力（内容は含めない）
    if (sanitized !== input) {
      PromptSanitizer.logger.warn(
        'Potential prompt injection detected and sanitized',
      )
    }

    return sanitized.trim()
  }

  /**
   * オブジェクトの全文字列フィールドを再帰的にサニタイズする。
   *
   * @param obj サニタイズ対象オブジェクト
   * @returns 全文字列フィールドがサニタイズされた新しいオブジェクト
   */
  static sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
    const result = { ...obj }
    for (const key of Object.keys(result)) {
      const value = result[key]
      if (typeof value === 'string') {
        ;(result as Record<string, unknown>)[key] = PromptSanitizer.sanitize(value)
      } else if (
        value !== null &&
        typeof value === 'object' &&
        !Array.isArray(value)
      ) {
        ;(result as Record<string, unknown>)[key] = PromptSanitizer.sanitizeObject(
          value as Record<string, unknown>,
        )
      }
    }
    return result
  }
}
