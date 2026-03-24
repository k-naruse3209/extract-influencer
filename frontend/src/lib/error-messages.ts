/**
 * バックエンドが返す error.code をユーザー向けの日本語メッセージに変換するマッピング。
 * コードが見つからない場合は fallback またはデフォルトメッセージを返す。
 */
const ERROR_MESSAGES: Record<string, string> = {
  UNAUTHORIZED: 'ログインが必要です。再度ログインしてください。',
  FORBIDDEN: 'この操作を行う権限がありません。',
  VALIDATION_ERROR: '入力内容に問題があります。確認してください。',
  SCORE_NOT_FOUND: 'スコアがまだ計算されていません。',
  COMPARISON_LIMIT_EXCEEDED: '比較できる候補は最大10件です。',
  REPORT_FILE_NOT_FOUND: 'レポートファイルが見つかりません。',
  NOT_FOUND: '指定されたリソースが見つかりません。',
  INTERNAL_SERVER_ERROR:
    'サーバーでエラーが発生しました。しばらく待ってから再試行してください。',
}

/**
 * エラーコードをユーザー向けの日本語メッセージに変換する。
 *
 * @param code - バックエンドが返す error.code
 * @param fallback - コードが未定義の場合に使うメッセージ（省略時はデフォルト文言）
 */
export function getErrorMessage(code: string, fallback?: string): string {
  return ERROR_MESSAGES[code] ?? fallback ?? '予期しないエラーが発生しました。'
}
