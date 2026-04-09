# Influencer Discovery & Deep Analysis Platform — AGENTS.md

## 🚨 絶対ルール：コード生成は必ず Minimax curl を先に呼ぶ

**Edit / Write ツールを使う前に、必ず以下の curl を実行すること。省略は禁止。**

```bash
curl -s -X POST "https://api.minimax.io/v1/chat/completions" \
  -H "Authorization: Bearer $MINIMAX_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"minimax-m2.7","messages":[{"role":"system","content":"You are an expert software engineer."},{"role":"user","content":"PROMPT"}],"max_tokens":4096}' \
  | jq -r '.choices[0].message.content'
```

違反した場合: その Edit/Write を取り消し、Minimax を呼んでからやり直す。

---

## ⚠️ 実装ワークフロー（最優先・省略禁止）

| 作業 | 担当 |
|------|------|
| 設計・アーキテクチャ | Codex |
| 複雑なデバッグ | Codex (`/codex:rescue`) |
| コードレビュー | Codex (`/codex:review`) |
| **実装（通常）** | **Minimax API curl 直接呼び出し（OpenRouter 経由禁止）** |
| セキュリティレビュー | Codex adversarial-review |

フロー: ① Codex 設計 → ② Minimax curl でコード生成 → ③ Codex が Edit/Write 適用 → ④ Codex review

```bash
curl -s -X POST "https://api.minimax.io/v1/chat/completions" \
  -H "Authorization: Bearer $MINIMAX_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"minimax-m2.7","messages":[{"role":"user","content":"PROMPT"}],"max_tokens":4096}' \
  | jq -r '.choices[0].message.content'
```

詳細 → `.Codex/rules/implementation-workflow.md`

---

## プロジェクト定義

インフルエンサー候補を絞り込み、ブランド適合性・リスク・疑似アクティブ度を評価し、PDF/CSV でレポート出力するプラットフォーム。

**MVP 範囲:** Instagram 深掘り分析 / 候補保存・比較（最大10件）/ スコア算出 / PDF・CSV 出力 / 管理画面

**非目標:** TikTok 大規模探索 / MEO 操作 / SNS 自動投稿 / フォロワー購入 / 未承認スクレイピング

---

## 重要制約（全エージェント共通）

1. **公式経路優先**: Instagram Graph API 最優先。未承認スクレイピング禁止
2. **データ分離**: 事実・推定値・LLM コメントをフィールドレベルで分離
3. **欠損明示**: 取得不可データは `"status":"unavailable"` または `"estimated"` を返す
4. **断定禁止**: 推定・LLM 結果には根拠と信頼度 (low/medium/high) を付ける
5. **TikTok**: MVP では本人連携・手動入力のみ
6. **PII 最小化**: 個人情報をログに出力しない

---

## 推奨ワークフロー

`Explore → Plan → Build → Verify → Review → Document`

| フェーズ | Skill |
|---------|-------|
| Explore | `repo-mapping` |
| Plan | `architecture-decision-record` |
| Verify | `testing-and-verification` |
| Document | `doc-sync` |

---

## エージェント委任ルール

| 依頼カテゴリ | 優先担当 |
|-------------|---------|
| 要件整理・PRD | product-owner / domain-analyst / requirements-editor |
| 画面導線・UI | ux-flow-analyst / ui-architect / frontend-engineer |
| API / DB / 方式選定 | solution-architect / api-architect / data-architect |
| Instagram 連携 | source-strategist / instagram-integration-engineer / data-governance-analyst |
| TikTok | tiktok-integration-strategist / source-strategist |
| スコアリング・分析 | analytics-engineer / scoring-engineer |
| LLM・ブランド適合・リスク | llm-prompt-engineer / brand-fit-analyst / risk-analyst |
| バックエンド実装 | backend-lead |
| フロントエンド実装 | frontend-engineer / dashboard-visualization-engineer |
| PDF/CSV レポート | report-generation-engineer |
| テスト・QA | test-strategist / e2e-runner / code-reviewer |
| セキュリティ | security-architect / security-reviewer |
| CI/CD・リリース | devops-engineer / ci-cd-engineer / release-manager |
| 大きいタスク全般 | **chief-orchestrator が分割してから委任** |

---

## Skill 一覧

| Skill | 使うとき |
|-------|---------|
| `repo-mapping` | 作業開始前 |
| `product-spec-workflow` | PRD 作成時 |
| `architecture-decision-record` | 方式選定時 |
| `data-source-compliance` | データ取得方針決定時 |
| `api-backend-standards` | API 設計・実装時 |
| `frontend-dashboard-standards` | 画面設計・実装時 |
| `scoring-and-analytics` | スコア設計・変更時 |
| `prompt-and-evaluation` | LLM プロンプト設計時 |
| `testing-and-verification` | テスト計画・実施時 |
| `security-and-privacy` | セキュリティ設計時 |
| `release-readiness` | リリース前 |
| `doc-sync` | 実装完了後 |

---

## チェックリスト

**実装前:** DoD 定義 / 検証方法 / ADR 整合 / data-source-compliance / セキュリティ要件

**実装後:** UT ≥80% / 統合テスト / console.log 削除 / TODO 削除 / doc-sync 実施

---

## ルール要約

**docs:** 変更から 24h 以内に `docs/agent-system/` 更新。API 追加時はエンドポイント一覧更新。

**Git:** ブランチは `feature/fix/refactor/docs/chore/` プレフィックス。Conventional Commits。PR はレビュアー1名以上。secrets/.env コミット禁止。

**テスト:** UT ≥80%（スコアリング層 ≥90%）/ 統合テスト全エンドポイント / E2E 主要フロー / スコアロジックは回帰テスト必須。

**壊しやすい箇所:** スコアモデル変更（互換性確認）/ Instagram API 変更（レート制限・スコープ）/ PDF/CSV フォーマット変更（後方互換）/ 認証・RBAC 変更（全ロール再テスト）/ スキーマ変更（rollback セット）

---

## 参照

- `docs/agent-system/00-overview.md` — エージェントチーム全体像
- `docs/agent-system/02-routing-matrix.md` — 委任先一覧
- `docs/agent-system/05-definition-of-done.md` — 完了条件
- `.Codex/rules/` — 開発ルール
- `.Codex/skills/` — 作業手順
- `.Codex/agents/` — エージェント定義
