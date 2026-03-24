# エージェント委任ルール

## 委任の基本原則

1. **分割してから委任**: 大きいタスクは chief-orchestrator が分割し、専門 agent に委任する
2. **単一責務**: 1つの agent に複数の専門ドメインをまたぐタスクを委任しない
3. **成果物ファイルで連携**: agent 間の情報受け渡しはファイルを通じて行う
4. **委任前に DoD を定義**: 何をもって完了とするかを委任前に決める

## どの agent に委任するか（判断フロー）

```
1. 依頼のカテゴリを CLAUDE.md の委任ルール表で確認する
2. 複数ドメインにまたがる場合は chief-orchestrator に最初に相談する
3. 単一ドメインが明確な場合は直接その agent に委任する
4. 不明な場合は chief-orchestrator → backlog-prioritizer の順に相談する
```

## モデル選択方針

| タスク種別 | 推奨モデル |
|-----------|----------|
| アーキテクチャ・セキュリティ判断 | claude-opus-4-6 |
| スコアリング方式設計 | claude-opus-4-6 |
| 通常実装（バックエンド・フロントエンド） | claude-sonnet-4-6 |
| LLM プロンプト設計・評価 | claude-sonnet-4-6 |
| コード探索・ファイル棚卸し | claude-haiku-4-5 または制限付き |
| レビュー・チェック | claude-sonnet-4-6 |

## ツール制限方針

| agent カテゴリ | 許可ツール |
|--------------|----------|
| 探索・分析系 | Read, Grep, Glob（Write/Edit 禁止） |
| レビュー系 | Read, Grep, Glob（Write/Edit 禁止） |
| 実装系 | Read, Edit, Write, Bash, Grep, Glob |
| オーケストレーション | Agent, TodoWrite, Read |

## 委任時の注意

- 実装を始める前に Plan を立てる（EnterPlanMode を活用）
- セキュリティ関連の変更は必ず security-reviewer を通す
- データソース変更は必ず data-governance-analyst を通す
- リリース判断は release-manager が行う

## gotchas

- chief-orchestrator が自分で全部実装し始めたら止める。委任が原則
- 複数 agent を並列起動するときは依存関係を確認してから起動する
- agent の出力は必ず人間がレビューする。自動マージは禁止
