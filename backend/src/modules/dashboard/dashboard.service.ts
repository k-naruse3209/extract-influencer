import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../common/prisma/prisma.service'

export interface RecentSavedItem {
  id: string
  profileId: string
  username: string
  displayName: string | null
  savedAt: string
}

export interface RecentReportItem {
  id: string
  title: string
  format: string
  status: string
  createdAt: string
}

export interface DashboardStats {
  totalProfiles: number
  savedCandidates: number
  totalReports: number
  averageScore: number | null
  recentSaved: RecentSavedItem[]
  recentReports: RecentReportItem[]
}

/**
 * DashboardService
 *
 * 現在ログイン中のユーザーに関するダッシュボード統計を集約して返す。
 * averageScore は全 ScoreRecord の totalScore 平均。データが存在しない場合は null。
 */
@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats(userId: string): Promise<DashboardStats> {
    const [
      totalProfiles,
      savedCandidates,
      totalReports,
      scoreAggregate,
      recentSavedRows,
      recentReportRows,
    ] = await Promise.all([
      this.prisma.influencerProfile.count(),
      this.prisma.savedCandidate.count({ where: { userId } }),
      this.prisma.report.count({ where: { userId } }),
      this.prisma.scoreRecord.aggregate({ _avg: { totalScore: true } }),
      this.prisma.savedCandidate.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { profile: true },
      }),
      this.prisma.report.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          title: true,
          format: true,
          status: true,
          createdAt: true,
        },
      }),
    ])

    const recentSaved: RecentSavedItem[] = recentSavedRows.map((row) => ({
      id: row.id,
      profileId: row.profileId,
      username: row.profile.username,
      displayName: row.profile.displayName ?? null,
      savedAt: row.createdAt.toISOString(),
    }))

    const recentReports: RecentReportItem[] = recentReportRows.map((row) => ({
      id: row.id,
      title: row.title,
      format: row.format,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
    }))

    return {
      totalProfiles,
      savedCandidates,
      totalReports,
      averageScore: scoreAggregate._avg.totalScore ?? null,
      recentSaved,
      recentReports,
    }
  }
}
