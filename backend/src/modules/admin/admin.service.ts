import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common'
import { createHash, randomBytes } from 'crypto'
import { hash } from 'bcryptjs'
import type { User, ApiKey } from '@prisma/client'
import { PrismaService } from '../../common/prisma/prisma.service'
import type { CreateUserDto } from './dto/create-user.dto'
import type { UpdateUserDto } from './dto/update-user.dto'
import type { CreateApiKeyDto } from './dto/create-api-key.dto'

/** APIキー生成時のみ返す生のキー（DB には保存しない）*/
export interface CreateApiKeyResult {
  apiKey: ApiKey
  rawKey: string
}

/**
 * AdminService
 *
 * ユーザー管理・APIキー管理のビジネスロジック。
 * ADMIN ロールのみが呼び出せる操作を提供する。
 * 削除はすべて論理削除（deletedAt）。
 */
@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name)
  private static readonly BCRYPT_SALT_ROUNDS = 12
  private static readonly API_KEY_BYTE_LENGTH = 32
  private static readonly API_KEY_PREFIX_LENGTH = 8

  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // User management
  // ---------------------------------------------------------------------------

  /**
   * 論理削除されていない全ユーザーを返す。
   * パスワードハッシュは含めない。
   */
  async listUsers(): Promise<Omit<User, 'hashedPassword'>[]> {
    return this.prisma.user.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        deletedAt: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  /**
   * ユーザーを新規作成する。
   * パスワードは bcryptjs でハッシュしてから保存する。
   * 同一メールアドレスが既に存在する場合は ConflictException をスローする。
   */
  async createUser(dto: CreateUserDto): Promise<Omit<User, 'hashedPassword'>> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    })

    if (existing !== null) {
      throw new ConflictException({
        code: 'EMAIL_ALREADY_EXISTS',
        message: 'A user with this email already exists',
      })
    }

    const hashedPassword = await hash(
      dto.password,
      AdminService.BCRYPT_SALT_ROUNDS,
    )

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        hashedPassword,
        role: dto.role,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        deletedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    this.logger.log(`User created: role=${user.role}`)
    return user
  }

  /**
   * ユーザーの role または isActive を更新する。
   * 論理削除済みのユーザーは更新不可。
   */
  async updateUser(
    id: string,
    dto: UpdateUserDto,
  ): Promise<Omit<User, 'hashedPassword'>> {
    const existing = await this.prisma.user.findUnique({
      where: { id },
    })

    if (existing === null || existing.deletedAt !== null) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'User not found',
      })
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.role !== undefined && { role: dto.role }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        deletedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    this.logger.log(`User updated: id=${id}`)
    return updated
  }

  /**
   * ユーザーを論理削除する（deletedAt をセット）。
   * 既に削除済みの場合は NotFoundException をスローする。
   */
  async deleteUser(id: string): Promise<void> {
    const existing = await this.prisma.user.findUnique({
      where: { id },
    })

    if (existing === null || existing.deletedAt !== null) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'User not found',
      })
    }

    await this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() },
    })

    this.logger.log(`User soft-deleted: id=${id}`)
  }

  // ---------------------------------------------------------------------------
  // API key management
  // ---------------------------------------------------------------------------

  /**
   * 論理削除されていない全APIキーを返す。
   * hashedKey は含めない（prefix のみ返す）。
   */
  async listApiKeys(): Promise<Omit<ApiKey, 'hashedKey'>[]> {
    return this.prisma.apiKey.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        userId: true,
        name: true,
        prefix: true,
        lastUsedAt: true,
        expiresAt: true,
        isRevoked: true,
        deletedAt: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  /**
   * APIキーを生成する。
   * crypto.randomBytes(32) でキーを生成し、SHA-256 ハッシュを DB に保存する。
   * rawKey（プレーンテキスト）は呼び出し元に一度だけ返す。DB には保存しない。
   */
  async createApiKey(
    userId: string,
    dto: CreateApiKeyDto,
  ): Promise<CreateApiKeyResult> {
    const rawBytes = randomBytes(AdminService.API_KEY_BYTE_LENGTH)
    const rawKey = rawBytes.toString('hex')
    const hashedKey = createHash('sha256').update(rawKey).digest('hex')
    const prefix = rawKey.substring(0, AdminService.API_KEY_PREFIX_LENGTH)

    const apiKey = await this.prisma.apiKey.create({
      data: {
        userId,
        name: dto.name,
        hashedKey,
        prefix,
        expiresAt: dto.expiresAt ?? null,
        isRevoked: false,
      },
    })

    this.logger.log(`API key created: prefix=${prefix}`)
    return { apiKey, rawKey }
  }

  /**
   * APIキーの isRevoked を更新する（有効/無効の切り替え）。
   */
  async updateApiKey(
    id: string,
    isRevoked: boolean,
  ): Promise<Omit<ApiKey, 'hashedKey'>> {
    const existing = await this.prisma.apiKey.findUnique({
      where: { id },
    })

    if (existing === null || existing.deletedAt !== null) {
      throw new NotFoundException({
        code: 'API_KEY_NOT_FOUND',
        message: 'API key not found',
      })
    }

    const updated = await this.prisma.apiKey.update({
      where: { id },
      data: { isRevoked },
      select: {
        id: true,
        userId: true,
        name: true,
        prefix: true,
        lastUsedAt: true,
        expiresAt: true,
        isRevoked: true,
        deletedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    this.logger.log(`API key updated: id=${id}, isRevoked=${isRevoked}`)
    return updated
  }

  /**
   * APIキーを論理削除する（deletedAt をセット）。
   */
  async deleteApiKey(id: string): Promise<void> {
    const existing = await this.prisma.apiKey.findUnique({
      where: { id },
    })

    if (existing === null || existing.deletedAt !== null) {
      throw new NotFoundException({
        code: 'API_KEY_NOT_FOUND',
        message: 'API key not found',
      })
    }

    await this.prisma.apiKey.update({
      where: { id },
      data: { deletedAt: new Date() },
    })

    this.logger.log(`API key soft-deleted: id=${id}`)
  }
}
