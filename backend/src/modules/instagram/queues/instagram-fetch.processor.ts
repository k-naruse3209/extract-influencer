import { Processor, Process } from '@nestjs/bull'
import { Logger } from '@nestjs/common'
import type { Job } from 'bull'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../../../common/prisma/prisma.service'
import { InstagramApiClient } from '../instagram-api.client'
import { InstagramService } from '../instagram.service'
import { RateLimitException } from '../exceptions/rate-limit.exception'
import { decryptToken, encryptToken } from '../../../common/crypto/token-cipher'
import { INSTAGRAM_FETCH_QUEUE } from './instagram-fetch.queue'
import type { InstagramFetchJobData } from './instagram-fetch.queue'
import type { DataStatus } from '@prisma/client'

/**
 * instagram-fetch キューのジョブプロセッサ。
 *
 * ジョブ種別:
 *   PROFILE       → InstagramApiClient.getProfile → ProfileSnapshot 保存
 *   MEDIA_INSIGHTS → 現在は PROFILE に集約（将来拡張用）
 *   TOKEN_REFRESH → 長命トークン再取得 → InstagramToken 更新
 *
 * レート制限時の挙動:
 *   RateLimitException をキャッチし、job.moveToDelayed で 60 秒後に再試行する。
 *   再試行上限は BullMQ のデフォルト（attempts: 3）に従う。
 *
 * セキュリティ:
 *   復号したアクセストークンはローカル変数に保持し、ログに出力しない。
 */
@Processor(INSTAGRAM_FETCH_QUEUE)
export class InstagramFetchProcessor {
  private readonly logger = new Logger(InstagramFetchProcessor.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly apiClient: InstagramApiClient,
    private readonly configService: ConfigService,
    private readonly instagramService: InstagramService,
  ) {}

  @Process()
  async handle(job: Job<InstagramFetchJobData>): Promise<void> {
    const { data } = job
    this.logger.log(`Processing job type=${data.type} jobId=${job.id}`)

    try {
      switch (data.type) {
        case 'PROFILE':
          await this.handleProfileFetch(data.profileId, data.userId)
          break
        case 'MEDIA_INSIGHTS':
          await this.handleMediaInsights(data.profileId, data.userId)
          break
        case 'TOKEN_REFRESH':
          await this.handleTokenRefresh(data.userId)
          break
        default: {
          const _exhaustive: never = data
          this.logger.warn(`Unknown job type received: ${JSON.stringify(_exhaustive)}`)
        }
      }
    } catch (error: unknown) {
      if (error instanceof RateLimitException) {
        this.logger.warn(
          `Rate limit hit on jobId=${job.id} attemptsMade=${job.attemptsMade}. ` +
            `Retrying after ${error.retryAfterSeconds}s. BullMQ will handle backoff.`,
        )
        // BullMQ の backoff 設定によるリトライに委ねる
        throw error
      }
      this.logger.error(
        `Job failed: jobId=${job.id} type=${job.data.type} attemptsMade=${job.attemptsMade} error=${String(error)}`,
      )
      throw error
    }
  }

  // ---------------------------------------------------------------------------
  // Job handlers
  // ---------------------------------------------------------------------------

  private async handleProfileFetch(
    profileId: string,
    userId: string,
  ): Promise<void> {
    const accessToken = await this.resolveAccessToken(userId)

    // DB からターゲットの username を取得
    const profile = await this.prisma.influencerProfile.findUnique({
      where: { id: profileId },
    })

    if (!profile) {
      throw new Error(`InfluencerProfile not found: ${profileId}`)
    }

    // OAuth 連携した自分の Instagram Business Account ID を取得
    const tokenRecord = await this.prisma.instagramToken.findUnique({
      where: { userId },
    })
    const myIgUserId = tokenRecord?.instagramUserId ?? null

    if (!myIgUserId) {
      throw new Error(
        `Instagram Business Account ID not found for userId=${userId}. Re-authentication required.`,
      )
    }

    // Business Discovery API で対象アカウントのプロフィールを取得する。
    // 開発モードではAdvanced Accessがないため Business Discovery が失敗する場合がある。
    // その場合、対象が自分のアカウントならIG User IDで直接取得する。
    // 他人のアカウントの場合はエラーを投げる（自分のデータで上書きしない）。
    let profileData
    try {
      profileData = await this.apiClient.getProfileByUsername(
        accessToken,
        profile.username,
        myIgUserId,
      )
    } catch (err) {
      this.logger.warn(
        `Business Discovery failed for ${profile.username}: ${String(err)}`,
      )

      // 自分のアカウントかどうかを確認（username が一致する場合のみフォールバック）
      const myProfile = await this.apiClient.getProfileByIgUserId(
        accessToken,
        myIgUserId,
      )

      if (myProfile.username.toLowerCase() === profile.username.toLowerCase()) {
        profileData = myProfile
      } else {
        throw new Error(
          `Business Discovery API でのデータ取得に失敗しました（対象: @${profile.username}）。` +
            '対象アカウントがビジネス/クリエイターアカウントであること、' +
            'またはアプリが instagram_business_basic の権限を持つことを確認してください。',
        )
      }
    }

    const isPersonalAccount = profileData.accountType === 'PERSONAL'

    const unavailableStatus: DataStatus = 'UNAVAILABLE'
    const factStatus: DataStatus = 'FACT'

    await this.prisma.profileSnapshot.create({
      data: {
        profileId,
        dataSource: 'instagram_graph_api',
        followerCount: isPersonalAccount ? null : profileData.followersCount,
        followerCountStatus: isPersonalAccount
          ? unavailableStatus
          : factStatus,
        followingCount: isPersonalAccount ? null : profileData.followsCount,
        followingCountStatus: isPersonalAccount
          ? unavailableStatus
          : factStatus,
        mediaCount: profileData.mediaCount,
        mediaCountStatus: factStatus,
        biography: profileData.biography,
        profilePictureUrl: profileData.profilePictureUrl,
        externalUrl: profileData.website,
        rawResponse: JSON.parse(JSON.stringify(profileData)),
      },
    })

    // displayName も更新
    if (profileData.name) {
      await this.prisma.influencerProfile.update({
        where: { id: profileId },
        data: { displayName: profileData.name },
      })
    }

    this.logger.log(
      `ProfileSnapshot saved: profileId=${profileId} username=${profile.username} accountType=${profileData.accountType}`,
    )
  }

  private async handleMediaInsights(
    profileId: string,
    userId: string,
  ): Promise<void> {
    await this.instagramService.fetchAndSaveMediaInsights(profileId, userId)
  }

  private async handleTokenRefresh(userId: string): Promise<void> {
    const tokenRecord = await this.prisma.instagramToken.findUnique({
      where: { userId },
    })

    if (!tokenRecord) {
      this.logger.warn(`TOKEN_REFRESH: no token found for userId=${userId}`)
      return
    }

    const encryptionKey =
      this.configService.getOrThrow<string>('TOKEN_ENCRYPTION_KEY')
    const currentToken = decryptToken(tokenRecord.encryptedToken, encryptionKey)

    const refreshed =
      await this.apiClient.exchangeLongLivedToken(currentToken)

    const newEncryptedToken = encryptToken(refreshed.accessToken, encryptionKey)
    const expiresAt = new Date(Date.now() + refreshed.expiresIn * 1000)

    await this.prisma.instagramToken.update({
      where: { userId },
      data: {
        encryptedToken: newEncryptedToken,
        tokenType: 'USER_LONG_LIVED',
        expiresAt,
        refreshedAt: new Date(),
      },
    })

    this.logger.log(
      `Token refreshed for userId=${userId}. New expiresAt=${expiresAt.toISOString()}`,
    )
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async resolveAccessToken(userId: string): Promise<string> {
    const tokenRecord = await this.prisma.instagramToken.findUnique({
      where: { userId },
    })

    if (!tokenRecord) {
      throw new Error(
        `Instagram token not found for userId=${userId}. OAuth consent required.`,
      )
    }

    if (tokenRecord.expiresAt < new Date()) {
      throw new Error(
        `Instagram token expired for userId=${userId}. TOKEN_REFRESH job required.`,
      )
    }

    const encryptionKey =
      this.configService.getOrThrow<string>('TOKEN_ENCRYPTION_KEY')

    return decryptToken(tokenRecord.encryptedToken, encryptionKey)
  }
}
