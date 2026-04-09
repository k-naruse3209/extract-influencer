import { Injectable, OnModuleDestroy } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import Redis from 'ioredis'
import { randomUUID } from 'node:crypto'
import { sleep } from '../../common/utils/retry'
import type { InstagramProviderVariant } from './instagram.constants'

@Injectable()
export class InstagramRateLimitService implements OnModuleDestroy {
  private readonly redis: Redis
  private readonly requestIntervalMs: number
  private readonly lockTtlMs: number
  private readonly lockPollMs: number

  constructor(private readonly configService: ConfigService) {
    this.redis = new Redis({
      host: this.configService.get<string>('REDIS_HOST', 'localhost'),
      port: this.configService.get<number>('REDIS_PORT', 6379),
      password: this.configService.get<string>('REDIS_PASSWORD') || undefined,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    })

    this.requestIntervalMs = this.configService.get<number>(
      'INSTAGRAM_REQUEST_INTERVAL_MS',
      18_000,
    )
    this.lockTtlMs = this.configService.get<number>(
      'INSTAGRAM_RATE_LIMIT_LOCK_TTL_MS',
      120_000,
    )
    this.lockPollMs = this.configService.get<number>(
      'INSTAGRAM_RATE_LIMIT_LOCK_POLL_MS',
      250,
    )
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redis.status !== 'end') {
      await this.redis.quit().catch(() => undefined)
    }
  }

  async runExclusive<T>(
    providerVariant: InstagramProviderVariant,
    userId: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    const lockKey = this.buildLockKey(providerVariant, userId)
    const lockId = randomUUID()

    await this.ensureRedisConnection()

    while (true) {
      const acquired = await this.redis.set(
        lockKey,
        lockId,
        'PX',
        this.lockTtlMs,
        'NX',
      )

      if (acquired === 'OK') break
      await sleep(this.lockPollMs)
    }

    try {
      return await fn()
    } finally {
      const currentLockId = await this.redis.get(lockKey)
      if (currentLockId === lockId) {
        await this.redis.del(lockKey)
      }
    }
  }

  async waitForRequestWindow(
    providerVariant: InstagramProviderVariant,
    userId: string,
  ): Promise<void> {
    await this.ensureRedisConnection()

    const nextAllowedAtKey = this.buildNextAllowedAtKey(providerVariant, userId)
    const now = Date.now()
    const nextAllowedAt = Number((await this.redis.get(nextAllowedAtKey)) ?? '0')

    if (Number.isFinite(nextAllowedAt) && nextAllowedAt > now) {
      await sleep(nextAllowedAt - now)
    }

    const newNextAllowedAt = Date.now() + this.requestIntervalMs
    await this.redis.set(
      nextAllowedAtKey,
      String(newNextAllowedAt),
      'PX',
      this.requestIntervalMs * 2,
    )
  }

  private async ensureRedisConnection(): Promise<void> {
    if (this.redis.status === 'wait') {
      await this.redis.connect()
    }
  }

  private buildLockKey(
    providerVariant: InstagramProviderVariant,
    userId: string,
  ): string {
    return `instagram:${providerVariant}:${userId}:lock`
  }

  private buildNextAllowedAtKey(
    providerVariant: InstagramProviderVariant,
    userId: string,
  ): string {
    return `instagram:${providerVariant}:${userId}:next-allowed-at`
  }
}
