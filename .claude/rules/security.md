# セキュリティルール

## Secrets 管理

- API キー・トークン・パスワードはコードに直書き禁止。`.env` または Secret Manager を使う
- `.env` ファイルを git に含めない。`.gitignore` に必ず追加する
- ログに PII（個人識別情報）を出力しない。Instagram username・メールアドレスをログに含めない
- 外部 API トークンは最小スコープ（必要なパーミッションのみ）で発行する

## 認証・認可

- エンドポイントはデフォルト認証必須。認証不要なエンドポイントは明示的に除外設定する
- RBAC は role ごとに最小権限原則を適用する（admin / analyst / viewer）
- セッショントークンは httpOnly + secure cookie または短命 JWT を使用する

## インジェクション対策

- SQL はパラメータバインドを使う。クエリ文字列への直接埋め込み禁止
- LLM プロンプトへのユーザー入力は必ずサニタイズする（Prompt Injection 対策）
- XSS 対策: フロントエンドで外部データを innerHTML に直接挿入しない

## データ取得

- Instagram Graph API: 未承認スクレイピングを使用しない
- TikTok: 公式 API または本人連携のみ。大規模自動収集は MVP 禁止
- 外部 URL へのリクエストは許可リストで制限する

## Audit Log

- 管理操作（ユーザー追加・削除・スコア変更）はすべて audit log に記録する
- audit log は削除・改ざん不可の設計にする

## gotchas

- Instagram の access token はユーザートークンとページトークンで有効期限が異なる。混在させない
- LLM レスポンスをそのまま HTML に埋め込むと XSS になる。必ずエスケープする
