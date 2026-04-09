import { Injectable, Logger } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bull'
import { ConfigService } from '@nestjs/config'
import type { Queue } from 'bull'
import type { DataStatus } from '@prisma/client'
import { Prisma } from '@prisma/client'
import { randomUUID } from 'node:crypto'
import { PrismaService } from '../../common/prisma/prisma.service'
import { encryptToken, decryptToken } from '../../common/crypto/token-cipher'
import { InstagramOfficialProvider } from './providers/instagram-official.provider'
import { InstagramRateLimitService } from './instagram-rate-limit.service'
import {
  INSTAGRAM_FETCH_QUEUE,
  type InstagramFetchJobData,
} from './queues/instagram-fetch.queue'
import type {
  InstagramMediaInsights,
  InstagramProfileData,
  MediaStats,
} from './types/instagram-api.types'
import {
  INSTAGRAM_PROVIDER_VARIANT,
  INSTAGRAM_SUBJECT_TYPES,
  INSTAGRAM_TOKEN_STATUSES,
  type InstagramProviderVariant,
  type InstagramSubjectType,
  type InstagramTokenStatus,
} from './instagram.constants'
import { InstagramApiException } from './exceptions/instagram-api.exception'

type SnapshotMetadata = {
  providerVariant: InstagramProviderVariant
  subjectType: InstagramSubjectType
  providerPayload: unknown
}

type ConnectionStatusResponse = {
  connected: boolean
  username?: string
  connectedAt?: string
  provider?: string
  scopes?: string[]
  expiresAt?: string
  tokenStatus?: string
}

@Injectable()
export class InstagramService {
  private readonly logger = new Logger(InstagramService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly provider: InstagramOfficialProvider,
    private readonly configService: ConfigService,
    private readonly rateLimitService: InstagramRateLimitService,
    @InjectQueue(INSTAGRAM_FETCH_QUEUE)
    private readonly fetchQueue: Queue<InstagramFetchJobData>,
  ) {}

  getAuthorizationUrl(userId: string, csrf?: string): string {
    return this.provider.buildAuthorizationUrl(
      userId,
      csrf ?? randomUUID(),
    )
  }

  async handleOAuthCallback(userId: string, code: string): Promise<void> {
    const tokenExchange = await this.provider.exchangeCode(code)
    const connectedAccount = await this.provider.getConnectedAccount(
      tokenExchange.accessToken,
    )

    const encryptionKey =
      this.configService.getOrThrow<string>('TOKEN_ENCRYPTION_KEY')
    const encryptedToken = encryptToken(tokenExchange.accessToken, encryptionKey)
    const expiresAt = new Date(Date.now() + tokenExchange.expiresIn * 1000)
    const grantedScopes = tokenExchange.grantedScopes.join(',')

    await this.prisma.instagramToken.upsert({
      where: { userId },
      create: {
        userId,
        encryptedToken,
        tokenType: 'USER_LONG_LIVED',
        providerVariant: INSTAGRAM_PROVIDER_VARIANT,
        grantedScopes,
        tokenStatus: INSTAGRAM_TOKEN_STATUSES.ACTIVE,
        lastValidatedAt: new Date(),
        expiresAt,
        instagramUserId: connectedAccount.id,
        instagramUsername: connectedAccount.username,
        scope: grantedScopes,
        refreshedAt: new Date(),
      },
      update: {
        encryptedToken,
        tokenType: 'USER_LONG_LIVED',
        providerVariant: INSTAGRAM_PROVIDER_VARIANT,
        grantedScopes,
        tokenStatus: INSTAGRAM_TOKEN_STATUSES.ACTIVE,
        lastValidatedAt: new Date(),
        expiresAt,
        instagramUserId: connectedAccount.id,
        instagramUsername: connectedAccount.username,
        scope: grantedScopes,
        refreshedAt: new Date(),
      },
    })

    this.logger.log(
      `OAuth token saved for userId=${userId} igUserId=${connectedAccount.id} igUsername=${connectedAccount.username}. expiresAt=${expiresAt.toISOString()}`,
    )
  }

  async getConnectionStatus(userId: string): Promise<ConnectionStatusResponse> {
    const token = await this.prisma.instagramToken.findUnique({
      where: { userId },
      select: {
        instagramUserId: true,
        instagramUsername: true,
        refreshedAt: true,
        createdAt: true,
        providerVariant: true,
        grantedScopes: true,
        expiresAt: true,
        tokenStatus: true,
      },
    })

    if (token === null) {
      return { connected: false }
    }

    const tokenStatus = deriveTokenStatus(token.expiresAt, token.tokenStatus)

    return {
      connected: true,
      username: token.instagramUsername ?? token.instagramUserId ?? undefined,
      connectedAt: (token.refreshedAt ?? token.createdAt).toISOString(),
      provider: token.providerVariant ?? INSTAGRAM_PROVIDER_VARIANT,
      scopes: splitScopes(token.grantedScopes),
      expiresAt: token.expiresAt.toISOString(),
      tokenStatus,
    }
  }

  async disconnect(userId: string): Promise<void> {
    await this.prisma.instagramToken.deleteMany({
      where: { userId },
    })

    this.logger.log(`Instagram token deleted: userId=${userId}`)
  }

  async enqueueProfileFetch(
    profileId: string,
    requestedByUserId: string,
  ): Promise<void> {
    const profile = await this.prisma.influencerProfile.findUnique({
      where: { id: profileId },
      select: { id: true, username: true },
    })

    if (!profile) {
      throw new Error(`InfluencerProfile not found: ${profileId}`)
    }

    const jobData: InstagramFetchJobData = {
      type: 'PROFILE',
      profileId,
      requestedByUserId,
      targetUsername: profile.username,
      providerVariant: INSTAGRAM_PROVIDER_VARIANT,
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
      `PROFILE job enqueued: profileId=${profileId} requestedByUserId=${requestedByUserId}`,
    )
  }

  async processProfileFetch(
    profileId: string,
    requestedByUserId: string,
    targetUsername: string,
    providerVariant: InstagramProviderVariant,
  ): Promise<void> {
    const accessToken = await this.resolveAccessToken(requestedByUserId)

    await this.rateLimitService.waitForRequestWindow(
      providerVariant,
      requestedByUserId,
    )
    const connectedAccount = await this.provider.getConnectedAccount(accessToken)

    await this.rateLimitService.waitForRequestWindow(
      providerVariant,
      requestedByUserId,
    )
    const profileData = await this.provider.fetchTargetProfile(
      targetUsername,
      connectedAccount.id,
      accessToken,
    )

    const subjectType: InstagramSubjectType =
      profileData.id === connectedAccount.id
        ? INSTAGRAM_SUBJECT_TYPES.CONNECTED_ACCOUNT
        : INSTAGRAM_SUBJECT_TYPES.TARGET_PROFILE

    await this.saveSnapshot(profileId, profileData, {
      providerVariant,
      subjectType,
      providerPayload: profileData,
    })

    if (profileData.name) {
      await this.prisma.influencerProfile.update({
        where: { id: profileId },
        data: { displayName: profileData.name },
      })
    }

    await this.enqueueMediaInsightsFetch(
      profileId,
      requestedByUserId,
      profileData.id,
      subjectType,
      providerVariant,
    )

    this.logger.log(
      `ProfileSnapshot saved: profileId=${profileId} username=${targetUsername} subjectType=${subjectType}`,
    )
  }

  async saveSnapshot(
    profileId: string,
    data: InstagramProfileData,
    metadata: SnapshotMetadata = {
      providerVariant: INSTAGRAM_PROVIDER_VARIANT,
      subjectType: INSTAGRAM_SUBJECT_TYPES.TARGET_PROFILE,
      providerPayload: data,
    },
  ): Promise<void> {
    const isPersonalAccount = data.accountType === 'PERSONAL'
    const unavailable: DataStatus = 'UNAVAILABLE'
    const fact: DataStatus = 'FACT'

    await this.prisma.profileSnapshot.create({
      data: {
        profileId,
        dataSource: 'instagram_graph_api',
        providerVariant: metadata.providerVariant,
        subjectType: metadata.subjectType,
        followerCount: isPersonalAccount ? null : data.followersCount,
        followerCountStatus: isPersonalAccount ? unavailable : fact,
        followingCount: isPersonalAccount ? null : data.followsCount,
        followingCountStatus: isPersonalAccount ? unavailable : fact,
        mediaCount: data.mediaCount,
        mediaCountStatus: fact,
        biography: data.biography,
        profilePictureUrl: data.profilePictureUrl,
        externalUrl: data.website,
        rawResponse: {
          providerVariant: metadata.providerVariant,
          subjectType: metadata.subjectType,
          providerPayload: toJsonValue(metadata.providerPayload),
          normalizedPayload: toJsonValue(data),
        },
      },
    })

    this.logger.log(
      `Snapshot saved: profileId=${profileId} accountType=${data.accountType} subjectType=${metadata.subjectType}`,
    )
  }

  async enqueueMediaInsightsFetch(
    profileId: string,
    requestedByUserId: string,
    targetAccountId: string,
    subjectType: InstagramSubjectType,
    providerVariant: InstagramProviderVariant = INSTAGRAM_PROVIDER_VARIANT,
  ): Promise<void> {
    const jobData: InstagramFetchJobData = {
      type: 'MEDIA_INSIGHTS',
      profileId,
      requestedByUserId,
      targetAccountId,
      subjectType,
      providerVariant,
      priority: 5,
    }

    await this.fetchQueue.add(jobData, {
      priority: 5,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 10_000,
      },
      removeOnComplete: true,
      removeOnFail: false,
    })

    this.logger.log(
      `MEDIA_INSIGHTS job enqueued: profileId=${profileId} subjectType=${subjectType} targetAccountId=${targetAccountId}`,
    )
  }

  async fetchAndSaveMediaInsights(
    profileId: string,
    requestedByUserId: string,
    targetAccountId: string,
    subjectType: InstagramSubjectType,
    providerVariant: InstagramProviderVariant,
  ): Promise<void> {
    if (subjectType !== INSTAGRAM_SUBJECT_TYPES.CONNECTED_ACCOUNT) {
      await this.saveUnavailableMediaStatsToSnapshot(
        profileId,
        providerVariant,
        subjectType,
        'requires_account_owner_consent',
      )
      return
    }

    const accessToken = await this.resolveAccessToken(requestedByUserId)

    await this.rateLimitService.waitForRequestWindow(
      providerVariant,
      requestedByUserId,
    )
    const mediaList = await this.provider.fetchTargetMedia(
      targetAccountId,
      accessToken,
      25,
    )

    if (mediaList.length === 0) {
      this.logger.log(
        `No recent media found: profileId=${profileId} requestedByUserId=${requestedByUserId}`,
      )
      return
    }

    const insightResults: InstagramMediaInsights[] = []
    for (const media of mediaList) {
      await this.rateLimitService.waitForRequestWindow(
        providerVariant,
        requestedByUserId,
      )

      try {
        const insights = await this.provider.fetchMediaInsights(
          media.id,
          accessToken,
        )
        insightResults.push(insights)
      } catch (error: unknown) {
        if (
          error instanceof InstagramApiException &&
          error.getStatus() === 403
        ) {
          await this.saveUnavailableMediaStatsToSnapshot(
            profileId,
            providerVariant,
            subjectType,
            'insights_not_available_for_account',
          )
          return
        }

        this.logger.warn(
          `Failed to fetch insights for mediaId=${media.id} profileId=${profileId}: ${String(error)}`,
        )
      }
    }

    const stats = this.aggregateMediaStats(mediaList, insightResults)
    await this.saveMediaStatsToSnapshot(profileId, stats, {
      providerVariant,
      subjectType,
      providerPayload: {
        mediaList,
        insightResults,
      },
    })

    this.logger.log(
      `MediaInsights saved: profileId=${profileId} postCount=${stats.postCount}`,
    )
  }

  async refreshLongLivedToken(
    userId: string,
    providerVariant: InstagramProviderVariant,
  ): Promise<void> {
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

    try {
      await this.rateLimitService.waitForRequestWindow(providerVariant, userId)
      const refreshed = await this.provider.refreshToken(currentToken)
      const newEncryptedToken = encryptToken(refreshed.accessToken, encryptionKey)
      const expiresAt = new Date(Date.now() + refreshed.expiresIn * 1000)

      await this.prisma.instagramToken.update({
        where: { userId },
        data: {
          encryptedToken: newEncryptedToken,
          tokenType: 'USER_LONG_LIVED',
          providerVariant,
          grantedScopes: refreshed.grantedScopes.join(','),
          tokenStatus: INSTAGRAM_TOKEN_STATUSES.ACTIVE,
          lastValidatedAt: new Date(),
          expiresAt,
          refreshedAt: new Date(),
        },
      })
    } catch (error) {
      await this.prisma.instagramToken.update({
        where: { userId },
        data: {
          tokenStatus: INSTAGRAM_TOKEN_STATUSES.REAUTH_REQUIRED,
        },
      })
      throw error
    }
  }

  private async saveMediaStatsToSnapshot(
    profileId: string,
    stats: MediaStats,
    metadata: SnapshotMetadata,
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

    const data = {
      avgLikesPerPost: stats.avgLikes,
      avgLikesPerPostStatus:
        stats.avgLikes !== null ? estimatedStatus : unavailableStatus,
      avgCommentsPerPost: stats.avgComments,
      avgCommentsPerPostStatus:
        stats.avgComments !== null ? estimatedStatus : unavailableStatus,
      engagementRate,
      engagementRateStatus:
        engagementRate !== null ? estimatedStatus : unavailableStatus,
      engagementRateConfidence: engagementRate !== null ? ('HIGH' as const) : null,
      providerVariant: metadata.providerVariant,
      subjectType: metadata.subjectType,
      rawResponse: {
        providerVariant: metadata.providerVariant,
        subjectType: metadata.subjectType,
        providerPayload: toJsonValue(metadata.providerPayload),
        normalizedPayload: toJsonValue({
          ...stats,
          engagementRate,
        }),
      },
    }

    if (latest !== null) {
      await this.prisma.profileSnapshot.update({
        where: { id: latest.id },
        data,
      })
      return
    }

    await this.prisma.profileSnapshot.create({
      data: {
        profileId,
        dataSource: 'instagram_graph_api',
        ...data,
      },
    })
  }

  private async saveUnavailableMediaStatsToSnapshot(
    profileId: string,
    providerVariant: InstagramProviderVariant,
    subjectType: InstagramSubjectType,
    reason: string,
  ): Promise<void> {
    const unavailableStatus: DataStatus = 'UNAVAILABLE'

    const latest = await this.prisma.profileSnapshot.findFirst({
      where: { profileId, deletedAt: null },
      orderBy: { fetchedAt: 'desc' },
      select: { id: true },
    })

    const data = {
      avgLikesPerPost: null,
      avgLikesPerPostStatus: unavailableStatus,
      avgCommentsPerPost: null,
      avgCommentsPerPostStatus: unavailableStatus,
      engagementRate: null,
      engagementRateStatus: unavailableStatus,
      engagementRateConfidence: null,
      providerVariant,
      subjectType,
      rawResponse: {
        providerVariant,
        subjectType,
        providerPayload: { reason },
        normalizedPayload: {
          reason,
        },
      },
    }

    if (latest) {
      await this.prisma.profileSnapshot.update({
        where: { id: latest.id },
        data,
      })
      return
    }

    await this.prisma.profileSnapshot.create({
      data: {
        profileId,
        dataSource: 'instagram_graph_api',
        ...data,
      },
    })
  }

  private aggregateMediaStats(
    mediaList: { likeCount: number | null; commentsCount: number | null }[],
    insightResults: InstagramMediaInsights[],
  ): MediaStats {
    const postCount = mediaList.length

    const totalLikes = mediaList.reduce(
      (sum, media) => (media.likeCount !== null ? sum + media.likeCount : sum),
      0,
    )
    const likesAvailable = mediaList.filter(
      (media) => media.likeCount !== null,
    ).length
    const avgLikes = likesAvailable > 0 ? totalLikes / likesAvailable : null

    const totalComments = mediaList.reduce(
      (sum, media) =>
        media.commentsCount !== null ? sum + media.commentsCount : sum,
      0,
    )
    const commentsAvailable = mediaList.filter(
      (media) => media.commentsCount !== null,
    ).length
    const avgComments =
      commentsAvailable > 0 ? totalComments / commentsAvailable : null

    const reachValues = insightResults
      .map((insight) => insight.reach)
      .filter((reach): reach is number => reach !== null)

    return {
      avgLikes,
      avgComments,
      avgReach:
        reachValues.length > 0
          ? reachValues.reduce((total, reach) => total + reach, 0) /
            reachValues.length
          : null,
      postCount,
      engagementRate: null,
    }
  }

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
      await this.prisma.instagramToken.update({
        where: { userId },
        data: {
          tokenStatus: INSTAGRAM_TOKEN_STATUSES.REAUTH_REQUIRED,
        },
      })
      throw new Error(
        `Instagram token expired for userId=${userId}. TOKEN_REFRESH job required.`,
      )
    }

    const encryptionKey =
      this.configService.getOrThrow<string>('TOKEN_ENCRYPTION_KEY')

    return decryptToken(tokenRecord.encryptedToken, encryptionKey)
  }
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue
}

function splitScopes(value: string | null | undefined): string[] | undefined {
  if (!value) return undefined

  const scopes = value
    .split(',')
    .map((scope) => scope.trim())
    .filter(Boolean)

  return scopes.length > 0 ? scopes : undefined
}

function deriveTokenStatus(
  expiresAt: Date,
  storedStatus: string | null | undefined,
): InstagramTokenStatus {
  if (expiresAt < new Date()) {
    return INSTAGRAM_TOKEN_STATUSES.REAUTH_REQUIRED
  }

  if (
    storedStatus === INSTAGRAM_TOKEN_STATUSES.ACTIVE ||
    storedStatus === INSTAGRAM_TOKEN_STATUSES.REAUTH_REQUIRED ||
    storedStatus === INSTAGRAM_TOKEN_STATUSES.ERROR
  ) {
    return storedStatus
  }

  return INSTAGRAM_TOKEN_STATUSES.ACTIVE
}

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
