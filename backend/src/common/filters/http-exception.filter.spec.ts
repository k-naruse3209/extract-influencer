import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  HttpException,
  HttpStatus,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common'
import { HttpExceptionFilter } from './http-exception.filter'

function buildMockHost(sendSpy: ReturnType<typeof vi.fn>) {
  const reply = {
    status: vi.fn().mockReturnThis(),
    send: sendSpy,
  }
  const request = {
    method: 'GET',
    url: '/api/v1/test',
  }
  return {
    switchToHttp: () => ({
      getResponse: () => reply,
      getRequest: () => request,
    }),
    reply,
  }
}

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter

  beforeEach(() => {
    filter = new HttpExceptionFilter()
  })

  it('returns INTERNAL_SERVER_ERROR for unknown exceptions', () => {
    const sendSpy = vi.fn()
    const host = buildMockHost(sendSpy)

    filter.catch(new Error('something went wrong'), host as never)

    expect(host.reply.status).toHaveBeenCalledWith(500)
    expect(sendSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'INTERNAL_SERVER_ERROR',
        }),
      }),
    )
  })

  it('maps NotFoundException to NOT_FOUND code', () => {
    const sendSpy = vi.fn()
    const host = buildMockHost(sendSpy)

    filter.catch(new NotFoundException('profile not found'), host as never)

    expect(host.reply.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND)
    expect(sendSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'NOT_FOUND',
          message: 'profile not found',
        }),
      }),
    )
  })

  it('maps UnauthorizedException to UNAUTHORIZED code', () => {
    const sendSpy = vi.fn()
    const host = buildMockHost(sendSpy)

    filter.catch(new UnauthorizedException(), host as never)

    expect(host.reply.status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED)
    expect(sendSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'UNAUTHORIZED' }),
      }),
    )
  })

  it('maps BadRequestException with message array to first message', () => {
    const sendSpy = vi.fn()
    const host = buildMockHost(sendSpy)

    filter.catch(
      new BadRequestException({
        message: ['username must not be empty', 'username must be a string'],
      }),
      host as never,
    )

    expect(sendSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'BAD_REQUEST',
          message: 'username must not be empty',
        }),
      }),
    )
  })

  it('includes details when provided in HttpException body', () => {
    const sendSpy = vi.fn()
    const host = buildMockHost(sendSpy)

    filter.catch(
      new HttpException(
        { message: 'validation failed', details: { field: 'email' } },
        HttpStatus.UNPROCESSABLE_ENTITY,
      ),
      host as never,
    )

    expect(sendSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'VALIDATION_ERROR',
          details: { field: 'email' },
        }),
      }),
    )
  })

  it('omits details key when no details are present', () => {
    const sendSpy = vi.fn()
    const host = buildMockHost(sendSpy)

    filter.catch(new NotFoundException('not found'), host as never)

    const [payload] = sendSpy.mock.calls[0] as [{ error: Record<string, unknown> }]
    expect('details' in payload.error).toBe(false)
  })
})
