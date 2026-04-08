import {
  Controller,
  Get,
  Post,
  Delete,
  Query,
  Param,
  Res,
  HttpCode,
  HttpStatus,
  UseGuards,
  BadRequestException,
  Logger,
} from '@nestjs/common'
import type { FastifyReply } from 'fastify'
import { ConfigService } from '@nestjs/config'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import type { JwtPayload } from '../../common/decorators/current-user.decorator'
import { InstagramService } from './instagram.service'

/**
 * Instagram OAuth および手動フェッチリクエストのコントローラー。
 *
 * エンドポイント:
 *   GET  /api/v1/auth/instagram           — OAuth 開始（Instagram へリダイレクト）
 *   GET  /api/v1/auth/instagram/callback  — OAuth コールバック
 *   POST /api/v1/influencer-profiles/:profileId/fetch — プロフィールフェッチキュー追加
 *
 * 認証:
 *   /auth/instagram, /auth/instagram/callback は JWT 不要（OAuth フロー起点）
 *   /influencer-profiles/:profileId/fetch は JWT + ANALYST 以上のロールが必要
 */
@Controller()
export class InstagramController {
  private readonly logger = new Logger(InstagramController.name)

  constructor(
    private readonly instagramService: InstagramService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * GET /api/v1/auth/instagram
   *
   * Instagram OAuth 認可フローを開始する。
   * ユーザーを Instagram の認可画面にリダイレクトする。
   *
   * クエリパラメータ:
   *   state — CSRF トークンとして使用するランダム文字列（クライアント側で生成・検証）
   */
  @Get('auth/instagram')
  @UseGuards(JwtAuthGuard)
  initiateOAuth(
    @CurrentUser() user: JwtPayload,
    @Query('state') state: string | undefined,
    @Res() reply: FastifyReply,
  ): void {
    const clientId = this.configService.getOrThrow<string>('INSTAGRAM_CLIENT_ID')
    const redirectUri = this.configService.getOrThrow<string>(
      'INSTAGRAM_REDIRECT_URI',
    )

    // stateにユーザーIDを含めることでコールバック時にJWT不要で認証できる
    const stateValue = Buffer.from(
      JSON.stringify({ userId: user.sub, csrf: state ?? crypto.randomUUID() }),
    ).toString('base64url')

    const authUrl = new URL('https://www.facebook.com/v21.0/dialog/oauth')
    authUrl.searchParams.set('client_id', clientId)
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('scope', 'instagram_business_basic,pages_show_list,pages_read_engagement,business_management,ads_read')
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('state', stateValue)

    void reply.redirect(authUrl.toString(), HttpStatus.FOUND)
  }

  /**
   * GET /api/v1/auth/instagram/callback
   *
   * Instagram から返却された Authorization Code を処理する。
   * コードをトークンに交換し DB に保存した後、フロントエンドへリダイレクトする。
   *
   * クエリパラメータ:
   *   code  — Instagram が返す Authorization Code
   *   error — 認可拒否時に Instagram が返すエラーコード
   */
  @Get('auth/instagram/callback')
  async handleOAuthCallback(
    @Query('code') code: string | undefined,
    @Query('error') error: string | undefined,
    @Query('state') stateParam: string | undefined,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const frontendOrigin = this.configService.get<string>(
      'CORS_ORIGIN',
      'http://localhost:3000',
    )

    // stateからユーザーIDを復元
    let userId: string | undefined
    try {
      if (stateParam) {
        const parsed = JSON.parse(
          Buffer.from(stateParam, 'base64url').toString('utf-8'),
        ) as { userId?: string }
        userId = parsed.userId
      }
    } catch {
      this.logger.warn('OAuth callback: failed to parse state parameter')
    }

    if (!userId) {
      void reply.redirect(
        `${frontendOrigin}/settings/instagram?error=invalid_state`,
        HttpStatus.FOUND,
      )
      return
    }

    if (error || !code) {
      this.logger.warn(
        `OAuth callback error: userId=${userId} error=${error ?? 'missing_code'}`,
      )
      void reply.redirect(
        `${frontendOrigin}/settings/instagram?error=${error ?? 'missing_code'}`,
        HttpStatus.FOUND,
      )
      return
    }

    try {
      await this.instagramService.handleOAuthCallback(userId, code)
      void reply.redirect(
        `${frontendOrigin}/settings/instagram?connected=true`,
        HttpStatus.FOUND,
      )
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'unknown_error'
      this.logger.error(
        `OAuth callback failed: userId=${userId} message=${message}`,
      )
      void reply.redirect(
        `${frontendOrigin}/settings/instagram?error=oauth_failed`,
        HttpStatus.FOUND,
      )
    }
  }

  /**
   * GET /api/v1/instagram/status
   *
   * 現在のユーザーの Instagram 連携状態を返す。
   * JWT 認証必須。
   */
  @Get('instagram/status')
  @UseGuards(JwtAuthGuard)
  async getConnectionStatus(
    @CurrentUser() user: JwtPayload,
  ): Promise<{ connected: boolean; username?: string; connectedAt?: string }> {
    return this.instagramService.getConnectionStatus(user.sub)
  }

  /**
   * DELETE /api/v1/instagram/disconnect
   *
   * 現在のユーザーの Instagram トークンを削除して連携解除する。
   * JWT 認証必須。
   */
  @Delete('instagram/disconnect')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async disconnect(
    @CurrentUser() user: JwtPayload,
  ): Promise<{ message: string }> {
    await this.instagramService.disconnect(user.sub)
    return { message: 'Instagram連携を解除しました' }
  }

  /**
   * POST /api/v1/influencer-profiles/:profileId/fetch
   *
   * 対象プロフィールの Instagram データ取得をキューに追加する。
   * ANALYST 以上のロールが必要。
   *
   * @param profileId  対象の InfluencerProfile ID
   * @param user       認証済みユーザー（キューのユーザーコンテキストに使用）
   */
  @Post('influencer-profiles/:profileId/fetch')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'ANALYST')
  async enqueueFetch(
    @Param('profileId') profileId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<{ message: string; profileId: string }> {
    if (!profileId || profileId.trim().length === 0) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'profileId は必須です',
      })
    }

    await this.instagramService.enqueueProfileFetch(profileId, user.sub)

    this.logger.log(
      `Fetch enqueued: profileId=${profileId} requestedBy=${user.sub}`,
    )

    return {
      message: 'プロフィールデータ取得をキューに追加しました',
      profileId,
    }
  }
}
