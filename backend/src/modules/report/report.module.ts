import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bull'
import { ConfigModule } from '@nestjs/config'
import { PrismaModule } from '../../common/prisma/prisma.module'
import { ReportController } from './report.controller'
import { ReportService } from './report.service'
import { PdfGeneratorService } from './generators/pdf-generator.service'
import { CsvGeneratorService } from './generators/csv-generator.service'
import { ReportGenerationProcessor } from './queues/report-generation.processor'
import { REPORT_GENERATION_QUEUE } from './queues/report-generation.queue'

/**
 * ReportModule
 *
 * Provides PDF and CSV report generation for influencer profiles.
 *
 * Endpoints:
 *   POST   /api/v1/reports              — trigger generation (ANALYST+)
 *   GET    /api/v1/reports              — list own reports
 *   GET    /api/v1/reports/:id          — status / metadata
 *   GET    /api/v1/reports/:id/download — download generated file
 *
 * Architecture notes:
 *   - Report generation is processed asynchronously via BullMQ.
 *   - POST /api/v1/reports returns immediately with status PENDING.
 *   - Clients poll GET /api/v1/reports/:id to track PROCESSING → COMPLETED / FAILED.
 *   - PdfGeneratorService wraps Puppeteer (headless Chromium).
 *   - CsvGeneratorService uses csv-stringify with streaming support.
 *   - File I/O is owned exclusively by ReportGenerationProcessor.
 *
 * ADR reference: ADR-002 data-separation principle is enforced in all
 * generated output (FACT / ESTIMATED / UNAVAILABLE labels).
 */
@Module({
  imports: [
    PrismaModule,
    ConfigModule,
    BullModule.registerQueue({
      name: REPORT_GENERATION_QUEUE,
      defaultJobOptions: {
        attempts: 2,
        backoff: {
          type: 'exponential',
          delay: 10000, // 10s → 20s
        },
        removeOnComplete: 50,
        removeOnFail: 20,
      },
    }),
  ],
  controllers: [ReportController],
  providers: [
    ReportService,
    PdfGeneratorService,
    CsvGeneratorService,
    ReportGenerationProcessor,
  ],
  exports: [ReportService],
})
export class ReportModule {}
