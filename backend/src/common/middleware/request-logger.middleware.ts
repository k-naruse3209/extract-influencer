import { Injectable, NestMiddleware, Logger } from '@nestjs/common'
import type { FastifyRequest, FastifyReply } from 'fastify'
import type { HookHandlerDoneFunction } from 'fastify'

/**
 * RequestLoggerMiddleware
 *
 * 全リクエストの method / url / status / responseTime をログ出力する。
 * body には PII（password 等）が含まれる可能性があるため一切ログに出さない。
 *
 * Fastify では res.on('finish') が動作しないため、
 * reply の send フックを経由した onSend ではなく、
 * middleware として NestMiddleware インターフェースを実装し
 * next() コールバックで完了後の計測を行う。
 *
 * NOTE: Fastify の response 完了フックは NestJS Middleware からは
 * 直接フックできないため、here では req 受信時に開始時刻を記録し
 * next() 完了後の差分を responseTime として記録する。
 */
@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP')

  use(
    req: FastifyRequest['raw'],
    _res: FastifyReply['raw'],
    next: HookHandlerDoneFunction,
  ): void {
    const start = Date.now()
    const method = req.method ?? 'UNKNOWN'
    const url = req.url ?? '/'

    // Health check エンドポイントはノイズになるため除外する
    if (url === '/api/v1/health' || url === '/health') {
      next()
      return
    }

    _res.on('finish', () => {
      const responseTime = Date.now() - start
      const status = _res.statusCode
      this.logger.log(
        `${method} ${url} ${status} ${responseTime}ms`,
        'HTTP',
      )
    })

    next()
  }
}
