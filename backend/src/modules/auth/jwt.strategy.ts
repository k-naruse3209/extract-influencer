import { Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PassportStrategy } from '@nestjs/passport'
import { Strategy } from 'passport-jwt'
import type { FastifyRequest } from 'fastify'
import '@fastify/cookie'
import type { JwtPayload } from '../../common/decorators/current-user.decorator'

/**
 * Passport JWT strategy that extracts the token from the httpOnly cookie.
 *
 * ADR-004: Token is stored in "access_token" cookie, not Authorization header.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: (req: FastifyRequest): string | null => {
        const cookies = req.cookies as Record<string, string> | undefined
        return cookies?.['access_token'] ?? null
      },
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET', 'default-jwt-secret-change-me'),
    })
  }

  /**
   * Called after JWT signature verification succeeds.
   * The returned object is attached to request.user.
   */
  validate(payload: { sub?: string; role?: string }): JwtPayload {
    if (!payload.sub || !payload.role) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Invalid token payload',
      })
    }

    return {
      sub: payload.sub,
      role: payload.role,
    }
  }
}
