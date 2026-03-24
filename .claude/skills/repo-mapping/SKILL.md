---
name: repo-mapping
description: リポジトリ探索・技術棚卸し・コーディング入口把握。作業開始前にリポジトリ構成を理解するときに使う。初回作業時・新機能開発前・技術スタック確認時に必ず実行する。
context: fork
allowed-tools:
  - Glob
  - Grep
  - Read
---

# Repo Mapping

## 目的

作業開始前に、このリポジトリの現在の構成・技術スタック・命名規則を把握する。

## 実行手順

### Step 1: 構成把握

```
Glob: **/* でルート構成を確認
Glob: src/**/* でソースコードを確認
Glob: tests/**/* でテスト構造を確認
```

### Step 2: 技術スタック確認

```
Read: package.json または pyproject.toml
Read: Dockerfile または docker-compose.yml
Read: .github/workflows/*.yml
```

### Step 3: 既存の設計ドキュメント確認

```
Read: docs/agent-system/00-overview.md
Read: docs/agent-system/02-routing-matrix.md
Glob: docs/**/*.md
```

### Step 4: 既存のエージェント・スキル確認

```
Glob: .claude/agents/**/*.md
Glob: .claude/skills/**/*.md
```

## 出力フォーマット

```markdown
## リポジトリ棚卸し結果

### 技術スタック
- フロントエンド: [技術名とバージョン]
- バックエンド: [技術名とバージョン]
- DB: [技術名とバージョン]
- インフラ: [構成]

### ディレクトリ構成
[主要ディレクトリの説明]

### 既存エージェント・スキル
[確認したもの]

### 作業上の注意点
[この後の作業で気をつけること]
```

## gotchas

- 大きなリポジトリでは全ファイルを読もうとしない。構成ファイルと主要ファイルだけ
- `.claude/` ディレクトリはエージェントチームの設定。変更前に必ず確認する
- `CLAUDE.md` は司令塔ファイル。矛盾しないように作業する
