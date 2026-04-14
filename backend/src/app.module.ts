import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { BullModule } from '@nestjs/bull'
import { PrismaModule } from './common/prisma/prisma.module'
import { AuditLogModule } from './common/audit/audit-log.module'
import { RequestLoggerMiddleware } from './common/middleware/request-logger.middleware'
import { HealthModule } from './common/health/health.module'
import { AuthModule } from './modules/auth/auth.module'
import { InfluencerModule } from './modules/influencer/influencer.module'
import { InstagramModule } from './modules/instagram/instagram.module'
import { ScoreModule } from './modules/score/score.module'
import { ReportModule } from './modules/report/report.module'
import { DashboardModule } from './modules/dashboard/dashboard.module'
import { AdminModule } from './modules/admin/admin.module'
import { WebhookModule } from './modules/webhook/webhook.module'

@Module({
  imports: [
    // Config — global so every module can inject ConfigService
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      cache: true,
    }),

    // Prisma — global so every module can inject PrismaService
    PrismaModule,

    // AuditLog — global so every module can inject AuditLogService
    AuditLogModule,

    // BullMQ via @nestjs/bull — Redis connection from env
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        redis: {
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
          password: config.get<string>('REDIS_PASSWORD') || undefined,
        },
      }),
      inject: [ConfigService],
    }),

    // Feature modules
    HealthModule,
    AuthModule,
    InfluencerModule,
    InstagramModule,
    ScoreModule,
    ReportModule,
    DashboardModule,
    AdminModule,
    WebhookModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestLoggerMiddleware).forRoutes('*')
  }
}
