import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { UserRole } from '@prisma/client'
import type { FastifyRequest } from 'fastify'
import { ROLES_KEY } from '../decorators/roles.decorator'
import type { JwtPayload } from '../decorators/current-user.decorator'

/**
 * Role-Based Access Control guard.
 *
 * Checks whether the authenticated user's role is included in the
 * list of roles specified by the @Roles() decorator.
 *
 * If no @Roles() decorator is present on the handler or controller,
 * access is granted (the endpoint only requires authentication, not
 * a specific role).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name)

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<
      UserRole[] | undefined
    >(ROLES_KEY, [context.getHandler(), context.getClass()])

    if (!requiredRoles || requiredRoles.length === 0) {
      return true
    }

    const request = context.switchToHttp().getRequest<FastifyRequest>()
    const user = (request as FastifyRequest & { user: JwtPayload }).user

    if (!user || !user.role) {
      this.logger.warn('RolesGuard: No user or role found on request')
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Insufficient permissions',
      })
    }

    const hasRole = requiredRoles.includes(user.role as UserRole)

    if (!hasRole) {
      this.logger.warn(
        `RolesGuard: User role "${user.role}" not in required roles [${requiredRoles.join(', ')}]`,
      )
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Insufficient permissions',
      })
    }

    return true
  }
}
