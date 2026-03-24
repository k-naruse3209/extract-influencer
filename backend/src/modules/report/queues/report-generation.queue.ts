/**
 * report-generation キューのジョブデータ型定義。
 *
 * キュー名: "report-generation"
 *
 * ジョブ優先度（小さいほど高優先）:
 *   1 — ユーザーが手動で起動したレポート生成（高優先）
 *
 * ジョブはプロセッサー内でファイル生成が完了するまで PROCESSING 状態を保つ。
 * 失敗時は BullMQ の backoff 設定（exponential, delay=10s, attempts=2）に従いリトライする。
 */

export const REPORT_GENERATION_QUEUE = 'report-generation'

export interface ReportJobData {
  /** 生成対象の Report レコード ID */
  reportId: string
  /** 依頼ユーザーの ID（監査ログ・権限チェック用） */
  userId: string
  /** 出力フォーマット */
  format: 'PDF' | 'CSV'
  /** 対象インフルエンサープロフィール ID リスト */
  profileIds: string[]
}
