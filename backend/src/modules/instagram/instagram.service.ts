import { Injectable, Logger } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bull'
import { ConfigService } from '@nestjs/config'
import type { Queue } from 'bull'
import { PrismaService } from '../../common/prisma/prisma.service'
import { InstagramApiClient } from './instagram-api.client'
import { encryptToken, decryptToken } from '../../common/crypto/token-cipher'
import { sleep } from '../../common/utils/retry'
import {
  INSTAGRAM_FETCH_QUEUE,
  type InstagramFetchJobData,
} from './queues/instagram-fetch.queue'
import type {
  InstagramProfileData,
  InstagramMediaInsights,
  MediaStats,
} from './types/instagram-api.types'
import { InstagramApiException } from './exceptions/instagram-api.exception'
import type { DataStatus } from '@prisma/client'

/** メディアインサイト取得時に各リクエスト間に挟む最小ウェイト（ms）。
 *  Instagram Graph API は 200 calls/hour/user token。
 *  25 件のメディアで 25 回 API を叩くため、間引きで制限を回避する。 */
const MEDIA_INSIGHTS_REQUEST_INTERVAL_MS = 200

/**
 * Instagram 連携のユースケース層。
 *
 * 責務:
 * - OAuth コールバック処理（コード → トークン交換 → DB 保存）
 * - プロフィールデータ取得ジョブのエンキュー
 * - ProfileSnapshot の DB 保存
 *
 * セキュリティ:
 * - アクセストークンは AES-256-GCM 暗号化後に DB 保存。平文を保持しない。
 * - 復号したトークンはローカル変数のみで扱い、ログに出力しない。
 */
@Injectable()
export class InstagramService {
  private readonly logger = new Logger(InstagramService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly apiClient: InstagramApiClient,
    private readonly configService: ConfigService,
    @InjectQueue(INSTAGRAM_FETCH_QUEUE)
    private readonly fetchQueue: Queue<InstagramFetchJobData>,
  ) {}

  /**
   * Instagram OAuth コールバックを処理する。
   *
   * フロー:
   * 1. Authorization Code → 短命トークンに交換
   * 2. 短命トークン → 長命トークン（60 日）に交換
   * 3. InstagramToken を DB に upsert（AES-256-GCM 暗号化済み）
   *
   * @param userId  認証済みアプリユーザーの ID
   * @param code    Instagram が返却した Authorization Code
   */
  async handleOAuthCallback(userId: string, code: string): Promise<void> {
    // Facebook Login: code → short-lived token → long-lived token
    const shortLived = await this.apiClient.exchangeShortLivedToken(code)
    const longLived = await this.apiClient.exchangeLongLivedToken(
      shortLived.accessToken,
    )

    // Facebook Pages 経由で紐づいた Instagram Business Account ID を取得
    const igAccount = await this.apiClient.getInstagramBusinessAccountId(
      longLived.accessToken,
    )

    if (!igAccount) {
      throw new Error(
        'Instagram Business/Creator アカウントが見つかりません。' +
          'Facebook ページに Instagram ビジネスアカウントが紐づいているか確認してください。',
      )
    }

    const encryptionKey =
      this.configService.getOrThrow<string>('TOKEN_ENCRYPTION_KEY')
    const encryptedToken = encryptToken(longLived.accessToken, encryptionKey)

    const expiresAt = new Date(Date.now() + longLived.expiresIn * 1000)

    await this.prisma.instagramToken.upsert({
      where: { userId },
      create: {
        userId,
        encryptedToken,
        tokenType: 'USER_LONG_LIVED',
        expiresAt,
        instagramUserId: igAccount.igUserId,
        scope: 'instagram_basic,pages_show_list,pages_read_engagement,business_management',
        refreshedAt: new Date(),
      },
      update: {
        encryptedToken,
        tokenType: 'USER_LONG_LIVED',
        expiresAt,
        instagramUserId: igAccount.igUserId,
        refreshedAt: new Date(),
      },
    })

    this.logger.log(
      `OAuth token saved for userId=${userId} igUserId=${igAccount.igUserId} igUsername=${igAccount.igUsername}. expiresAt=${expiresAt.toISOString()}`,
    )
  }

  /**
   * 指定ユーザーの Instagram 連携状態を返す。
   *
   * @param userId  アプリユーザーの ID
   */
  async getConnectionStatus(userId: string): Promise<{
    connected: boolean
    username?: string
    connectedAt?: string
  }> {
    const token = await this.prisma.instagramToken.findUnique({
      where: { userId },
      select: {
        instagramUserId: true,
        refreshedAt: true,
        createdAt: true,
      },
    })

    if (token === null) {
      return { connected: false }
    }

    return {
      connected: true,
      username: token.instagramUserId ?? undefined,
      connectedAt: (token.refreshedAt ?? token.createdAt).toISOString(),
    }
  }

  /**
   * 指定ユーザーの Instagram トークンを削除して連携解除する。
   *
   * @param userId  アプリユーザーの ID
   */
  async disconnect(userId: string): Promise<void> {
    await this.prisma.instagramToken.deleteMany({
      where: { userId },
    })

    this.logger.log(`Instagram token deleted: userId=${userId}`)
  }

  /**
   * プロフィールデータ取得をキューに追加する（手動リクエスト）。
   *
   * @param profileId  InfluencerProfile の ID
   * @param userId     リクエストを送ったユーザーの ID（トークン取得に使用）
   */
  async enqueueProfileFetch(
    profileId: string,
    userId: string,
  ): Promise<void> {
    const jobData: InstagramFetchJobData = {
      type: 'PROFILE',
      profileId,
      userId,
      priority: 1,
    }

    await this.fetchQueue.add(jobData, {
      priority: 1,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      removeOnComplete: true,
      removeOnFail: false,
    })

    this.logger.log(
      `PROFILE job enqueued: profileId=${profileId} userId=${userId}`,
    )
  }

  /**
   * Instagram API から取得したプロフィールデータを ProfileSnapshot として保存する。
   *
   * PERSONAL アカウントの followerCount 等は DataStatus.UNAVAILABLE として保存する。
   * これは Instagram Graph API の仕様による制約であり、推定で補完しない。
   *
   * @param profileId  InfluencerProfile の ID
   * @param data       InstagramApiClient から取得したプロフィールデータ
   */
  async saveSnapshot(
    profileId: string,
    data: InstagramProfileData,
  ): Promise<void> {
    const isPersonalAccount = data.accountType === 'PERSONAL'
    const unavailable: DataStatus = 'UNAVAILABLE'
    const fact: DataStatus = 'FACT'

    await this.prisma.profileSnapshot.create({
      data: {
        profileId,
        dataSource: 'instagram_graph_api',
        followerCount: isPersonalAccount ? null : data.followersCount,
        followerCountStatus: isPersonalAccount ? unavailable : fact,
        followingCount: isPersonalAccount ? null : data.followsCount,
        followingCountStatus: isPersonalAccount ? unavailable : fact,
        mediaCount: data.mediaCount,
        mediaCountStatus: fact,
        biography: data.biography,
        profilePictureUrl: data.profilePictureUrl,
        externalUrl: data.website,
        rawResponse: JSON.parse(JSON.stringify(data)),
      },
    })

    this.logger.log(
      `Snapshot saved: profileId=${profileId} accountType=${data.accountType}`,
    )
  }

  /**
   * メディアインサイト取得ジョブをキューに追加する。
   *
   * @param profileId  InfluencerProfile の ID
   * @param userId     Instagram トークンを保持しているユーザーの ID
   */
  async enqueueMediaInsightsFetch(
    profileId: string,
    userId: string,
  ): Promise<void> {
    const jobData: InstagramFetchJobData = {
      type: 'MEDIA_INSIGHTS',
      profileId,
      userId,
      priority: 5,
    }

    await this.fetchQueue.add(jobData, {
      priority: 5,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 10000,
      },
      removeOnComplete: true,
      removeOnFail: false,
    })

    this.logger.log(
      `MEDIA_INSIGHTS job enqueued: profileId=${profileId} userId=${userId}`,
    )
  }

  /**
   * 最近のメディアとインサイトを取得し、ProfileSnapshot に集計値として保存する。
   *
   * フロー:
   * 1. userId から暗号化トークンを取得・復号する
   * 2. getRecentMedia() で最近 25 件を取得する
   * 3. 各メディアに対して getMediaInsightsForMedia() を呼び出す（Business/Creator のみ）
   *    - PERSONAL アカウント（error code 10, httpStatus 403）はインサイトを UNAVAILABLE として扱う
   *    - インサイト取得間に MEDIA_INSIGHTS_REQUEST_INTERVAL_MS のウェイトを入れる
   * 4. 集計データ（avgLikes, avgComments, avgReach, engagementRate）を算出し、
   *    既存の最新 ProfileSnapshot を更新する（存在しなければ新規作成する）
   *
   * @param profileId  InfluencerProfile の ID
   * @param userId     Instagram トークンを保持しているユーザーの ID
   */
  async fetchAndSaveMediaInsights(
    profileId: string,
    userId: string,
  ): Promise<void> {
    const accessToken = await this.resolveAccessToken(userId)

    // Instagram Business Account ID を取得
    const tokenRecord = await this.prisma.instagramToken.findUnique({
      where: { userId },
      select: { instagramUserId: true },
    })
    if (!tokenRecord?.instagramUserId) {
      throw new Error(
        `Instagram Business Account ID not found for userId=${userId}. Re-authentication required.`,
      )
    }

    const mediaList = await this.apiClient.getRecentMedia(accessToken, tokenRecord.instagramUserId, 25)

    if (mediaList.length === 0) {
      this.logger.log(
        `No recent media found: profileId=${profileId} userId=${userId}`,
      )
      return
    }

    const insightResults: InstagramMediaInsights[] = []
    let isPersonalAccount = false

    for (let i = 0; i < mediaList.length; i++) {
      const media = mediaList[i]

      // リクエスト間のウェイト（最初の1件を除く）
      if (i > 0) {
        await sleep(MEDIA_INSIGHTS_REQUEST_INTERVAL_MS)
      }

      try {
        const insights = await this.apiClient.getMediaInsightsForMedia(
          media.id,
          accessToken,
        )
        insightResults.push(insights)
      } catch (error: unknown) {
        if (
          error instanceof InstagramApiException &&
          error.getStatus() === 403
        ) {
          // PERSONAL アカウントはインサイト取得不可（code 10）
          isPersonalAccount = true
          this.logger.log(
            `Media insights unavailable (PERSONAL account): profileId=${profileId} mediaId=${media.id}`,
          )
          // PERSONAL アカウントと判定したら残りのメディアもスキップする
          break
        }
        // その他のエラーは個別メディアをスキップしてログに残す
        this.logger.warn(
          `Failed to fetch insights for mediaId=${media.id} profileId=${profileId}: ${String(error)}`,
        )
      }
    }

    const stats = this.aggregateMediaStats(
      mediaList,
      insightResults,
      isPersonalAccount,
    )

    await this.saveMediaStatsToSnapshot(profileId, stats)

    this.logger.log(
      `MediaInsights saved: profileId=${profileId} postCount=${stats.postCount}`,
    )
  }

  /**
   * 最新の ProfileSnapshot の followerCount を使ってエンゲージメント率を計算し、
   * 集計データを既存スナップショットに書き込む（なければ新規作成）。
   *
   * ProfileSnapshot は append-only 設計だが、メディア統計は PROFILE ジョブと
   * 独立して取得されるため、既存の最新スナップショットを UPDATE して補完する。
   * これは snapshot の「その時点のデータ」をできるだけ充実させるための例外的な UPDATE 操作であり、
   * スコアリングに渡すデータの精度向上が目的である。
   */
  private async saveMediaStatsToSnapshot(
    profileId: string,
    stats: MediaStats,
  ): Promise<void> {
    const latest = await this.prisma.profileSnapshot.findFirst({
      where: { profileId, deletedAt: null },
      orderBy: { fetchedAt: 'desc' },
      select: { id: true, followerCount: true },
    })

    const engagementRate = computeEngagementRate(
      stats.avgLikes,
      stats.avgComments,
      latest?.followerCount ?? null,
    )

    const estimatedStatus: DataStatus = 'ESTIMATED'
    const unavailableStatus: DataStatus = 'UNAVAILABLE'

    if (latest !== null) {
      await this.prisma.profileSnapshot.update({
        where: { id: latest.id },
        data: {
          avgLikesPerPost: stats.avgLikes,
          avgLikesPerPostStatus: stats.avgLikes !== null ? estimatedStatus : unavailableStatus,
          avgCommentsPerPost: stats.avgComments,
          avgCommentsPerPostStatus: stats.avgComments !== null ? estimatedStatus : unavailableStatus,
          engagementRate: engagementRate,
          engagementRateStatus: engagementRate !== null ? estimatedStatus : unavailableStatus,
          engagementRateConfidence: engagementRate !== null ? 'HIGH' : null,
        },
      })
    } else {
      // スナップショット未作成の場合は最低限のレコードを新規作成する
      await this.prisma.profileSnapshot.create({
        data: {
          profileId,
          dataSource: 'instagram_graph_api',
          avgLikesPerPost: stats.avgLikes,
          avgLikesPerPostStatus: stats.avgLikes !== null ? estimatedStatus : unavailableStatus,
          avgCommentsPerPost: stats.avgComments,
          avgCommentsPerPostStatus: stats.avgComments !== null ? estimatedStatus : unavailableStatus,
          engagementRate: engagementRate,
          engagementRateStatus: engagementRate !== null ? estimatedStatus : unavailableStatus,
          engagementRateConfidence: engagementRate !== null ? 'HIGH' : null,
          rawResponse: JSON.parse(JSON.stringify({ mediaStats: stats })),
        },
      })
    }
  }

  /**
   * メディア一覧とインサイト結果から集計統計を計算する。
   *
   * インサイトが取得できなかった（PERSONAL アカウント等）場合、
   * avgReach は null として返す（欠損値の推定補完禁止）。
   */
  private aggregateMediaStats(
    mediaList: { likeCount: number | null; commentsCount: number | null }[],
    insightResults: InstagramMediaInsights[],
    isPersonalAccount: boolean,
  ): MediaStats {
    const postCount = mediaList.length

    const totalLikes = mediaList.reduce(
      (sum, m) => (m.likeCount !== null ? sum + m.likeCount : sum),
      0,
    )
    const likesAvailable = mediaList.filter((m) => m.likeCount !== null).length
    const avgLikes = likesAvailable > 0 ? totalLikes / likesAvailable : null

    const totalComments = mediaList.reduce(
      (sum, m) => (m.commentsCount !== null ? sum + m.commentsCount : sum),
      0,
    )
    const commentsAvailable = mediaList.filter(
      (m) => m.commentsCount !== null,
    ).length
    const avgComments =
      commentsAvailable > 0 ? totalComments / commentsAvailable : null

    let avgReach: number | null = null
    if (!isPersonalAccount && insightResults.length > 0) {
      const reachValues = insightResults
        .map((i) => i.reach)
        .filter((r): r is number => r !== null)
      avgReach = reachValues.length > 0
        ? reachValues.reduce((a, b) => a + b, 0) / reachValues.length
        : null
    }

    return {
      avgLikes,
      avgComments,
      avgReach,
      postCount,
      engagementRate: null, // followerCount が必要なため saveMediaStatsToSnapshot で計算する
    }
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

/**
 * エンゲージメント率を計算する純粋関数。
 * 分母（followerCount）が 0 以下または null の場合は null を返す。
 */
function computeEngagementRate(
  avgLikes: number | null,
  avgComments: number | null,
  followerCount: number | null,
): number | null {
  if (followerCount === null || followerCount <= 0) return null
  if (avgLikes === null && avgComments === null) return null
  const likes = avgLikes ?? 0
  const comments = avgComments ?? 0
  return (likes + comments) / followerCount
}
