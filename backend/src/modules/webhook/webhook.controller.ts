import {
  Controller,
  Get,
  Post,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { FastifyRequest, FastifyReply } from 'fastify'
import { createHmac, timingSafeEqual } from 'node:crypto'

interface DeauthorizeValue {
  user_id?: string
}

interface WebhookChange {
  field: string
  value: unknown
}

interface WebhookEntry {
  changes?: WebhookChange[]
}

interface WebhookBody {
  object: string
  entry?: WebhookEntry[]
}

/**
 * Meta Webhook エンドポイント。
 *
 * GET  /webhook — Meta の疎通確認（challenge 応答）
 * POST /webhook — イベント受信（署名検証 + deauthorize 処理）
 *
 * グローバルプレフィックス /api/v1 から除外（main.ts で設定）。
 */
@Controller('webhook')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name)

  constructor(private readonly configService: ConfigService) {}

  /**
   * GET /webhook
   *
   * Meta が Webhook を登録する際の疎通確認。
   * hub.verify_token が INSTAGRAM_WEBHOOK_VERIFY_TOKEN と一致し、
   * hub.mode が 'subscribe' の場合に hub.challenge をそのまま返す。
   */
  @Get()
  handleVerification(
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply,
  ): void {
    const query = req.query as Record<string, string>
    const mode = query['hub.mode']
    const challenge = query['hub.challenge']
    const verifyToken = query['hub.verify_token']
    const expectedToken = this.configService.get<string>(
      'INSTAGRAM_WEBHOOK_VERIFY_TOKEN',
    )

    if (mode === 'subscribe' && verifyToken === expectedToken) {
      this.logger.log('Webhook verification successful')
      void reply.status(HttpStatus.OK).type('text/plain').send(challenge)
      return
    }

    this.logger.warn(
      `Webhook verification failed: mode=${mode} tokenMatch=${verifyToken === expectedToken}`,
    )
    void reply.status(HttpStatus.FORBIDDEN).send({ message: 'Forbidden' })
  }

  /**
   * POST /webhook
   *
   * Meta からのイベント受信。
   * X-Hub-Signature-256 ヘッダーで署名を検証し、不正なリクエストをはじく。
   * deauthorize イベントを受信した場合はログに記録する。
   * Meta は常に 200 を期待するため、処理失敗時も 200 を返す。
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  handleEvent(@Req() req: FastifyRequest): { ok: boolean } {
    const signature = req.headers['x-hub-signature-256'] as string | undefined
    const clientSecret = this.configService.get<string>('INSTAGRAM_CLIENT_SECRET')

    if (signature && clientSecret) {
      const rawBody =
        (req as unknown as { rawBody?: string }).rawBody ??
        JSON.stringify(req.body)
      const expectedSignature = `sha256=${createHmac('sha256', clientSecret)
        .update(rawBody)
        .digest('hex')}`

      const sigBuf = Buffer.from(signature)
      const expBuf = Buffer.from(expectedSignature)
      const isValid =
        sigBuf.length === expBuf.length && timingSafeEqual(sigBuf, expBuf)

      if (!isValid) {
        this.logger.warn('Webhook POST: invalid X-Hub-Signature-256 — ignoring')
        return { ok: true }
      }
    } else {
      this.logger.warn('Webhook POST: missing signature or client secret — skipping verification')
    }

    const body = req.body as WebhookBody

    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field === 'deauthorize') {
          const val = change.value as DeauthorizeValue
          this.logger.log(`Deauthorize event received: igUserId=${val.user_id ?? 'unknown'}`)
        } else {
          this.logger.log(`Webhook event: field=${change.field}`)
        }
      }
    }

    return { ok: true }
  }
}
