import {
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { compare } from 'bcryptjs'
import { PrismaService } from '../../common/prisma/prisma.service'
import type { JwtPayload } from '../../common/decorators/current-user.decorator'

/**
 * Response shape returned after successful login.
 * Password is never included in any response.
 */
export interface AuthenticatedUser {
  id: string
  email: string
  name: string
  role: string
  lastLoginAt: Date | null
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Authenticate a user by email and password.
   * Returns a signed JWT and the user profile (without password).
   *
   * @throws UnauthorizedException if credentials are invalid or account is inactive/deleted.
   */
  async login(
    email: string,
    password: string,
  ): Promise<{ token: string; user: AuthenticatedUser }> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    })

    if (!user || user.deletedAt !== null || !user.isActive) {
      // Use a generic message to prevent user enumeration
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Invalid email or password',
      })
    }

    const isPasswordValid = await compare(password, user.hashedPassword)

    if (!isPasswordValid) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Invalid email or password',
      })
    }

    // Update lastLoginAt for audit purposes
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    })

    // JWT payload: PII minimized (userId + role only, per ADR-004)
    const payload: JwtPayload = {
      sub: user.id,
      role: user.role,
    }

    const token = this.jwtService.sign(payload)

    this.logger.log(`User authenticated successfully: role=${user.role}`)

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        lastLoginAt: user.lastLoginAt,
      },
    }
  }

  /**
   * Validate that a user exists and is active.
   * Called by JwtStrategy or guards when additional DB verification is needed.
   */
  async validateUser(userId: string): Promise<AuthenticatedUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user || user.deletedAt !== null || !user.isActive) {
      return null
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      lastLoginAt: user.lastLoginAt,
    }
  }
}
