import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bull'
import { InstagramApiClient } from './instagram-api.client'
import { InstagramService } from './instagram.service'
import { InstagramController } from './instagram.controller'
import { InstagramFetchProcessor } from './queues/instagram-fetch.processor'
import { INSTAGRAM_FETCH_QUEUE } from './queues/instagram-fetch.queue'

@Module({
  imports: [
    BullModule.registerQueue({
      name: INSTAGRAM_FETCH_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000, // 5s → 10s → 20s
        },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    }),
  ],
  providers: [InstagramApiClient, InstagramService, InstagramFetchProcessor],
  controllers: [InstagramController],
  exports: [InstagramService],
})
export class InstagramModule {}
