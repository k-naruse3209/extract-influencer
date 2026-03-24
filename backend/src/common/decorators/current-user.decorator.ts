import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import type { FastifyRequest } from 'fastify'

/**
 * Payload attached to the request by JwtAuthGuard after token verification.
 * Contains only userId and role (PII minimization per ADR-004).
 */
export interface JwtPayload {
  sub: string
  role: string
}

/**
 * Extract the authenticated user from the request.
 *
 * Usage:
 *   @Get('/me')
 *   getMe(@CurrentUser() user: JwtPayload) { ... }
 *
 *   @Get('/me')
 *   getMe(@CurrentUser('sub') userId: string) { ... }
 */
export const CurrentUser = createParamDecorator(
  (data: keyof JwtPayload | undefined, ctx: ExecutionContext): unknown => {
    const request = ctx.switchToHttp().getRequest<FastifyRequest>()
    const user = (request as FastifyRequest & { user: JwtPayload }).user

    if (data) {
      return user[data]
    }

    return user
  },
)
