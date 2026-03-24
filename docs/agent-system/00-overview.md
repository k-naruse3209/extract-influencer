# エージェントチーム 全体像

## 目的

インフルエンサー候補抽出・深掘り評価プラットフォームを、仕様策定から設計・実装・検証・運用準備まで、Claude Code 上で動作する専門エージェントチームで構築する。

1つの AI に全部やらせない。専門分化した 35 エージェントが、明確な責務分担と成果物ファイルを通じて協調する。

---

## なぜこの構成か

### 課題

- インフルエンサー分析は「データ取得の合法性」「スコアリングの根拠」「LLM 生成コメントの信頼性」という複数の専門ドメインが交差する
- 1つの大きな AI タスクにまとめると、品質の検証が困難になり、保守性が下がる

### 解決策

- ドメインごとに agent を分割し、責務と非責務を明確にする
- `Explore → Plan → Build → Verify → Review → Document` のフェーズを agent が引き継ぐ
- 成果物ファイル（仕様書・ADR・テスト結果）を通じて agent 間で情報を受け渡す

---

## チーム構成（8部門 35エージェント）

```
00-orchestration/     chief-orchestrator, delivery-manager, backlog-prioritizer
01-product-and-domain/ product-owner, domain-analyst, ux-flow-analyst, requirements-editor
02-architecture/       solution-architect, api-architect, data-architect, security-architect
03-data-source/        source-strategist, instagram-integration-engineer,
                       tiktok-integration-strategist, data-governance-analyst
04-backend/            backend-lead, analytics-engineer, scoring-engineer,
                       report-generation-engineer
05-frontend/           ui-architect, frontend-engineer, design-system-engineer,
                       dashboard-visualization-engineer
06-ai-intelligence/    llm-prompt-engineer, brand-fit-analyst, risk-analyst,
                       recommendation-engineer
07-quality/            test-strategist, e2e-runner, code-reviewer, security-reviewer
08-devops/             devops-engineer, ci-cd-engineer, observability-engineer,
                       release-manager
```

---

## データ分離の大原則

このプラットフォームでは、全ての出力データで以下の型を区別する:

| type | 意味 | 例 |
|------|------|-----|
| fact | API から取得した事実 | フォロワー数、投稿数 |
| estimated | 計算・推定値 | エンゲージメント率 |
| llm | LLM が生成した値 | ブランド適合コメント |
| unavailable | 取得不可 | 非公開アカウントのデータ |

どのフィールドも `type` と `source` を必ず付与する。推定を事実として扱わない。

---

## 参照先

- ルーティング詳細: `02-routing-matrix.md`
- 各エージェントの責務: `01-org-design.md`
- スキル一覧: `03-skill-map.md`
- 完了条件: `05-definition-of-done.md`
- 日常運用: `06-operating-manual.md`
