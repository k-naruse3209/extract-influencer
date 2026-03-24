---
name: doc-sync
description: 実装完了後にdocs/agent-systemとREADMEを最新状態に同期するワークフロー。API追加・agent変更・skill変更・スキーマ変更後に必ず実行する。「実装したのにdocsが古い」を防ぐ。
user-invocable: true
allowed-tools:
  - Read
  - Edit
  - Write
  - Glob
---

# ドキュメント同期 スキル

## 目的

実装変更後に `docs/agent-system/` と関連ドキュメントを 24 時間以内に更新し、ドキュメントと実装の乖離を防ぐ。

---

## docs 同期チェックリスト

実装変更後に以下を確認する:

### API を追加・変更した場合

- [ ] `docs/agent-system/` の API エンドポイント一覧を更新したか
- [ ] エンドポイントの説明・レスポンス形式を更新したか
- [ ] 破壊的変更なら CHANGELOG に記載したか

### Agent を追加・変更した場合

- [ ] `.claude/agents/` のファイルを更新したか
- [ ] `docs/agent-system/02-routing-matrix.md` を更新したか
- [ ] `docs/agent-system/01-org-design.md` の役割一覧を更新したか

### Skill を追加・変更した場合

- [ ] `.claude/skills/` のファイルを更新したか
- [ ] `docs/agent-system/03-skill-map.md` を更新したか
- [ ] 関連 agent の frontmatter `skills` 参照を更新したか

### DB スキーマを変更した場合

- [ ] マイグレーションファイルが作成されているか
- [ ] `docs/agent-system/` にスキーマ変更の説明を追加したか
- [ ] ADR に記録したか（`architecture-decision-record` スキル参照）

### スコアリングロジックを変更した場合

- [ ] `docs/agent-system/` のスコア定義を更新したか
- [ ] `scoring-and-analytics` スキルの記述と一致しているか

---

## 同期手順

1. `git diff HEAD` で変更ファイルを確認する
2. 変更種別を上記チェックリストで判定する
3. 対応するドキュメントを更新する
4. 更新後に「どのドキュメントを何故更新したか」を PR 説明に記載する

---

## ドキュメントの場所

| 対象 | 場所 |
|------|------|
| エージェントチーム全体像 | `docs/agent-system/00-overview.md` |
| 役割・責務一覧 | `docs/agent-system/01-org-design.md` |
| ルーティングマトリクス | `docs/agent-system/02-routing-matrix.md` |
| スキルマップ | `docs/agent-system/03-skill-map.md` |
| 完了条件 | `docs/agent-system/05-definition-of-done.md` |
| 運用マニュアル | `docs/agent-system/06-operating-manual.md` |
| ADR | `docs/agent-system/adr-NNN-*.md` |

---

## gotchas

- 「後でドキュメントを書く」はほぼ実行されない。実装時に同時に書く習慣をつける
- ルーティングマトリクスの更新を忘れると、新しい agent に仕事が来なくなる
- ADR を書かずにアーキテクチャを変更すると、なぜその設計にしたかが分からなくなる
