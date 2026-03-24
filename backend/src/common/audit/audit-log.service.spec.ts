import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AuditLogService } from './audit-log.service'

function buildPrismaMock() {
  return {
    auditLog: {
      create: vi.fn(),
    },
  }
}

describe('AuditLogService', () => {
  let prismaMock: ReturnType<typeof buildPrismaMock>
  let service: AuditLogService

  beforeEach(() => {
    prismaMock = buildPrismaMock()
    service = new AuditLogService(
      prismaMock as unknown as ConstructorParameters<typeof AuditLogService>[0],
    )
  })

  it('creates an auditLog record with the provided params', async () => {
    prismaMock.auditLog.create.mockResolvedValue({ id: 'al-1' })

    await service.log({
      userId: 'user-1',
      action: 'USER_LOGIN',
      entity: 'User',
      entityId: 'user-1',
      details: { role: 'ADMIN' },
      ipAddress: '127.0.0.1',
    })

    expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        action: 'USER_LOGIN',
        entity: 'User',
        entityId: 'user-1',
        details: { role: 'ADMIN' },
        ipAddress: '127.0.0.1',
      },
    })
  })

  it('defaults entity to "System" when not provided', async () => {
    prismaMock.auditLog.create.mockResolvedValue({ id: 'al-2' })

    await service.log({
      userId: null,
      action: 'SYSTEM_EVENT',
    })

    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ entity: 'System' }),
      }),
    )
  })

  it('sets details to undefined when not provided', async () => {
    prismaMock.auditLog.create.mockResolvedValue({ id: 'al-3' })

    await service.log({
      userId: 'user-1',
      action: 'USER_CREATE',
    })

    const callArg = prismaMock.auditLog.create.mock.calls[0]?.[0] as {
      data: { details: unknown }
    }
    expect(callArg.data.details).toBeUndefined()
  })

  it('does not throw when prisma.create rejects — only logs a warning', async () => {
    prismaMock.auditLog.create.mockRejectedValue(new Error('DB connection lost'))

    await expect(
      service.log({ userId: 'user-1', action: 'USER_LOGIN' }),
    ).resolves.toBeUndefined()
  })

  it('accepts null userId for system-initiated actions', async () => {
    prismaMock.auditLog.create.mockResolvedValue({ id: 'al-4' })

    await service.log({
      userId: null,
      action: 'BATCH_SCORE_CALCULATE',
      entity: 'ScoreRecord',
    })

    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: null }),
      }),
    )
  })

  it('deep-clones details to prevent mutation side effects', async () => {
    prismaMock.auditLog.create.mockResolvedValue({ id: 'al-5' })

    const details = { role: 'ANALYST' }
    await service.log({ userId: 'u-1', action: 'USER_CREATE', details })

    // Mutating original after call should not affect what was passed to prisma
    details.role = 'ADMIN'

    const callArg = prismaMock.auditLog.create.mock.calls[0]?.[0] as {
      data: { details: { role: string } }
    }
    expect(callArg.data.details.role).toBe('ANALYST')
  })
})
