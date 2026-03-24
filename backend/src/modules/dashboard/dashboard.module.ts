import { Module } from '@nestjs/common'
import { PrismaModule } from '../../common/prisma/prisma.module'
import { DashboardController } from './dashboard.controller'
import { DashboardService } from './dashboard.service'

/**
 * DashboardModule
 *
 * ダッシュボード統計エンドポイントを提供する。
 *
 * Endpoints:
 *   GET /api/v1/dashboard/stats — 認証済みユーザーの統計データ
 */
@Module({
  imports: [PrismaModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
