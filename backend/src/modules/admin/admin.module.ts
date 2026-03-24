import { Module } from '@nestjs/common'
import { AdminController } from './admin.controller'
import { AdminService } from './admin.service'

/**
 * AdminModule
 *
 * ユーザー管理・APIキー管理の機能を提供するモジュール。
 * AdminController のすべてのエンドポイントは ADMIN ロールのみアクセス可能。
 */
@Module({
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
