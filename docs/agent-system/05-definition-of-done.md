# 完了条件（Definition of Done）

## 仕様フェーズ

- [ ] PRD が `product-spec-workflow` スキルのテンプレートで作成されている
- [ ] ユーザーストーリーと受け入れ条件が定義されている
- [ ] 非機能要件（パフォーマンス・セキュリティ・可用性）が記載されている
- [ ] MVP スコープと非目標が明示されている
- [ ] domain-analyst がドメイン用語・業務フローを確認している
- [ ] `backlog-prioritizer` が Must/Should/Could/Won't を整理している

---

## 設計フェーズ

- [ ] `solution-architect` がアーキテクチャを承認している
- [ ] `api-architect` が API 設計を承認している
- [ ] `data-architect` が DB スキーマを承認している
- [ ] `security-architect` が認証・認可設計を承認している
- [ ] 方式選定に対して ADR が作成されている（`architecture-decision-record` スキル）
- [ ] データソース（Instagram/TikTok）の取得方針が `data-source-compliance` で審査済み

---

## 実装フェーズ

- [ ] 実装前に DoD と検証方法を定義している
- [ ] コーディングスタイルルール（`.claude/rules/coding-style.md`）に従っている
- [ ] 事実/推定/LLM生成コメントがフィールドレベルで分離されている
- [ ] `console.log` / `print` デバッグが残っていない
- [ ] `TODO` / `HACK` コメントがコミットに含まれていない
- [ ] TypeScript `any` が新規導入されていない
- [ ] エラーハンドリングが統一フォーマット (`{ error: { code, message, details } }`) で実装されている

---

## テストフェーズ

- [ ] ユニットテストカバレッジ ≥ 80%（スコアリング層は ≥ 90%）
- [ ] 統合テスト: API エンドポイント全件グリーン
- [ ] E2E: 主要フロー（検索→保存→比較→レポート出力）グリーン
- [ ] スコアリングロジック変更時は回帰テスト実施済み
- [ ] PDF に必須フィールドが全て含まれているか確認済み
- [ ] CSV が UTF-8 BOM 付きで出力されるか確認済み

---

## セキュリティフェーズ

- [ ] `security-reviewer` のレビュー承認済み
- [ ] `.env` / secrets がコミットに含まれていない
- [ ] RBAC が全ロールでテスト済み
- [ ] Audit log が動作確認済み
- [ ] Prompt Injection 対策が実装されている（LLM 機能の場合）
- [ ] OWASP Top 10 チェックリスト通過済み

---

## ドキュメントフェーズ

- [ ] API エンドポイント説明が更新されている
- [ ] `docs/agent-system/` の関連ドキュメントが更新されている（24時間以内）
- [ ] スコア変更・API 変更・スキーマ変更があれば ADR が追加されている
- [ ] `doc-sync` スキルのチェックリストを通過している

---

## リリース準備フェーズ

- [ ] `release-readiness` スキルのチェックリストを通過している
- [ ] マイグレーションファイルと rollback スクリプトが用意されている
- [ ] staging 環境でのマイグレーション確認済み
- [ ] smoke テスト手順が定義されている
- [ ] `release-manager` がリリースを承認している
