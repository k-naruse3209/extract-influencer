import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NotFoundException, ForbiddenException } from '@nestjs/common'
import { ReportService } from './report.service'
import type { CreateReportDto } from './dto/create-report.dto'

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

function buildPrismaMock() {
  return {
    report: {
      create: vi.fn(),
      update: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    influencerProfile: {
      findFirst: vi.fn(),
    },
  }
}

function buildConfigMock() {
  return {
    get: vi.fn().mockReturnValue('./storage/reports'),
  }
}

function buildPdfGeneratorMock() {
  return {
    buildSingleProfileHtml: vi.fn().mockReturnValue('<html>single</html>'),
    buildComparisonHtml: vi.fn().mockReturnValue('<html>comparison</html>'),
    generateFromHtml: vi.fn().mockResolvedValue(Buffer.from('%PDF-test')),
  }
}

function buildCsvGeneratorMock() {
  return {
    generateCsv: vi.fn().mockResolvedValue(Buffer.from('\uFEFFusername\n')),
  }
}

function buildAuditLogMock() {
  return {
    log: vi.fn().mockResolvedValue(undefined),
  }
}

/**
 * BullMQ Queue のモック。
 * add() が呼ばれたことと引数を検証するために使う。
 */
function buildReportQueueMock() {
  return {
    add: vi.fn().mockResolvedValue({ id: 'job-1' }),
  }
}

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makeReportRow(partial: Partial<{
  id: string
  userId: string
  reportType: string
  format: string
  title: string
  status: string
  filePath: string | null
  fileSize: number | null
  errorMessage: string | null
  generatedAt: Date | null
  expiresAt: Date | null
  metadata: unknown
  deletedAt: Date | null
  createdAt: Date
  updatedAt: Date
}> = {}) {
  return {
    id: 'report-1',
    userId: 'user-1',
    reportType: 'SINGLE_PROFILE',
    format: 'CSV',
    title: 'Test Report',
    status: 'COMPLETED',
    filePath: '/tmp/report-1.csv',
    fileSize: 512,
    errorMessage: null,
    generatedAt: new Date('2026-01-15T01:00:00Z'),
    expiresAt: new Date('2026-01-22T01:00:00Z'),
    metadata: null,
    deletedAt: null,
    createdAt: new Date('2026-01-15T00:00:00Z'),
    updatedAt: new Date('2026-01-15T01:00:00Z'),
    ...partial,
  }
}

// ---------------------------------------------------------------------------
// Helper to build ReportService with mocked deps
// ---------------------------------------------------------------------------

function buildService() {
  const prisma = buildPrismaMock()
  const config = buildConfigMock()
  const pdfGenerator = buildPdfGeneratorMock()
  const csvGenerator = buildCsvGeneratorMock()
  const auditLog = buildAuditLogMock()
  const reportQueue = buildReportQueueMock()

  const service = new ReportService(
    prisma as unknown as ConstructorParameters<typeof ReportService>[0],
    config as unknown as ConstructorParameters<typeof ReportService>[1],
    pdfGenerator as unknown as ConstructorParameters<typeof ReportService>[2],
    csvGenerator as unknown as ConstructorParameters<typeof ReportService>[3],
    auditLog as unknown as ConstructorParameters<typeof ReportService>[4],
    reportQueue as unknown as ConstructorParameters<typeof ReportService>[5],
  )

  return { service, prisma, config, pdfGenerator, csvGenerator, auditLog, reportQueue }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ReportService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('create', () => {
    it('creates a PENDING report record in the DB', async () => {
      const { service, prisma } = buildService()

      const pendingRow = makeReportRow({ status: 'PENDING', filePath: null, fileSize: null })
      prisma.report.create.mockResolvedValue(pendingRow)

      const dto: CreateReportDto = {
        format: 'CSV',
        reportType: 'SINGLE_PROFILE',
        profileIds: ['profile-1'],
      }

      await service.create('user-1', dto)

      expect(prisma.report.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'PENDING' }),
        }),
      )
    })

    it('returns the PENDING report immediately without waiting for generation', async () => {
      const { service, prisma } = buildService()

      const pendingRow = makeReportRow({ status: 'PENDING', filePath: null, fileSize: null })
      prisma.report.create.mockResolvedValue(pendingRow)

      const dto: CreateReportDto = {
        format: 'CSV',
        reportType: 'SINGLE_PROFILE',
        profileIds: ['profile-1'],
      }

      const result = await service.create('user-1', dto)

      expect(result.status).toBe('PENDING')
    })

    it('enqueues a job to the report-generation queue after creating the record', async () => {
      const { service, prisma, reportQueue } = buildService()

      const pendingRow = makeReportRow({ status: 'PENDING', filePath: null, fileSize: null })
      prisma.report.create.mockResolvedValue(pendingRow)

      const dto: CreateReportDto = {
        format: 'CSV',
        reportType: 'SINGLE_PROFILE',
        profileIds: ['profile-1'],
      }

      await service.create('user-1', dto)

      expect(reportQueue.add).toHaveBeenCalledTimes(1)
      expect(reportQueue.add).toHaveBeenCalledWith(
        expect.objectContaining({
          reportId: pendingRow.id,
          userId: 'user-1',
          format: 'CSV',
          profileIds: ['profile-1'],
        }),
        expect.objectContaining({ priority: 1 }),
      )
    })

    it('enqueues with PDF format when dto.format is PDF', async () => {
      const { service, prisma, reportQueue } = buildService()

      const pendingRow = makeReportRow({ status: 'PENDING', format: 'PDF', filePath: null })
      prisma.report.create.mockResolvedValue(pendingRow)

      const dto: CreateReportDto = {
        format: 'PDF',
        reportType: 'SINGLE_PROFILE',
        profileIds: ['profile-1'],
      }

      await service.create('user-1', dto)

      expect(reportQueue.add).toHaveBeenCalledWith(
        expect.objectContaining({ format: 'PDF' }),
        expect.anything(),
      )
    })

    it('sets title from dto.title when provided', async () => {
      const { service, prisma } = buildService()

      const reportRow = makeReportRow({ title: 'My Custom Report', status: 'PENDING' })
      prisma.report.create.mockResolvedValue(reportRow)

      const dto: CreateReportDto = {
        format: 'CSV',
        reportType: 'SINGLE_PROFILE',
        profileIds: ['profile-1'],
        title: 'My Custom Report',
      }

      await service.create('user-1', dto)

      expect(prisma.report.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ title: 'My Custom Report' }),
        }),
      )
    })

    it('does not call PDF or CSV generators directly (generation is delegated to processor)', async () => {
      const { service, prisma, pdfGenerator, csvGenerator } = buildService()

      const pendingRow = makeReportRow({ status: 'PENDING', filePath: null })
      prisma.report.create.mockResolvedValue(pendingRow)

      const dto: CreateReportDto = {
        format: 'CSV',
        reportType: 'SINGLE_PROFILE',
        profileIds: ['profile-1'],
      }

      await service.create('user-1', dto)

      expect(csvGenerator.generateCsv).not.toHaveBeenCalled()
      expect(pdfGenerator.generateFromHtml).not.toHaveBeenCalled()
    })

    it('does not call auditLogService directly in create (audit is in processor)', async () => {
      const { service, prisma, auditLog } = buildService()

      const pendingRow = makeReportRow({ status: 'PENDING', filePath: null })
      prisma.report.create.mockResolvedValue(pendingRow)

      const dto: CreateReportDto = {
        format: 'CSV',
        reportType: 'SINGLE_PROFILE',
        profileIds: ['profile-1'],
      }

      await service.create('user-1', dto)

      expect(auditLog.log).not.toHaveBeenCalled()
    })
  })

  describe('findAll', () => {
    it('returns reports belonging to the requesting user', async () => {
      const { service, prisma } = buildService()

      const rows = [
        makeReportRow({ id: 'r-1', userId: 'user-1' }),
        makeReportRow({ id: 'r-2', userId: 'user-1' }),
      ]
      prisma.report.findMany.mockResolvedValue(rows)

      const result = await service.findAll('user-1')

      expect(result).toHaveLength(2)
      expect(prisma.report.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-1',
            deletedAt: null,
          }),
        }),
      )
    })

    it('returns an empty array when the user has no reports', async () => {
      const { service, prisma } = buildService()
      prisma.report.findMany.mockResolvedValue([])

      const result = await service.findAll('user-1')
      expect(result).toEqual([])
    })
  })

  describe('findById', () => {
    it('returns the report when userId matches', async () => {
      const { service, prisma } = buildService()

      prisma.report.findFirst.mockResolvedValue(
        makeReportRow({ userId: 'user-1' }),
      )

      const result = await service.findById('user-1', 'report-1')

      expect(result.id).toBe('report-1')
    })

    it('throws NotFoundException when report does not exist', async () => {
      const { service, prisma } = buildService()

      prisma.report.findFirst.mockResolvedValue(null)

      await expect(
        service.findById('user-1', 'nonexistent'),
      ).rejects.toThrow(NotFoundException)
    })

    it('throws ForbiddenException when report belongs to another user', async () => {
      const { service, prisma } = buildService()

      prisma.report.findFirst.mockResolvedValue(
        makeReportRow({ userId: 'user-99' }),
      )

      await expect(
        service.findById('user-1', 'report-1'),
      ).rejects.toThrow(ForbiddenException)
    })
  })

  describe('getFilePath', () => {
    it('returns the filePath for a COMPLETED report owned by the user', async () => {
      const { service, prisma } = buildService()

      const row = makeReportRow({
        status: 'COMPLETED',
        filePath: '/storage/reports/report-1.csv',
      })
      prisma.report.findFirst
        .mockResolvedValueOnce(row)
        .mockResolvedValueOnce({ filePath: '/storage/reports/report-1.csv' })

      const filePath = await service.getFilePath('user-1', 'report-1')

      expect(filePath).toBe('/storage/reports/report-1.csv')
    })

    it('throws NotFoundException when status is PENDING', async () => {
      const { service, prisma } = buildService()

      prisma.report.findFirst.mockResolvedValue(
        makeReportRow({ status: 'PENDING', filePath: null }),
      )

      await expect(
        service.getFilePath('user-1', 'report-1'),
      ).rejects.toThrow(NotFoundException)
    })

    it('throws ForbiddenException when report belongs to another user', async () => {
      const { service, prisma } = buildService()

      prisma.report.findFirst.mockResolvedValue(
        makeReportRow({ userId: 'user-99', status: 'COMPLETED' }),
      )

      await expect(
        service.getFilePath('user-1', 'report-1'),
      ).rejects.toThrow(ForbiddenException)
    })
  })
})
