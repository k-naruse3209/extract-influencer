---
name: security-and-privacy
description: セキュリティ設計・PII管理・認証認可・RBAC・audit log・プロンプトインジェクション対策のワークフロー。認証/認可実装時・APIキー管理変更時・個人情報を扱う機能を追加するときに必ず参照する。
user-invocable: true
allowed-tools:
  - Read
  - Glob
  - Grep
---

# セキュリティ・プライバシー スキル

## 目的

このプロジェクトにおけるセキュリティ要件を一貫して満たし、PII 漏洩・API 不正利用・インジェクション攻撃を防ぐ。

---

## Secrets 管理

- API キー・トークン・パスワードはコードに直書き禁止
- `.env` または Secret Manager を使う
- `.env` は `.gitignore` に必ず含める
- ログに PII（Instagram username・メールアドレス等）を出力しない

### Instagram アクセストークンの取扱い

- ユーザートークン（短命: 1時間）とロングリブドトークン（60日）を混在させない
- トークンは DB に暗号化して保存する（平文禁止）
- 期限切れトークンは自動検知してリフレッシュするか、ユーザーに再認証を促す

---

## 認証・認可

- エンドポイントはデフォルト認証必須
- 認証不要なエンドポイントは明示的に除外リストに記載する
- セッションは httpOnly + secure cookie または短命 JWT（有効期限 15 分以内）

### RBAC

| ロール | 権限 |
|--------|------|
| admin | 全操作（ユーザー管理・API キー管理含む） |
| analyst | 候補検索・保存・比較・レポート出力 |
| viewer | 保存済み候補の閲覧・レポートの閲覧のみ |

---

## インジェクション対策

- SQL: パラメータバインドのみ使用。文字列結合でクエリを組み立てない
- XSS: フロントエンドで外部データを `innerHTML` に直接挿入しない。LLM 生成コメントは必ずエスケープする
- Prompt Injection: ユーザー入力をプロンプトに埋め込む前にサニタイズする

```typescript
// 悪い例: LLM レスポンスをそのまま innerHTML に
element.innerHTML = llmResponse.comment;

// 良い例: テキストとして扱う
element.textContent = llmResponse.comment;
```

---

## Audit Log

以下の操作を全て記録する:
- ユーザー追加・削除・ロール変更
- API キーの発行・失効
- 管理者によるスコア手動変更
- レポートのエクスポート（誰が何をいつ出力したか）

Audit log は削除・改ざん不可の設計にする（append-only テーブル）。

---

## データ最小化

- 必要最低限の Instagram スコープのみ要求する
- 取得したデータの保持期間を定義する（例: 30日後に自動削除）
- ログに含めてよいもの: アクション種別, タイムスタンプ, user_id（ハッシュ化）
- ログに含めてはいけないもの: Instagram username, email, 生のアクセストークン

---

## OWASP Top 10 チェックリスト

実装完了後に security-reviewer が以下を確認する:
- [ ] A01 アクセス制御の欠陥 → RBAC テスト済みか
- [ ] A02 暗号化の失敗 → トークン・パスワードが暗号化されているか
- [ ] A03 インジェクション → SQL・XSS・Prompt Injection 対策済みか
- [ ] A05 セキュリティ設定のミス → デフォルト認証が有効か
- [ ] A09 セキュリティログの欠如 → audit log が動作しているか

---

## gotchas

- LLM レスポンスをそのまま HTML に埋め込むと XSS になる。必ずエスケープする
- Instagram のアクセストークンを誤って push したら即座に revoke する（履歴から消すだけでは不十分）
- RBAC テストは全ロールで実施する。admin だけテストして viewer を忘れるケースが多い
