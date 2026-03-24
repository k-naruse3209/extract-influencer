import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  UnprocessableEntityException,
} from '@nestjs/common'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import {
  CurrentUser,
  type JwtPayload,
} from '../../common/decorators/current-user.decorator'
import { AdminService } from './admin.service'
import { CreateUserSchema } from './dto/create-user.dto'
import { UpdateUserSchema } from './dto/update-user.dto'
import { CreateApiKeySchema } from './dto/create-api-key.dto'
import { AuditLogService } from '../../common/audit/audit-log.service'

/**
 * AdminController
 *
 * ADMIN ロールのみアクセス可能な管理 API。
 * ユーザー管理・APIキー管理のエンドポイントを提供する。
 */
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly auditLogService: AuditLogService,
  ) {}

  // ---------------------------------------------------------------------------
  // User management
  // ---------------------------------------------------------------------------

  /**
   * GET /api/v1/admin/users
   * 全ユーザー一覧を返す（論理削除済みを除く）。
   */
  @Get('users')
  async listUsers() {
    const users = await this.adminService.listUsers()
    return { users }
  }

  /**
   * POST /api/v1/admin/users
   * ユーザーを新規作成する。
   */
  @Post('users')
  @HttpCode(HttpStatus.CREATED)
  async createUser(
    @Body() body: unknown,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    const parsed = CreateUserSchema.safeParse(body)

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

    const user = await this.adminService.createUser(parsed.data)

    await this.auditLogService.log({
      userId: currentUser.sub,
      action: 'USER_CREATE',
      entity: 'User',
      entityId: user.id,
      details: { role: user.role },
    })

    return { user }
  }

  /**
   * PATCH /api/v1/admin/users/:id
   * ユーザーの role または isActive を更新する。
   */
  @Patch('users/:id')
  async updateUser(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    const parsed = UpdateUserSchema.safeParse(body)

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

    const user = await this.adminService.updateUser(id, parsed.data)

    await this.auditLogService.log({
      userId: currentUser.sub,
      action: 'USER_UPDATE',
      entity: 'User',
      entityId: id,
      details: {
        ...(parsed.data.role !== undefined && { role: parsed.data.role }),
        ...(parsed.data.isActive !== undefined && {
          isActive: parsed.data.isActive,
        }),
      },
    })

    return { user }
  }

  /**
   * DELETE /api/v1/admin/users/:id
   * ユーザーを論理削除する。
   */
  @Delete('users/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteUser(
    @Param('id') id: string,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<void> {
    await this.adminService.deleteUser(id)

    await this.auditLogService.log({
      userId: currentUser.sub,
      action: 'USER_DELETE',
      entity: 'User',
      entityId: id,
    })
  }

  // ---------------------------------------------------------------------------
  // API key management
  // ---------------------------------------------------------------------------

  /**
   * GET /api/v1/admin/api-keys
   * APIキー一覧を返す（論理削除済みを除く）。
   * hashedKey は返さない。
   */
  @Get('api-keys')
  async listApiKeys() {
    const apiKeys = await this.adminService.listApiKeys()
    return { apiKeys }
  }

  /**
   * POST /api/v1/admin/api-keys
   * APIキーを生成する。
   * rawKey はこのレスポンスでのみ返す（再表示不可）。
   */
  @Post('api-keys')
  @HttpCode(HttpStatus.CREATED)
  async createApiKey(
    @Body() body: unknown,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    const parsed = CreateApiKeySchema.safeParse(body)

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

    const result = await this.adminService.createApiKey(
      currentUser.sub,
      parsed.data,
    )
    return { apiKey: result.apiKey, rawKey: result.rawKey }
  }

  /**
   * PATCH /api/v1/admin/api-keys/:id
   * APIキーの isRevoked を更新する。
   */
  @Patch('api-keys/:id')
  async updateApiKey(@Param('id') id: string, @Body() body: unknown) {
    const parsed = (body as { isRevoked?: unknown }).isRevoked

    if (typeof parsed !== 'boolean') {
      throw new UnprocessableEntityException({
        code: 'VALIDATION_ERROR',
        message: 'isRevoked must be a boolean',
      })
    }

    const apiKey = await this.adminService.updateApiKey(id, parsed)
    return { apiKey }
  }

  /**
   * DELETE /api/v1/admin/api-keys/:id
   * APIキーを論理削除する。
   */
  @Delete('api-keys/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteApiKey(@Param('id') id: string): Promise<void> {
    await this.adminService.deleteApiKey(id)
  }
}
