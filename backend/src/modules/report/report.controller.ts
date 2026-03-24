import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Res,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common'
import * as fs from 'node:fs'
import type { FastifyReply } from 'fastify'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import type { JwtPayload } from '../../common/decorators/current-user.decorator'
import { ReportService } from './report.service'
import {
  CreateReportSchema,
  type CreateReportDto,
} from './dto/create-report.dto'
import type { ReportResponse } from './types/report.response'

/**
 * Validate a request body with a Zod schema.
 * Throws BadRequestException with the first error message on failure.
 */
function parseBody<T>(
  schema: {
    safeParse: (v: unknown) => {
      success: boolean
      data?: T
      error?: { errors: { message: string }[] }
    }
  },
  body: unknown,
): T {
  const result = schema.safeParse(body)
  if (!result.success) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: result.error?.errors[0]?.message ?? 'Invalid request body',
    })
  }
  return result.data as T
}

/**
 * ReportController
 *
 * Endpoints:
 *   POST   /api/v1/reports              — trigger report generation (ANALYST+)
 *   GET    /api/v1/reports              — list own reports
 *   GET    /api/v1/reports/:id          — report detail / status
 *   GET    /api/v1/reports/:id/download — stream the generated file
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reports')
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  /**
   * POST /api/v1/reports
   *
   * Accepts a CreateReportDto, enqueues (synchronous in MVP) file generation,
   * and returns the PENDING → COMPLETED report record.
   *
   * Requires ANALYST or ADMIN role.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles('ANALYST', 'ADMIN')
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() body: unknown,
  ): Promise<ReportResponse> {
    const dto: CreateReportDto = parseBody(CreateReportSchema, body)
    return this.reportService.create(user.sub, dto)
  }

  /**
   * GET /api/v1/reports
   *
   * Returns all non-deleted reports owned by the authenticated user.
   */
  @Get()
  async findAll(
    @CurrentUser() user: JwtPayload,
  ): Promise<ReportResponse[]> {
    return this.reportService.findAll(user.sub)
  }

  /**
   * GET /api/v1/reports/:id
   *
   * Returns report metadata and current generation status.
   * Returns 403 if the report belongs to another user.
   */
  @Get(':id')
  async findOne(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ): Promise<ReportResponse> {
    return this.reportService.findById(user.sub, id)
  }

  /**
   * GET /api/v1/reports/:id/download
   *
   * Streams the generated PDF or CSV file.
   * Returns 404 when the report is not yet COMPLETED or the file is missing.
   * Returns 403 when the report belongs to another user.
   *
   * Uses Fastify reply.sendFile() / reply.send() directly to avoid loading
   * the entire file into memory for large CSV exports.
   */
  @Get(':id/download')
  async download(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const filePath = await this.reportService.getFilePath(user.sub, id)

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException({
        code: 'REPORT_FILE_NOT_FOUND',
        message: `Generated file for report "${id}" was not found on disk`,
      })
    }

    const isPdf = filePath.endsWith('.pdf')
    const contentType = isPdf ? 'application/pdf' : 'text/csv; charset=utf-8'
    const fileName = filePath.split('/').pop() ?? `report-${id}`

    const fileStream = fs.createReadStream(filePath)

    await reply
      .headers({
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${fileName}"`,
      })
      .send(fileStream)
  }
}
