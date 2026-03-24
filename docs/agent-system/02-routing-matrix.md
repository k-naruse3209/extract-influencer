# ルーティングマトリクス

## 依頼別担当エージェント

| 依頼内容 | 優先担当 | 連携先 |
|---------|---------|--------|
| 新機能の企画・要件整理 | product-owner | domain-analyst, ux-flow-analyst |
| PRD・ユーザーストーリー作成 | product-owner | requirements-editor |
| 画面導線・UX フロー設計 | ux-flow-analyst | ui-architect |
| システム全体のアーキテクチャ決定 | solution-architect | api-architect, data-architect |
| API エンドポイント設計 | api-architect | backend-lead |
| DB スキーマ設計・変更 | data-architect | backend-lead |
| 認証・RBAC 設計 | security-architect | backend-lead, security-reviewer |
| Instagram 連携の実装・修正 | instagram-integration-engineer | source-strategist, backend-lead |
| TikTok の取り扱い整理 | tiktok-integration-strategist | source-strategist, data-governance-analyst |
| データソース取得可否の判断 | source-strategist | data-governance-analyst |
| スコアリングロジックの設計・変更 | scoring-engineer | analytics-engineer, llm-prompt-engineer |
| ブランド適合スコアの設計 | brand-fit-analyst | llm-prompt-engineer, scoring-engineer |
| リスクスコアの設計 | risk-analyst | llm-prompt-engineer, scoring-engineer |
| LLM プロンプトの作成・改善 | llm-prompt-engineer | brand-fit-analyst, risk-analyst |
| 候補推奨ロジック設計 | recommendation-engineer | scoring-engineer |
| バックエンド API の実装 | backend-lead | - |
| フロントエンド画面の実装 | frontend-engineer | design-system-engineer |
| グラフ・比較ビューの実装 | dashboard-visualization-engineer | frontend-engineer |
| PDF/CSV レポートの実装 | report-generation-engineer | backend-lead |
| テスト計画・カバレッジ設計 | test-strategist | - |
| E2E テストの実行・確認 | e2e-runner | test-strategist |
| コードレビュー | code-reviewer | - |
| セキュリティレビュー | security-reviewer | security-architect |
| CI/CD の設定・整備 | ci-cd-engineer | devops-engineer |
| インフラ・Docker 設定 | devops-engineer | - |
| 監視・アラート設定 | observability-engineer | - |
| リリース判断・デプロイ承認 | release-manager | observability-engineer |
| 大きいタスク全般 | **chief-orchestrator が分割して委任** | - |
| バックログの優先度整理 | backlog-prioritizer | product-owner |
| WBS・マイルストーン管理 | delivery-manager | chief-orchestrator |

---

## 具体的な依頼例とルーティング

### 「候補検索 UI を作りたい」

```
1. ux-flow-analyst → 画面導線・フィルタ仕様定義
2. ui-architect → コンポーネント構成・状態管理設計
3. frontend-engineer → 実装
4. code-reviewer → レビュー
```

### 「Instagram 連携方針を詰めたい」

```
1. source-strategist → 取得可否・経路・制約の整理
2. data-governance-analyst → 規約・PII チェック
3. instagram-integration-engineer → 具体的実装方針
4. ADR 記録 → architecture-decision-record スキル
```

### 「スコアロジックを改修したい」

```
1. scoring-engineer → 現行スコアの確認・変更案設計
2. analytics-engineer → 指標定義の確認
3. test-strategist → 回帰テスト計画
4. scoring-engineer → 実装
5. e2e-runner → 検証
6. ADR 記録
```

### 「TikTok の扱いを整理したい」

```
1. tiktok-integration-strategist → MVP 制約・公式 API 方針の整理
2. source-strategist → データソース優先度の確認
3. data-governance-analyst → 規約コンプライアンス確認
4. product-owner → 方針を PRD に反映
```

### 「比較 PDF を作りたい」

```
1. ux-flow-analyst → 比較レポートの画面・情報設計
2. report-generation-engineer → PDF 生成実装
3. backend-lead → API 繋ぎ込み
4. e2e-runner → PDF 出力 E2E テスト
```

### 「品質レビューをしてほしい」

```
1. code-reviewer → コードレビュー（変更しない）
2. security-reviewer → セキュリティチェック（変更しない）
3. test-strategist → カバレッジ確認
4. release-manager → リリース可否判断
```

---

## 注意: 大きいタスクは chief-orchestrator へ

複数ドメインにまたがるタスクや、どの agent に振るか判断できない場合は `chief-orchestrator` を最初の窓口にする。chief-orchestrator が分解して各 agent に委任する。
