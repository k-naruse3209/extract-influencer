import { SetMetadata } from '@nestjs/common'
import type { UserRole } from '@prisma/client'

export const ROLES_KEY = 'roles'

/**
 * Decorator to specify which roles are allowed to access an endpoint.
 *
 * Usage:
 *   @Roles('ADMIN', 'ANALYST')
 *   @Get('/candidates')
 *   findAll() { ... }
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles)
