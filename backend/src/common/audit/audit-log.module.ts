import { Global, Module } from '@nestjs/common'
import { AuditLogService } from './audit-log.service'

/**
 * AuditLogModule
 *
 * @Global() を付与しているため、AppModule でインポートするだけで
 * 全モジュールから AuditLogService をインジェクト可能になる。
 *
 * PrismaModule は @Global() のため再インポート不要。
 */
@Global()
@Module({
  providers: [AuditLogService],
  exports: [AuditLogService],
})
export class AuditLogModule {}
