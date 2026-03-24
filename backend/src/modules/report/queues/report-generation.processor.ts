import { Processor, Process } from '@nestjs/bull'
import { Logger } from '@nestjs/common'
import type { Job } from 'bull'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../../../common/prisma/prisma.service'
import { AuditLogService } from '../../../common/audit/audit-log.service'
import { PdfGeneratorService } from '../generators/pdf-generator.service'
import { CsvGeneratorService } from '../generators/csv-generator.service'
import { REPORT_GENERATION_QUEUE, type ReportJobData } from './report-generation.queue'
import type { ReportProfileData, ScoreBreakdownData } from '../types/report-profile.data'

/**
 * report-generation キューのジョブプロセッサ。
 *
 * ジョブフロー:
 *   1. Report ステータスを PROCESSING に更新
 *   2. 対象プロフィール・スナップショット・スコアデータを取得
 *   3. format に応じて PDF または CSV バイトを生成
 *   4. ファイルをディスクに書き出し
 *   5. Report ステータスを COMPLETED に更新し、filePath・fileSize・generatedAt を保存
 *   6. 監査ログを記録
 *
 * エラー時:
 *   - Report ステータスを FAILED に更新し errorMessage を保存
 *   - 例外を再スロー → BullMQ が backoff 設定に従いリトライする
 *
 * ADR-002 データ分離原則: FACT / ESTIMATED / UNAVAILABLE ラベルの付与は
 * PdfGeneratorService / CsvGeneratorService の責務であり、このプロセッサーは
 * データの収集と書き込みのみを担う。
 */
@Processor(REPORT_GENERATION_QUEUE)
export class ReportGenerationProcessor {
  private readonly logger = new Logger(ReportGenerationProcessor.name)
  private readonly outputDir: string

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly pdfGenerator: PdfGeneratorService,
    private readonly csvGenerator: CsvGeneratorService,
    private readonly auditLogService: AuditLogService,
  ) {
    this.outputDir = this.config.get<string>(
      'REPORT_OUTPUT_DIR',
      './storage/reports',
    )
  }

  @Process()
  async handleReportGeneration(job: Job<ReportJobData>): Promise<void> {
    const { reportId, userId, format, profileIds } = job.data
    this.logger.log(`Processing report: reportId=${reportId} format=${format}`)

    await this.prisma.report.update({
      where: { id: reportId },
      data: { status: 'PROCESSING' },
    })

    try {
      const profiles = await this.fetchProfileData(profileIds)
      const fileBuffer = await this.generateFileBuffer(profiles, format)
      const filePath = await this.writeFile(reportId, format, fileBuffer)

      const now = new Date()
      const expiresAt = new Date(now)
      expiresAt.setDate(expiresAt.getDate() + 7)

      await this.prisma.report.update({
        where: { id: reportId },
        data: {
          status: 'COMPLETED',
          filePath,
          fileSize: fileBuffer.byteLength,
          generatedAt: now,
          expiresAt,
        },
      })

      await this.auditLogService.log({
        userId,
        action: 'REPORT_GENERATE',
        entity: 'Report',
        entityId: reportId,
        details: { format, profileCount: profileIds.length, fileSizeBytes: fileBuffer.byteLength },
      })

      this.logger.log(`Report completed: reportId=${reportId} fileSizeBytes=${fileBuffer.byteLength}`)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      this.logger.error(`Report failed: reportId=${reportId} error=${message}`)

      await this.prisma.report.update({
        where: { id: reportId },
        data: { status: 'FAILED', errorMessage: message },
      })

      // BullMQ が backoff 設定に従いリトライするよう再スローする
      throw err
    }
  }

  // ---------------------------------------------------------------------------
  // Private: data fetching
  // ---------------------------------------------------------------------------

  private async fetchProfileData(
    profileIds: string[],
  ): Promise<ReportProfileData[]> {
    const results: ReportProfileData[] = []

    for (const profileId of profileIds) {
      const profile = await this.prisma.influencerProfile.findFirst({
        where: { id: profileId, deletedAt: null },
        include: {
          snapshots: {
            where: { deletedAt: null },
            orderBy: { fetchedAt: 'desc' },
            take: 1,
          },
          scoreRecords: {
            where: { deletedAt: null },
            orderBy: { scoredAt: 'desc' },
            take: 1,
            include: {
              breakdowns: { orderBy: { createdAt: 'asc' } },
            },
          },
        },
      })

      if (!profile) {
        this.logger.warn(`Profile ${profileId} not found — skipping`)
        continue
      }

      const snapshot = profile.snapshots[0] ?? null
      const scoreRecord = profile.scoreRecords[0] ?? null

      const breakdowns: ScoreBreakdownData[] = (
        scoreRecord?.breakdowns ?? []
      ).map((b) => ({
        category: b.category,
        score: b.score,
        weight: b.weight,
        confidence: b.confidence,
        status: b.dataType,
        rationale: b.rationale ?? '',
      }))

      results.push({
        id: profile.id,
        platform: profile.platform,
        username: profile.username,
        displayName: profile.displayName,
        profileUrl: profile.profileUrl,

        followerCount: snapshot?.followerCount ?? null,
        followerCountStatus: snapshot?.followerCountStatus ?? 'UNAVAILABLE',
        followingCount: snapshot?.followingCount ?? null,
        followingCountStatus: snapshot?.followingCountStatus ?? 'UNAVAILABLE',
        engagementRate: snapshot?.engagementRate ?? null,
        engagementRateStatus: snapshot?.engagementRateStatus ?? 'UNAVAILABLE',
        mediaCount: snapshot?.mediaCount ?? null,
        mediaCountStatus: snapshot?.mediaCountStatus ?? 'UNAVAILABLE',
        biography: snapshot?.biography ?? null,
        biographyStatus: snapshot?.biographyStatus ?? 'UNAVAILABLE',
        fetchedAt: snapshot?.fetchedAt ?? null,

        totalScore: scoreRecord?.totalScore ?? null,
        scoreConfidence: scoreRecord?.confidence ?? null,
        scoringModel: scoreRecord?.scoringModel ?? null,
        scoredAt: scoreRecord?.scoredAt ?? null,
        breakdowns,
      })
    }

    return results
  }

  // ---------------------------------------------------------------------------
  // Private: file generation
  // ---------------------------------------------------------------------------

  private async generateFileBuffer(
    profiles: ReportProfileData[],
    format: string,
  ): Promise<Buffer> {
    if (format === 'CSV') {
      return this.csvGenerator.generateCsv(profiles)
    }

    const isSingle = profiles.length === 1
    const html = isSingle
      ? this.pdfGenerator.buildSingleProfileHtml(profiles[0])
      : this.pdfGenerator.buildComparisonHtml(profiles)

    return this.pdfGenerator.generateFromHtml(html)
  }

  private async writeFile(
    reportId: string,
    format: string,
    buffer: Buffer,
  ): Promise<string> {
    await fs.mkdir(this.outputDir, { recursive: true })

    const ext = format === 'CSV' ? 'csv' : 'pdf'
    const fileName = `report-${reportId}.${ext}`
    const filePath = path.resolve(this.outputDir, fileName)

    await fs.writeFile(filePath, buffer)
    return filePath
  }
}
