import { Processor, Process } from '@nestjs/bull'
import { Logger } from '@nestjs/common'
import type { Job } from 'bull'
import { InstagramService } from '../instagram.service'
import { InstagramRateLimitService } from '../instagram-rate-limit.service'
import { RateLimitException } from '../exceptions/rate-limit.exception'
import { INSTAGRAM_FETCH_QUEUE } from './instagram-fetch.queue'
import type { InstagramFetchJobData } from './instagram-fetch.queue'

@Processor(INSTAGRAM_FETCH_QUEUE)
export class InstagramFetchProcessor {
  private readonly logger = new Logger(InstagramFetchProcessor.name)

  constructor(
    private readonly instagramService: InstagramService,
    private readonly rateLimitService: InstagramRateLimitService,
  ) {}

  @Process()
  async handle(job: Job<InstagramFetchJobData>): Promise<void> {
    const { data } = job
    this.logger.log(`Processing job type=${data.type} jobId=${job.id}`)

    const keyUserId =
      data.type === 'TOKEN_REFRESH' ? data.userId : data.requestedByUserId

    try {
      await this.rateLimitService.runExclusive(
        data.providerVariant,
        keyUserId,
        async () => {
          switch (data.type) {
            case 'PROFILE':
              await this.instagramService.processProfileFetch(
                data.profileId,
                data.requestedByUserId,
                data.targetUsername,
                data.providerVariant,
              )
              break
            case 'MEDIA_INSIGHTS':
              await this.instagramService.fetchAndSaveMediaInsights(
                data.profileId,
                data.requestedByUserId,
                data.targetAccountId,
                data.subjectType,
                data.providerVariant,
              )
              break
            case 'TOKEN_REFRESH':
              await this.instagramService.refreshLongLivedToken(
                data.userId,
                data.providerVariant,
              )
              break
            default: {
              const _exhaustive: never = data
              this.logger.warn(
                `Unknown job type received: ${JSON.stringify(_exhaustive)}`,
              )
            }
          }
        },
      )
    } catch (error: unknown) {
      if (error instanceof RateLimitException) {
        this.logger.warn(
          `Rate limit hit on jobId=${job.id} attemptsMade=${job.attemptsMade}. Retrying after ${error.retryAfterSeconds}s.`,
        )
        throw error
      }

      this.logger.error(
        `Job failed: jobId=${job.id} type=${job.data.type} attemptsMade=${job.attemptsMade} error=${String(error)}`,
      )
      throw error
    }
  }
}
