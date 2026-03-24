import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import type { FastifyRequest } from 'fastify'
import '@fastify/cookie'

/**
 * JWT Authentication Guard that extracts the token from httpOnly cookie
 * instead of the Authorization header.
 *
 * ADR-004: JWT is stored in httpOnly Secure Cookie named "access_token".
 * localStorage storage is explicitly prohibited.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name)

  getRequest(context: ExecutionContext): FastifyRequest {
    return context.switchToHttp().getRequest<FastifyRequest>()
  }

  /**
   * Override canActivate to provide a clear error when no token is present.
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = this.getRequest(context)
    const cookies = request.cookies as Record<string, string> | undefined
    const token = cookies?.['access_token']

    if (!token) {
      this.logger.warn('Authentication attempt without access_token cookie')
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      })
    }

    try {
      const result = await super.canActivate(context)
      return result as boolean
    } catch {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired token',
      })
    }
  }
}
