import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock node:fs/promises using vi.hoisted() so mock functions are available
// inside the vi.mock() factory (which is hoisted before imports).
// ---------------------------------------------------------------------------

const fsMocks = vi.hoisted(() => ({
  mkdir: vi.fn(),
  writeFile: vi.fn(),
}))

vi.mock('node:fs/promises', () => ({
  mkdir: fsMocks.mkdir,
  writeFile: fsMocks.writeFile,
}))

import { ReportGenerationProcessor } from './report-generation.processor'
import type { ReportJobData } from './report-generation.queue'

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

function buildPrismaMock() {
  return {
    report: {
      update: vi.fn(),
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

function buildProcessor() {
  const prisma = buildPrismaMock()
  const config = buildConfigMock()
  const pdfGenerator = buildPdfGeneratorMock()
  const csvGenerator = buildCsvGeneratorMock()
  const auditLog = buildAuditLogMock()

  const processor = new ReportGenerationProcessor(
    prisma as unknown as ConstructorParameters<typeof ReportGenerationProcessor>[0],
    config as unknown as ConstructorParameters<typeof ReportGenerationProcessor>[1],
    pdfGenerator as unknown as ConstructorParameters<typeof ReportGenerationProcessor>[2],
    csvGenerator as unknown as ConstructorParameters<typeof ReportGenerationProcessor>[3],
    auditLog as unknown as ConstructorParameters<typeof ReportGenerationProcessor>[4],
  )

  return { processor, prisma, config, pdfGenerator, csvGenerator, auditLog }
}

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makeJob(data: ReportJobData) {
  return { data } as unknown as import('bull').Job<ReportJobData>
}

function makeProfileRow(partial: Partial<{
  id: string
  platform: string
  username: string
  displayName: string | null
  profileUrl: string | null
  deletedAt: Date | null
}> = {}) {
  return {
    id: 'profile-1',
    platform: 'INSTAGRAM',
    username: 'test_user',
    displayName: null,
    profileUrl: null,
    deletedAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    snapshots: [],
    scoreRecords: [],
    ...partial,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ReportGenerationProcessor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fsMocks.mkdir.mockResolvedValue(undefined)
    fsMocks.writeFile.mockResolvedValue(undefined)
  })

  describe('handleReportGeneration', () => {
    it('transitions status PROCESSING → COMPLETED on success (CSV)', async () => {
      const { processor, prisma, csvGenerator } = buildProcessor()

      prisma.influencerProfile.findFirst.mockResolvedValue(makeProfileRow())
      csvGenerator.generateCsv.mockResolvedValue(Buffer.from('\uFEFFusername\n'))
      prisma.report.update.mockResolvedValue({})

      const job = makeJob({
        reportId: 'report-1',
        userId: 'user-1',
        format: 'CSV',
        profileIds: ['profile-1'],
      })

      await processor.handleReportGeneration(job)

      // First call: PROCESSING
      expect(prisma.report.update).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          where: { id: 'report-1' },
          data: expect.objectContaining({ status: 'PROCESSING' }),
        }),
      )

      // Second call: COMPLETED with filePath and fileSize
      expect(prisma.report.update).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          where: { id: 'report-1' },
          data: expect.objectContaining({ status: 'COMPLETED' }),
        }),
      )
    })

    it('calls csvGenerator for CSV format', async () => {
      const { processor, prisma, csvGenerator } = buildProcessor()

      prisma.influencerProfile.findFirst.mockResolvedValue(makeProfileRow())
      prisma.report.update.mockResolvedValue({})

      const job = makeJob({
        reportId: 'report-1',
        userId: 'user-1',
        format: 'CSV',
        profileIds: ['profile-1'],
      })

      await processor.handleReportGeneration(job)

      expect(csvGenerator.generateCsv).toHaveBeenCalled()
    })

    it('calls pdfGenerator for PDF format with single profile', async () => {
      const { processor, prisma, pdfGenerator } = buildProcessor()

      prisma.influencerProfile.findFirst.mockResolvedValue(makeProfileRow())
      prisma.report.update.mockResolvedValue({})

      const job = makeJob({
        reportId: 'report-1',
        userId: 'user-1',
        format: 'PDF',
        profileIds: ['profile-1'],
      })

      await processor.handleReportGeneration(job)

      expect(pdfGenerator.buildSingleProfileHtml).toHaveBeenCalled()
      expect(pdfGenerator.generateFromHtml).toHaveBeenCalled()
    })

    it('calls pdfGenerator buildComparisonHtml for multiple profiles', async () => {
      const { processor, prisma, pdfGenerator } = buildProcessor()

      prisma.influencerProfile.findFirst
        .mockResolvedValueOnce(makeProfileRow({ id: 'profile-1' }))
        .mockResolvedValueOnce(makeProfileRow({ id: 'profile-2', username: 'user_2' }))
      prisma.report.update.mockResolvedValue({})

      const job = makeJob({
        reportId: 'report-1',
        userId: 'user-1',
        format: 'PDF',
        profileIds: ['profile-1', 'profile-2'],
      })

      await processor.handleReportGeneration(job)

      expect(pdfGenerator.buildComparisonHtml).toHaveBeenCalled()
      expect(pdfGenerator.buildSingleProfileHtml).not.toHaveBeenCalled()
    })

    it('transitions status to FAILED and re-throws when generation fails', async () => {
      const { processor, prisma, csvGenerator } = buildProcessor()

      prisma.influencerProfile.findFirst.mockResolvedValue(makeProfileRow())
      prisma.report.update.mockResolvedValue({})

      const generationError = new Error('disk full')
      csvGenerator.generateCsv.mockRejectedValue(generationError)

      const job = makeJob({
        reportId: 'report-1',
        userId: 'user-1',
        format: 'CSV',
        profileIds: ['profile-1'],
      })

      await expect(processor.handleReportGeneration(job)).rejects.toThrow('disk full')

      const failedCall = prisma.report.update.mock.calls.find(
        (call) =>
          (call[0] as { data: { status?: string } }).data?.status === 'FAILED',
      )
      expect(failedCall).toBeDefined()
      expect(
        (failedCall?.[0] as { data: { errorMessage?: string } }).data?.errorMessage,
      ).toBe('disk full')
    })

    it('stores errorMessage when an unknown error object is thrown', async () => {
      const { processor, prisma, csvGenerator } = buildProcessor()

      prisma.influencerProfile.findFirst.mockResolvedValue(makeProfileRow())
      prisma.report.update.mockResolvedValue({})
      csvGenerator.generateCsv.mockRejectedValue('string error')

      const job = makeJob({
        reportId: 'report-1',
        userId: 'user-1',
        format: 'CSV',
        profileIds: ['profile-1'],
      })

      await expect(processor.handleReportGeneration(job)).rejects.toBe('string error')

      const failedCall = prisma.report.update.mock.calls.find(
        (call) =>
          (call[0] as { data: { status?: string } }).data?.status === 'FAILED',
      )
      expect(
        (failedCall?.[0] as { data: { errorMessage?: string } }).data?.errorMessage,
      ).toBe('string error')
    })

    it('writes the generated file to disk', async () => {
      const { processor, prisma } = buildProcessor()

      prisma.influencerProfile.findFirst.mockResolvedValue(makeProfileRow())
      prisma.report.update.mockResolvedValue({})

      const job = makeJob({
        reportId: 'report-xyz',
        userId: 'user-1',
        format: 'CSV',
        profileIds: ['profile-1'],
      })

      await processor.handleReportGeneration(job)

      expect(fsMocks.mkdir).toHaveBeenCalledWith('./storage/reports', { recursive: true })
      expect(fsMocks.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('report-report-xyz.csv'),
        expect.any(Buffer),
      )
    })

    it('records completed filePath in the COMPLETED update', async () => {
      const { processor, prisma } = buildProcessor()

      prisma.influencerProfile.findFirst.mockResolvedValue(makeProfileRow())
      prisma.report.update.mockResolvedValue({})

      const job = makeJob({
        reportId: 'report-abc',
        userId: 'user-1',
        format: 'CSV',
        profileIds: ['profile-1'],
      })

      await processor.handleReportGeneration(job)

      const completedCall = prisma.report.update.mock.calls.find(
        (call) =>
          (call[0] as { data: { status?: string } }).data?.status === 'COMPLETED',
      )
      const data = (completedCall?.[0] as { data: Record<string, unknown> }).data
      expect(data?.filePath).toContain('report-report-abc.csv')
      expect(data?.fileSize).toBeTypeOf('number')
      expect(data?.generatedAt).toBeInstanceOf(Date)
      expect(data?.expiresAt).toBeInstanceOf(Date)
    })

    it('calls auditLogService with correct params after successful generation', async () => {
      const { processor, prisma, auditLog } = buildProcessor()

      prisma.influencerProfile.findFirst.mockResolvedValue(makeProfileRow())
      prisma.report.update.mockResolvedValue({})

      const job = makeJob({
        reportId: 'report-1',
        userId: 'user-1',
        format: 'CSV',
        profileIds: ['profile-1', 'profile-2'],
      })

      // Provide second profile too
      prisma.influencerProfile.findFirst
        .mockResolvedValueOnce(makeProfileRow({ id: 'profile-1' }))
        .mockResolvedValueOnce(makeProfileRow({ id: 'profile-2', username: 'user_2' }))

      await processor.handleReportGeneration(job)

      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          action: 'REPORT_GENERATE',
          entity: 'Report',
          entityId: 'report-1',
          details: expect.objectContaining({
            format: 'CSV',
            profileCount: 2,
          }),
        }),
      )
    })

    it('skips missing profiles gracefully and continues', async () => {
      const { processor, prisma, csvGenerator } = buildProcessor()

      // First profile exists, second does not
      prisma.influencerProfile.findFirst
        .mockResolvedValueOnce(makeProfileRow({ id: 'profile-1' }))
        .mockResolvedValueOnce(null)
      prisma.report.update.mockResolvedValue({})

      const job = makeJob({
        reportId: 'report-1',
        userId: 'user-1',
        format: 'CSV',
        profileIds: ['profile-1', 'missing-profile'],
      })

      await processor.handleReportGeneration(job)

      // CSV generator is called with only the found profile
      expect(csvGenerator.generateCsv).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: 'profile-1' }),
        ]),
      )
      const callArg = csvGenerator.generateCsv.mock.calls[0][0] as unknown[]
      expect(callArg).toHaveLength(1)
    })
  })
})
