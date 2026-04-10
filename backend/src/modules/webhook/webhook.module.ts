import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { WebhookController } from './webhook.controller'

@Module({
  imports: [ConfigModule],
  controllers: [WebhookController],
})
export class WebhookModule {}
