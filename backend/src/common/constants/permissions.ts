/**
 * RBAC Permission Matrix
 *
 * ADR-004: 認証・RBAC 設計
 * - ADMIN: 全操作（ユーザー管理・API キー管理含む）
 * - ANALYST: 候補検索・保存・比較・レポート生成・スコア閲覧
 * - VIEWER: 保存済み候補・レポートの閲覧のみ（作成・削除不可）
 */

export const Permission = {
  // User management
  USER_LIST: 'user:list',
  USER_CREATE: 'user:create',
  USER_UPDATE: 'user:update',
  USER_DELETE: 'user:delete',

  // API key management
  API_KEY_CREATE: 'api-key:create',
  API_KEY_REVOKE: 'api-key:revoke',

  // Influencer candidates
  CANDIDATE_SEARCH: 'candidate:search',
  CANDIDATE_ADD: 'candidate:add',
  CANDIDATE_VIEW: 'candidate:view',
  CANDIDATE_DELETE: 'candidate:delete',

  // Scoring
  SCORE_VIEW: 'score:view',
  SCORE_TRIGGER: 'score:trigger',

  // Comparison
  COMPARISON_CREATE: 'comparison:create',
  COMPARISON_VIEW: 'comparison:view',

  // Reports
  REPORT_GENERATE: 'report:generate',
  REPORT_VIEW: 'report:view',

  // Audit logs
  AUDIT_LOG_VIEW: 'audit-log:view',
} as const

export type Permission = (typeof Permission)[keyof typeof Permission]

export const ROLE_PERMISSIONS = {
  ADMIN: [
    Permission.USER_LIST,
    Permission.USER_CREATE,
    Permission.USER_UPDATE,
    Permission.USER_DELETE,
    Permission.API_KEY_CREATE,
    Permission.API_KEY_REVOKE,
    Permission.CANDIDATE_SEARCH,
    Permission.CANDIDATE_ADD,
    Permission.CANDIDATE_VIEW,
    Permission.CANDIDATE_DELETE,
    Permission.SCORE_VIEW,
    Permission.SCORE_TRIGGER,
    Permission.COMPARISON_CREATE,
    Permission.COMPARISON_VIEW,
    Permission.REPORT_GENERATE,
    Permission.REPORT_VIEW,
    Permission.AUDIT_LOG_VIEW,
  ],
  ANALYST: [
    Permission.CANDIDATE_SEARCH,
    Permission.CANDIDATE_ADD,
    Permission.CANDIDATE_VIEW,
    Permission.SCORE_VIEW,
    Permission.SCORE_TRIGGER,
    Permission.COMPARISON_CREATE,
    Permission.COMPARISON_VIEW,
    Permission.REPORT_GENERATE,
    Permission.REPORT_VIEW,
  ],
  VIEWER: [
    Permission.CANDIDATE_VIEW,
    Permission.SCORE_VIEW,
    Permission.COMPARISON_VIEW,
    Permission.REPORT_VIEW,
  ],
} as const satisfies Record<string, readonly Permission[]>

/**
 * Check if a given role has a specific permission.
 */
export function roleHasPermission(
  role: keyof typeof ROLE_PERMISSIONS,
  permission: Permission,
): boolean {
  const permissions = ROLE_PERMISSIONS[role]
  return (permissions as readonly Permission[]).includes(permission)
}
