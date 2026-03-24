import { LoggerService, LogLevel } from '@nestjs/common'

/**
 * JSON 構造化ログ出力。
 * 本番環境では JSON 形式、開発環境ではテキスト形式で出力する。
 *
 * セキュリティ: password / token / apiKey / encryptedToken フィールド値を
 * 自動マスクする。PII をログに含めないこと。
 */
export class StructuredLogger implements LoggerService {
  private readonly isProduction: boolean

  constructor() {
    this.isProduction = process.env.NODE_ENV === 'production'
  }

  log(message: string, context?: string): void {
    this.writeLog('info', message, context)
  }

  error(message: string, trace?: string, context?: string): void {
    this.writeLog('error', message, context, { trace })
  }

  warn(message: string, context?: string): void {
    this.writeLog('warn', message, context)
  }

  debug(message: string, context?: string): void {
    this.writeLog('debug', message, context)
  }

  verbose(message: string, context?: string): void {
    this.writeLog('verbose', message, context)
  }

  /** NestJS LoggerService インターフェース要件 */
  setLogLevels(_levels: LogLevel[]): void {
    // ログレベルフィルタリングは将来対応。現状は全レベル出力する。
  }

  private writeLog(
    level: string,
    message: string,
    context?: string,
    extra?: Record<string, unknown>,
  ): void {
    if (this.isProduction) {
      const entry: Record<string, unknown> = {
        timestamp: new Date().toISOString(),
        level,
        context: context ?? 'Application',
        message,
        ...extra,
      }
      const sanitized = this.sanitize(JSON.stringify(entry))
      process.stdout.write(sanitized + '\n')
    } else {
      const prefix = context ? `[${context}]` : ''
      const ts = new Date().toISOString()
      const traceStr =
        extra?.trace != null ? `\n${String(extra.trace)}` : ''
      process.stdout.write(
        `${ts} ${level.toUpperCase()} ${prefix} ${message}${traceStr}\n`,
      )
    }
  }

  /**
   * 機密フィールドの値をマスクする。
   * フィールド名: password, token, apiKey, encryptedToken
   */
  private sanitize(json: string): string {
    return json
      .replace(/"password"\s*:\s*"[^"]*"/g, '"password":"***"')
      .replace(/"token"\s*:\s*"[^"]*"/g, '"token":"***"')
      .replace(/"apiKey"\s*:\s*"[^"]*"/g, '"apiKey":"***"')
      .replace(/"encryptedToken"\s*:\s*"[^"]*"/g, '"encryptedToken":"***"')
  }
}
