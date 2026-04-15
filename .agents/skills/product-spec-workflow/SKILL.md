---
name: product-spec-workflow
description: PRD・ユーザーストーリー・受け入れ条件・画面要件・非機能要件の作成ワークフロー。新機能の要件定義を始めるとき、またはPRDを書くときに使う。
allowed-tools:
  - Read
  - Write
  - Glob
---

# Product Spec Workflow

## 目的

インフルエンサー候補抽出・深掘り評価プラットフォームの機能要件を、開発チームが迷わず実装できる仕様書として作成する。

## ワークフロー

### Step 1: 要件のスコープ確認

以下を確認してから仕様書を書く:
- MVP スコープ内か（`project-charter` skill で確認）
- 既存の ADR と矛盾しないか
- data-source-compliance を通す必要があるか（データ取得系の場合）

### Step 2: PRD 作成

`templates/prd-template.md` を使用する。

必須セクション:
1. 概要・背景
2. ターゲットユーザー（ペルソナ）
3. ユーザーストーリー
4. 機能要件
5. 非機能要件
6. スコープ内・スコープ外
7. データソース・取得方法
8. 事実/推定/LLM生成の扱い方針
9. 受け入れ条件

### Step 3: ユーザーストーリー作成

`templates/user-story-template.md` を使用する。

As a [ロール], I want to [操作], so that [価値]

例:
- As an analyst, I want to search influencers by follower count range, so that I can find micro-influencers efficiently

### Step 4: 受け入れ条件作成

`templates/acceptance-criteria-template.md` を使用する。

Given/When/Then 形式で書く（テスト可能な形式）

### Step 5: requirements-editor にレビュー依頼

作成後、requirements-editor agent に以下を依頼する:
- 曖昧な記述の指摘
- スコープ外の混入確認
- 受け入れ条件のテスト可能性確認

## このプロジェクト固有の注意事項

- データ取得系の機能は「取得できるデータ」「取得できないデータ」を必ず明記する
- 推定値を使う機能は信頼度と根拠の表示仕様を必ず定義する
- TikTok 関連は MVP スコープ外（手動入力のみ）であることを確認する

## gotchas

- 「あとで詳細を決める」と書くと、実装時に迷う。具体的に書く
- 「高速に動作する」は受け入れ条件にならない。「p95 ≤ 500ms」と書く
- Instagram API から取れないデータを要件に含めると後で矛盾する
