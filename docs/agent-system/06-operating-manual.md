# 運用マニュアル

## 日常運用の基本フロー

```
Explore → Plan → Build → Verify → Review → Document
```

---

## 新機能を作るとき

### Step 1: Explore（探索）

```
1. repo-mapping スキルでリポジトリ構成を把握する
2. 関連する既存ファイルを Read で確認する
3. 既存の ADR と仕様書を確認する
```

### Step 2: Plan（計画）

```
1. chief-orchestrator にタスクを投げて分解させる
2. product-owner が PRD を作成する（product-spec-workflow スキル）
3. solution-architect がアーキテクチャを設計する
4. data-source-compliance スキルを実行する（データ取得が絡む場合必須）
5. DoD と検証方法を定義する
```

### Step 3: Build（実装）

```
1. api-architect が API 設計する
2. data-architect が DB スキーマ設計する
3. backend-lead が API を実装する
4. frontend-engineer が画面を実装する
5. scoring-engineer / llm-prompt-engineer が AI ロジックを実装する（必要な場合）
```

### Step 4: Verify（検証）

```
1. testing-and-verification スキルに従ってテストを実施する
2. e2e-runner が E2E テストを実行する
3. スコア変更がある場合は回帰テストを実施する
```

### Step 5: Review（レビュー）

```
1. code-reviewer がコードレビューする（コード変更なし）
2. security-reviewer がセキュリティレビューする（セキュリティ関連変更時必須）
```

### Step 6: Document（ドキュメント）

```
1. doc-sync スキルを実行する
2. 必要な ADR を追加する
3. API ドキュメントを更新する
```

---

## 既存設計を変更するとき

スコアリング変更・API 変更・スキーマ変更の場合:

1. 変更前に `scoring-and-analytics` / `architecture-decision-record` スキルを参照する
2. 互換性への影響を確認する
3. 変更理由を ADR に記録する
4. 回帰テストを実施する
5. `doc-sync` でドキュメントを更新する

---

## スキルを追加するとき

1. `.claude/skills/[skill-name]/SKILL.md` を作成する（frontmatter 必須）
2. `docs/agent-system/03-skill-map.md` にスキルを追加する
3. 使用するエージェントのファイルに参照を追加する
4. `doc-sync` を実行する

スキル名は kebab-case。description は「何をするか + いつ呼ぶか」が一目で分かるように書く。

---

## エージェントを改訂するとき

1. `.claude/agents/[部門]/[agent-name].md` を更新する
2. `docs/agent-system/01-org-design.md` の役割一覧を更新する
3. `docs/agent-system/02-routing-matrix.md` を更新する（ルーティング変更時）
4. 他エージェントとの責務重複が生じていないか確認する

---

## 迷ったときの優先順位

1. **安全** — データ取得経路・セキュリティ・PII の取り扱い
2. **検証可能性** — テストできるか・根拠を説明できるか
3. **保守性** — 別の人が引き継げるか・ドキュメントはあるか
4. **開発速度** — 速く作ること

迷ったら `chief-orchestrator` を窓口にする。

---

## よくある失敗パターンと対処

| 失敗 | 対処 |
|------|------|
| ドキュメントが古い | 実装と同時に doc-sync を実行する習慣を作る |
| スコアロジックを変更したら既存スコアと乖離した | scoring-and-analytics スキルの互換性方針に従う |
| InstagramAPI の rate limit に引っかかった | instagram-integration-engineer の設計に従いリトライ・バックオフを実装する |
| LLM レスポンスが JSON 崩れでエラー | try/catch + フォールバックを必ず実装する |
| セキュリティレビューを飛ばしてリリースした | release-readiness スキルのチェックリストを必ず通す |
| TikTok の大規模自動収集を実装しようとした | MVP 制約を確認。tiktok-integration-strategist に相談する |
