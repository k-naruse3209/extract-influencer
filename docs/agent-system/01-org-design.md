# 組織設計: 8部門 35エージェント

## 00-orchestration（司令塔部門）

| エージェント | 責務 | 非責務 |
|------------|------|--------|
| chief-orchestrator | タスク分解・agent 選定・DoD 定義・進行管理 | 自分で実装する |
| delivery-manager | WBS・マイルストーン・依存関係整理・進捗管理 | 実装・技術判断 |
| backlog-prioritizer | Must/Should/Could/Won't 分類・MVP スコープ守護 | 実装・要件作成 |

---

## 01-product-and-domain（プロダクト・ドメイン部門）

| エージェント | 責務 | 非責務 |
|------------|------|--------|
| product-owner | PRD・ユーザーストーリー・受け入れ条件・優先度 | システム設計・実装 |
| domain-analyst | インフルエンサーマーケ用語・業務フロー・指標定義 | 要件書の最終化 |
| ux-flow-analyst | 画面導線・操作フロー・比較 UI 設計 | フロントエンド実装 |
| requirements-editor | 仕様書整形・品質チェック・正式版化 | 要件の内容決定 |

---

## 02-architecture（アーキテクチャ部門）

| エージェント | 責務 | 非責務 |
|------------|------|--------|
| solution-architect | 技術スタック選定・システム構成・非機能要件 | 実装・セキュリティ詳細 |
| api-architect | REST/GraphQL 設計・エンドポイント定義・DTO 設計 | バックエンド実装 |
| data-architect | DB スキーマ・マイグレーション方針・データ品質設計 | クエリ実装 |
| security-architect | 認証認可設計・RBAC・脅威モデリング | セキュリティコードレビュー |

---

## 03-data-source-and-compliance（データソース・コンプライアンス部門）

| エージェント | 責務 | 非責務 |
|------------|------|--------|
| source-strategist | データソース戦略・優先度・公式/非公式可否 | 実装 |
| instagram-integration-engineer | Instagram API with Instagram Login 実装・OAuth・レート制限管理 | TikTok 連携 |
| tiktok-integration-strategist | TikTok データ取得戦略・公式 API 方針・MVP 制約整理 | 実装 |
| data-governance-analyst | GDPR/個人情報保護法・利用規約コンプライアンス | 実装 |

---

## 04-backend-and-analytics（バックエンド・アナリティクス部門）

| エージェント | 責務 | 非責務 |
|------------|------|--------|
| backend-lead | API 実装・統合・品質管理・バグ修正 | フロントエンド |
| analytics-engineer | 分析指標定義・集計クエリ・データパイプライン | スコアリングロジック |
| scoring-engineer | スコアリングモデル実装・更新・回帰テスト | LLM プロンプト設計 |
| report-generation-engineer | PDF/CSV レポート生成・フォーマット設計 | フロントエンド表示 |

---

## 05-frontend-and-ux（フロントエンド・UX部門）

| エージェント | 責務 | 非責務 |
|------------|------|--------|
| ui-architect | UIアーキテクチャ・コンポーネント設計・状態管理方針 | 実装 |
| frontend-engineer | 画面実装・API 繋ぎ込み・フロントのバグ修正 | バックエンド実装 |
| design-system-engineer | デザインシステム・共通コンポーネント・デザイントークン | 画面固有ロジック |
| dashboard-visualization-engineer | グラフ・比較ビュー・スコア可視化 | API実装 |

---

## 06-ai-intelligence（AI・インテリジェンス部門）

| エージェント | 責務 | 非責務 |
|------------|------|--------|
| llm-prompt-engineer | プロンプト設計・最適化・eval 管理 | スコア計算ロジック |
| brand-fit-analyst | ブランド適合スコア設計・LLM 分析コメント生成 | リスク評価 |
| risk-analyst | リスクスコア設計・炎上リスク評価・依頼リスク評価 | ブランド適合 |
| recommendation-engineer | 候補推奨ロジック・フィルタリング・ランキング設計 | UI 実装 |

---

## 07-quality-and-verification（品質・検証部門）

| エージェント | 責務 | 非責務 |
|------------|------|--------|
| test-strategist | テスト計画・カバレッジ基準・テスト基盤設計 | テスト実施 |
| e2e-runner | E2E テスト実施・結果確認・失敗調査 | テスト計画 |
| code-reviewer | コードレビュー・品質チェック・規約確認 | コード変更 |
| security-reviewer | セキュリティレビュー・脆弱性チェック・OWASP 確認 | コード変更 |

---

## 08-devops-and-release（DevOps・リリース部門）

| エージェント | 責務 | 非責務 |
|------------|------|--------|
| devops-engineer | インフラ設計・Docker化・環境構築 | CI/CD 設定 |
| ci-cd-engineer | GitHub Actions・自動テスト・デプロイ自動化 | インフラ設計 |
| observability-engineer | 監視・ロギング・アラート・パフォーマンス計測 | デプロイ実行 |
| release-manager | リリース判断・デプロイ承認・ロールバック判断 | 実装 |

---

## 連携フロー（典型例）

```
chief-orchestrator
  → product-owner (PRD)
  → solution-architect (設計)
  → source-strategist + instagram-integration-engineer (データ取得)
  → backend-lead + frontend-engineer (実装)
  → test-strategist → e2e-runner (検証)
  → security-reviewer + code-reviewer (レビュー)
  → release-manager (リリース判断)
```
