# Influencer Discovery & Deep Analysis Platform — CLAUDE.md

## プロジェクト定義

インフルエンサー候補を国・都市・ジャンル・フォロワー数で絞り込み、ブランド適合性・リスク・疑似アクティブ度を評価し、PDF/CSV でレポート出力するプラットフォーム。

---

## MVP 範囲

- Instagram アカウントを URL または username で深掘り分析
- 候補者の保存・比較（最大 10 件同時比較）
- ブランド適合スコア / リスクスコア / 疑似アクティブ度スコアの算出
- PDF レポートおよび CSV エクスポート
- 管理画面（ユーザー管理 / API キー管理）

---

## 非目標（MVP では行わない）

- TikTok の大規模自動探索（本人連携・手動入力のみ）
- Google Maps / MEO 操作
- SNS への自動投稿・DM 送信
- フォロワー購入支援・インフルエンス操作
- リアルタイムクローリング / スクレイピング（規約非承認経路）

---

## 重要制約（全エージェント共通）

1. **公式経路優先**: Instagram Graph API（公式）を最優先。未承認スクレイピングをコア設計に組み込まない
2. **データ分離原則**: 事実データ・推定値・LLM 生成コメントを必ずフィールドレベルで分離表示する
3. **欠損明示**: 取得できないデータは推定で埋めず `"status": "unavailable"` または `"status": "estimated"` を返す
4. **断定禁止**: 推定・LLM 生成結果には必ず根拠と信頼度 (low/medium/high) を付ける
5. **TikTok 制約**: MVP では TikTok を大規模探索しない。本人連携・手動入力のみを前提とする
6. **PII 最小化**: 個人情報はログに出力しない。必要最小限のみ保持する

---

## 推奨ワークフロー

```
Explore → Plan → Build → Verify → Review → Document
```

- **Explore**: repo-mapping skill で既存構成を把握してから作業開始
- **Plan**: architecture-decision-record skill で方式選定を記録
- **Build**: 実装前に DoD と検証方法を定義する
- **Verify**: testing-and-verification skill に従いテストを実施
- **Review**: code-reviewer / security-reviewer に渡す
- **Document**: doc-sync skill で docs/agent-system を同期する

---

## エージェント委任ルール

| 依頼カテゴリ | 優先担当 |
|-------------|---------|
| 要件整理・PRD・ユースケース | product-owner / domain-analyst / requirements-editor |
| 画面導線・比較UI・検索UI | ux-flow-analyst / ui-architect / frontend-engineer |
| API / DB / 非機能 / 方式選定 | solution-architect / api-architect / data-architect |
| Instagram 連携・データポリシー | source-strategist / instagram-integration-engineer / data-governance-analyst |
| TikTok の扱い整理 | tiktok-integration-strategist / source-strategist |
| スコアリング・集計・分析指標 | analytics-engineer / scoring-engineer |
| LLM プロンプト・ブランド適合・リスク | llm-prompt-engineer / brand-fit-analyst / risk-analyst |
| バックエンド実装 | backend-lead |
| フロントエンド実装 | frontend-engineer / dashboard-visualization-engineer |
| PDF/CSV レポート生成 | report-generation-engineer |
| テスト・QA | test-strategist / e2e-runner / code-reviewer |
| セキュリティ審査 | security-architect / security-reviewer |
| CI/CD / 監視 / リリース | devops-engineer / ci-cd-engineer / observability-engineer / release-manager |
| 大きいタスク全般 | **chief-orchestrator が分割してから委任** |

---

## Skill を使うべきケース

| Skill | 使うとき |
|-------|---------|
| `project-charter` | プロジェクト目的・制約の確認 |
| `repo-mapping` | 作業開始前のリポジトリ把握 |
| `product-spec-workflow` | PRD・ユーザーストーリー作成時 |
| `architecture-decision-record` | 方式選定・技術選択時 |
| `data-source-compliance` | Instagram/TikTok データ取得方針決定時 |
| `api-backend-standards` | API 設計・実装時 |
| `frontend-dashboard-standards` | 画面設計・実装時 |
| `scoring-and-analytics` | スコア設計・変更時 |
| `prompt-and-evaluation` | LLM プロンプト設計時 |
| `testing-and-verification` | テスト計画・実施時 |
| `security-and-privacy` | セキュリティ設計・実装時 |
| `release-readiness` | リリース前チェック時 |
| `doc-sync` | 実装完了後のドキュメント同期時 |

---

## 実装前チェック

- [ ] DoD（完了条件）を定義したか
- [ ] 検証方法を決めたか
- [ ] 既存の ADR や設計ドキュメントと矛盾しないか
- [ ] data-source-compliance を通過しているか（データ取得系の場合）
- [ ] セキュリティ要件を確認したか

## 実装後チェック

- [ ] ユニットテスト ≥ 80% カバレッジ
- [ ] 統合テスト実施済み
- [ ] `console.log` / `print` デバッグ残骸がないか
- [ ] TODO / HACK コメントがコミットに含まれていないか
- [ ] doc-sync skill で docs を更新したか

---

## docs 更新ルール

- 実装変更時は `docs/agent-system/` の該当箇所を **24 時間以内** に更新する
- API 追加時は必ずエンドポイント一覧を更新する
- agent / skill を追加・変更した場合は `02-routing-matrix.md` と `03-skill-map.md` を更新する
- ADR は `docs/agent-system/` 配下に追加 (`adr-NNN-*.md`)

---

## Git 運用ルール

- ブランチ: `feature/`, `fix/`, `refactor/`, `docs/`, `chore/` プレフィックスを使う
- コミット: Conventional Commits 形式（`feat:`, `fix:`, `docs:` 等）
- PR: レビュアー最低 1 名。security-reviewer は セキュリティ関連変更に必須
- main へのマージ: release-manager が承認
- secrets / .env を絶対にコミットしない

---

## テスト方針

- ユニットカバレッジ ≥ 80%（ビジネスロジック・スコアリング層は 90% 以上）
- 統合テスト: API エンドポイント全件
- E2E: 主要フロー（候補検索 → 保存 → 比較 → レポート出力）
- スコアリングロジックは回帰テストを必須とする

---

## 変更時に壊しやすい箇所

1. スコアリングモデルの変更 → 既存スコアとの互換性を確認
2. Instagram API 呼び出し変更 → レート制限とスコープ変更に注意
3. PDF/CSV 出力フォーマット変更 → 既存レポートの後方互換性
4. 認証・RBAC 変更 → 全ロールのテストを再実施
5. データベーススキーマ変更 → マイグレーションと rollback を必ずセットで用意

---

## 参照ドキュメント

- `docs/agent-system/00-overview.md` — エージェントチーム全体像
- `docs/agent-system/02-routing-matrix.md` — どの依頼を誰に振るか
- `docs/agent-system/05-definition-of-done.md` — 完了条件
- `.claude/rules/` — 開発ルール（security / coding / testing / git / context / delegation）
- `.claude/skills/` — 再利用可能な作業手順
- `.claude/agents/` — 各エージェントの役割定義
