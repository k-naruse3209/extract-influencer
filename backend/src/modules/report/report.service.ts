import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common'
import { InjectQueue } from '@nestjs/bull'
import type { Queue } from 'bull'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../../common/prisma/prisma.service'
import { AuditLogService } from '../../common/audit/audit-log.service'
import { PdfGeneratorService } from './generators/pdf-generator.service'
import { CsvGeneratorService } from './generators/csv-generator.service'
import {
  REPORT_GENERATION_QUEUE,
  type ReportJobData,
} from './queues/report-generation.queue'
import type { CreateReportDto } from './dto/create-report.dto'
import type { ReportResponse } from './types/report.response'

/**
 * ReportService
 *
 * Orchestrates report generation:
 *   1. Create a PENDING Report row in the DB
 *   2. Enqueue a report-generation job (BullMQ)
 *   3. Return the PENDING record immediately — clients poll status via GET /reports/:id
 *
 * File I/O and the actual generation pipeline are delegated to
 * ReportGenerationProcessor, which runs in the background.
 *
 * Security note: filePath is an internal absolute path and is never
 * exposed directly in API responses (see ReportResponse type).
 */
@Injectable()
export class ReportService {
  private readonly logger = new Logger(ReportService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly pdfGenerator: PdfGeneratorService,
    private readonly csvGenerator: CsvGeneratorService,
    private readonly auditLogService: AuditLogService,
    @InjectQueue(REPORT_GENERATION_QUEUE)
    private readonly reportQueue: Queue<ReportJobData>,
  ) {}

  /**
   * Accept a report generation request, persist a PENDING record, enqueue a
   * background job, and return the PENDING response immediately.
   *
   * Clients must poll GET /api/v1/reports/:id to observe the
   * PENDING → PROCESSING → COMPLETED / FAILED transition.
   */
  async create(userId: string, dto: CreateReportDto): Promise<ReportResponse> {
    const title =
      dto.title ??
      `${dto.reportType} ${dto.format} ${new Date().toISOString()}`

    // 1. Persist PENDING record so the client can poll status immediately
    const report = await this.prisma.report.create({
      data: {
        userId,
        reportType: dto.reportType,
        format: dto.format,
        title,
        status: 'PENDING',
        metadata: { profileIds: dto.profileIds },
      },
    })

    // 2. Enqueue the generation job — processor runs asynchronously
    const jobData: ReportJobData = {
      reportId: report.id,
      userId,
      format: dto.format as 'PDF' | 'CSV',
      profileIds: dto.profileIds,
    }
    await this.reportQueue.add(jobData, { priority: 1 })

    this.logger.log(
      `Report job enqueued: reportId=${report.id} format=${dto.format} profileCount=${dto.profileIds.length}`,
    )

    // 3. Return PENDING record immediately
    return mapReportToResponse(report)
  }

  /**
   * List all non-deleted reports owned by userId, newest first.
   */
  async findAll(userId: string): Promise<ReportResponse[]> {
    const records = await this.prisma.report.findMany({
      where: { userId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    })
    return records.map(mapReportToResponse)
  }

  /**
   * Return a single report owned by userId.
   * Throws NotFoundException if the record does not exist or is deleted.
   * Throws ForbiddenException if the record belongs to another user.
   */
  async findById(userId: string, id: string): Promise<ReportResponse> {
    const record = await this.prisma.report.findFirst({
      where: { id, deletedAt: null },
    })

    if (!record) {
      throw new NotFoundException({
        code: 'REPORT_NOT_FOUND',
        message: `Report "${id}" was not found`,
      })
    }

    if (record.userId !== userId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'You do not have access to this report',
      })
    }

    return mapReportToResponse(record)
  }

  /**
   * Return the absolute file path of a completed report.
   * Validates ownership and COMPLETED status before returning.
   */
  async getFilePath(userId: string, id: string): Promise<string> {
    const report = await this.findById(userId, id)

    if (report.status !== 'COMPLETED') {
      throw new NotFoundException({
        code: 'REPORT_NOT_READY',
        message: `Report "${id}" is not yet completed (status: ${report.status})`,
      })
    }

    const record = await this.prisma.report.findFirst({
      where: { id, deletedAt: null },
      select: { filePath: true },
    })

    if (!record?.filePath) {
      throw new InternalServerErrorException({
        code: 'REPORT_FILE_MISSING',
        message: `Report "${id}" is marked COMPLETED but has no filePath`,
      })
    }

    return record.filePath
  }
}

// ---------------------------------------------------------------------------
// Mapper (module-private)
// ---------------------------------------------------------------------------

function mapReportToResponse(record: {
  id: string
  userId: string
  reportType: string
  format: string
  title: string
  status: string
  fileSize: number | null
  errorMessage: string | null
  generatedAt: Date | null
  expiresAt: Date | null
  createdAt: Date
  updatedAt: Date
}): ReportResponse {
  return {
    id: record.id,
    userId: record.userId,
    reportType: record.reportType,
    format: record.format,
    title: record.title,
    status: record.status,
    fileSize: record.fileSize,
    errorMessage: record.errorMessage,
    generatedAt: record.generatedAt?.toISOString() ?? null,
    expiresAt: record.expiresAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}
