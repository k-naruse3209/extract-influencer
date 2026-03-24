# Git ワークフロールール

## ブランチ命名

```
feature/short-description
fix/short-description
refactor/short-description
docs/short-description
chore/short-description
hotfix/short-description
```

## コミットメッセージ（Conventional Commits）

```
feat: Instagram プロフィール取得 API を追加
fix: スコア計算時のゼロ除算を修正
refactor: EngagementRateCalculator を純粋関数に変更
docs: ADR-003 スコアリング方式選定を追加
chore: 依存パッケージを更新
test: ScoreCalculator のユニットテストを追加
```

- タイトルは 72 文字以内
- 本文で「なぜ変更したか」を説明する
- Breaking change は `BREAKING CHANGE:` フッターを付ける

## PR ルール

- レビュアー最低 1 名が承認するまでマージしない
- セキュリティ関連の変更には security-reviewer の承認が必須
- データスキーマ変更には data-architect の確認が必須
- 自動テストが全部グリーンになってからマージする
- スクアッシュマージ推奨（マージコミットの積み重ねを避ける）

## 禁止事項

- `.env` / secrets をコミットしない（`.gitignore` を必ず確認する）
- main ブランチへの直接 push 禁止
- force push は main/staging に対して禁止
- TODO / console.log / print デバッグをコミットに含めない
- 未完成の機能を feature flag なしで main にマージしない

## マイグレーション管理

- DB スキーマ変更は必ずマイグレーションファイルを作成する
- マイグレーションは必ず rollback 手順をセットで用意する
- マイグレーションファイルは一度 merge したら変更しない（新規ファイルで追記）

## gotchas

- secrets が誤って push されたら即座に token を revoke する（履歴から消すだけでは不十分）
- DB マイグレーションを忘れて feature branch をマージするとデプロイが壊れる
