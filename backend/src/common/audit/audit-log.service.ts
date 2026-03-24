import { Injectable, Logger } from '@nestjs/common'
import type { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'

/**
 * 監査ログに記録するパラメータ。
 *
 * フィールド名はスキーマ（entity / entityId）に合わせている。
 * details に PII（email / password / token）を含めないこと。
 */
export interface AuditLogParams {
  /** 操作を実行したユーザーのID。システム起因アクションは null 可。 */
  userId: string | null
  /** 操作識別子。例: 'USER_LOGIN', 'USER_CREATE', 'REPORT_GENERATE' */
  action: string
  /** 操作対象エンティティ名。例: 'User', 'Report', 'ScoreRecord' */
  entity?: string
  /** 操作対象エンティティのID */
  entityId?: string
  /** 操作に固有のメタデータ。PII を含めないこと。 */
  details?: Record<string, unknown>
  /** クライアントIPアドレス */
  ipAddress?: string
}

/**
 * AuditLogService
 *
 * 管理操作・認証操作・スコア計算・レポート生成を監査ログとして記録する。
 * audit_logs テーブルは INSERT のみ（UPDATE/DELETE 禁止）。
 *
 * 監査ログ書き込みに失敗しても呼び出し元の処理を止めないよう
 * エラーをキャッチしてログ出力に留める。
 */
@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name)

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 監査ログを1件記録する。
   *
   * 書き込みエラー時は例外を再スローせず、ログ出力のみ行う。
   * 監査ログの失敗で本来の処理を止めないための設計判断。
   */
  async log(params: AuditLogParams): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: params.userId ?? null,
          action: params.action,
          entity: params.entity ?? 'System',
          entityId: params.entityId ?? null,
          details: params.details
            ? (JSON.parse(JSON.stringify(params.details)) as Prisma.InputJsonObject)
            : undefined,
          ipAddress: params.ipAddress ?? null,
        },
      })
    } catch (err) {
      // 監査ログ書き込み失敗は警告のみ。本体処理を止めない。
      this.logger.warn(
        `監査ログの書き込みに失敗しました。action=${params.action} error=${
          err instanceof Error ? err.message : String(err)
        }`,
      )
    }
  }
}
