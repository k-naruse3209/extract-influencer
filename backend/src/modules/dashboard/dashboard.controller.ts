import { Controller, Get, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import {
  CurrentUser,
  type JwtPayload,
} from '../../common/decorators/current-user.decorator'
import { DashboardService, type DashboardStats } from './dashboard.service'

/**
 * DashboardController
 *
 * GET /api/v1/dashboard/stats
 *   認証済みユーザーのダッシュボード統計を返す。
 *   JwtAuthGuard により未認証アクセスは 401 を返す。
 */
@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  async getStats(@CurrentUser() user: JwtPayload): Promise<DashboardStats> {
    return this.dashboardService.getStats(user.sub)
  }
}
