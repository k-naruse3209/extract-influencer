# スキルマップ

## スキル一覧

| スキル名 | 用途 | 起動方法 | 主な使用者 |
|---------|------|---------|----------|
| project-charter | プロジェクト目的・制約・非目標・用語の確認 | 手動 | 全員 |
| repo-mapping | リポジトリ探索・技術棚卸し | 手動（作業開始前） | 全員 |
| product-spec-workflow | PRD・ユーザーストーリー・受け入れ条件作成 | 手動 | product-owner, requirements-editor |
| architecture-decision-record | ADR 作成・技術選定記録 | 手動（方式選定後） | solution-architect, api-architect, data-architect |
| data-source-compliance | データソース取得可否・規約審査 | 手動（必須） | source-strategist, instagram-integration-engineer, tiktok-integration-strategist |
| api-backend-standards | API 設計・実装標準 | 手動 | api-architect, backend-lead |
| frontend-dashboard-standards | 画面設計・テーブル UI・フィルタ実装標準 | 手動 | ui-architect, frontend-engineer |
| scoring-and-analytics | スコアリング設計・変更ルール | 手動（スコア変更前必須） | scoring-engineer, analytics-engineer |
| prompt-and-evaluation | LLM プロンプト設計・eval 管理 | 手動（プロンプト変更前必須） | llm-prompt-engineer, brand-fit-analyst, risk-analyst |
| testing-and-verification | テスト計画・検証ワークフロー | 手動（実装完了後必須） | test-strategist, e2e-runner |
| security-and-privacy | セキュリティ設計・PII・認証認可チェック | 手動（セキュリティ関連実装時必須） | security-architect, security-reviewer |
| release-readiness | リリース前チェックリスト | 手動（デプロイ前必須） | release-manager |
| doc-sync | docs 同期・ドキュメント更新確認 | 手動（実装完了後必須） | 全員（実装系 agent） |

---

## エージェント × スキル 参照マトリクス

| エージェント | 参照スキル |
|------------|----------|
| chief-orchestrator | project-charter, repo-mapping |
| product-owner | product-spec-workflow, project-charter |
| domain-analyst | product-spec-workflow, project-charter |
| requirements-editor | product-spec-workflow |
| ux-flow-analyst | product-spec-workflow, frontend-dashboard-standards |
| solution-architect | architecture-decision-record, repo-mapping |
| api-architect | architecture-decision-record, api-backend-standards |
| data-architect | architecture-decision-record |
| security-architect | security-and-privacy, architecture-decision-record |
| source-strategist | data-source-compliance |
| instagram-integration-engineer | data-source-compliance, api-backend-standards |
| tiktok-integration-strategist | data-source-compliance |
| data-governance-analyst | data-source-compliance, security-and-privacy |
| backend-lead | api-backend-standards, testing-and-verification |
| analytics-engineer | scoring-and-analytics |
| scoring-engineer | scoring-and-analytics, testing-and-verification |
| report-generation-engineer | api-backend-standards |
| ui-architect | frontend-dashboard-standards |
| frontend-engineer | frontend-dashboard-standards, testing-and-verification |
| dashboard-visualization-engineer | frontend-dashboard-standards |
| llm-prompt-engineer | prompt-and-evaluation |
| brand-fit-analyst | prompt-and-evaluation, scoring-and-analytics |
| risk-analyst | prompt-and-evaluation, scoring-and-analytics |
| test-strategist | testing-and-verification |
| e2e-runner | testing-and-verification |
| security-reviewer | security-and-privacy |
| release-manager | release-readiness |
| 全実装系 agent | doc-sync（実装完了後） |

---

## 自動起動 vs 手動起動

現在の設定では **全スキルが手動起動**。以下のタイミングで意識的に呼び出す:

- `repo-mapping`: 作業開始前（新機能・バグ修正どちらも）
- `data-source-compliance`: Instagram/TikTok データ取得方針の変更時（必須）
- `scoring-and-analytics`: スコアロジック変更前（必須）
- `prompt-and-evaluation`: プロンプト変更前（必須）
- `testing-and-verification`: 実装完了後（必須）
- `release-readiness`: デプロイ前（必須）
- `doc-sync`: 実装完了後（必須）
