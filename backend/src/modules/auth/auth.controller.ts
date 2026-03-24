import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  UnprocessableEntityException,
  Logger,
} from '@nestjs/common'
import type { FastifyReply, FastifyRequest } from 'fastify'
import '@fastify/cookie'
import { ConfigService } from '@nestjs/config'
import { AuthService } from './auth.service'
import { LoginSchema } from './dto/login.dto'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import {
  CurrentUser,
  type JwtPayload,
} from '../../common/decorators/current-user.decorator'
import { AuditLogService } from '../../common/audit/audit-log.service'

/**
 * Cookie configuration constants.
 * ADR-004: httpOnly + Secure + SameSite=Strict, 15 min max age.
 */
const COOKIE_NAME = 'access_token'
const COOKIE_MAX_AGE_SECONDS = 900 // 15 minutes

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name)
  private readonly isProduction: boolean

  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    private readonly auditLogService: AuditLogService,
  ) {
    this.isProduction =
      this.configService.get<string>('NODE_ENV') === 'production'
  }

  /**
   * POST /api/v1/auth/login
   *
   * Authenticate with email + password.
   * On success, sets JWT in httpOnly cookie and returns user profile.
   * No authentication required.
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() body: unknown,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<{ user: { id: string; email: string; name: string; role: string } }> {
    const parsed = LoginSchema.safeParse(body)

    if (!parsed.success) {
      const firstError = parsed.error.errors[0]
      throw new UnprocessableEntityException({
        code: 'VALIDATION_ERROR',
        message: firstError?.message ?? 'Invalid input',
        details: parsed.error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      })
    }

    const { token, user } = await this.authService.login(
      parsed.data.email,
      parsed.data.password,
    )

    // Set JWT in httpOnly cookie (ADR-004)
    void reply.setCookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: this.isProduction,
      sameSite: 'strict',
      path: '/',
      maxAge: COOKIE_MAX_AGE_SECONDS,
    })

    this.logger.log(`Login successful: role=${user.role}`)

    await this.auditLogService.log({
      userId: user.id,
      action: 'USER_LOGIN',
      entity: 'User',
      entityId: user.id,
      details: { role: user.role },
      ipAddress: req.ip,
    })

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    }
  }

  /**
   * POST /api/v1/auth/logout
   *
   * Clear the access_token cookie.
   * Requires authentication.
   */
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  logout(
    @Res({ passthrough: true }) reply: FastifyReply,
  ): { message: string } {
    void reply.clearCookie(COOKIE_NAME, {
      httpOnly: true,
      secure: this.isProduction,
      sameSite: 'strict',
      path: '/',
    })

    this.logger.log('User logged out')

    return { message: 'Logged out successfully' }
  }

  /**
   * GET /api/v1/auth/me
   *
   * Return the currently authenticated user's profile.
   * Requires authentication.
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(
    @CurrentUser() payload: JwtPayload,
  ): Promise<{
    user: { id: string; email: string; name: string; role: string } | null
  }> {
    const user = await this.authService.validateUser(payload.sub)

    if (!user) {
      return { user: null }
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    }
  }
}
