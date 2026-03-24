import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import { FastifyReply, FastifyRequest } from 'fastify'

interface ErrorResponseBody {
  error: {
    code: string
    message: string
    details?: unknown
  }
}

/**
 * Maps HTTP status codes to domain-level error codes.
 * Keeps the error code vocabulary consistent across the API.
 */
function resolveErrorCode(status: number, defaultCode: string): string {
  const STATUS_CODE_MAP: Record<number, string> = {
    [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
    [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
    [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
    [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
    [HttpStatus.CONFLICT]: 'CONFLICT',
    [HttpStatus.UNPROCESSABLE_ENTITY]: 'VALIDATION_ERROR',
    [HttpStatus.TOO_MANY_REQUESTS]: 'RATE_LIMIT_EXCEEDED',
    [HttpStatus.INTERNAL_SERVER_ERROR]: 'INTERNAL_SERVER_ERROR',
    [HttpStatus.SERVICE_UNAVAILABLE]: 'SERVICE_UNAVAILABLE',
  }

  return STATUS_CODE_MAP[status] ?? defaultCode
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name)

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp()
    const reply = ctx.getResponse<FastifyReply>()
    const request = ctx.getRequest<FastifyRequest>()

    let status = HttpStatus.INTERNAL_SERVER_ERROR
    let code = 'INTERNAL_SERVER_ERROR'
    let message = 'An unexpected error occurred'
    let details: unknown

    if (exception instanceof HttpException) {
      status = exception.getStatus()
      const responseBody = exception.getResponse()

      if (typeof responseBody === 'string') {
        message = responseBody
      } else if (typeof responseBody === 'object' && responseBody !== null) {
        const body = responseBody as Record<string, unknown>
        message =
          typeof body['message'] === 'string'
            ? body['message']
            : Array.isArray(body['message'])
              ? String(body['message'][0])
              : message
        code = typeof body['code'] === 'string' ? body['code'] : code
        details = body['details']
      }

      code = resolveErrorCode(status, code)
    } else {
      // Unhandled errors — log the full stack but do not leak details to client
      this.logger.error(
        `Unhandled exception on ${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      )
    }

    const body: ErrorResponseBody = {
      error: {
        code,
        message,
        ...(details !== undefined ? { details } : {}),
      },
    }

    void reply.status(status).send(body)
  }
}
