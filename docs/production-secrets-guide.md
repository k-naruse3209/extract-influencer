# 本番環境 Secrets 管理ガイド

最終更新: 2026-03-21

---

## 目次

1. [環境変数一覧](#環境変数一覧)
2. [GitHub Secrets の設定手順](#github-secrets-の設定手順)
3. [Secrets ローテーション手順](#secrets-ローテーション手順)
4. [セキュリティチェックリスト](#セキュリティチェックリスト)

---

## 環境変数一覧

| 変数名 | 説明 | 必須 | 例 | 機密性 |
|--------|------|:----:|-----|:------:|
| `DATABASE_URL` | PostgreSQL 接続 URL（SSL 必須） | 必須 | `postgresql://user:pass@host:5432/db?sslmode=require` | 高 |
| `REDIS_HOST` | Redis サーバーホスト名 | 必須 | `redis.internal` | 中 |
| `REDIS_PORT` | Redis サーバーポート番号 | 必須 | `6379` | 低 |
| `JWT_SECRET` | JWT 署名キー（最低 32 文字のランダム文字列） | 必須 | `openssl rand -base64 32` で生成 | 高 |
| `JWT_EXPIRES_IN` | JWT 有効期限 | 必須 | `15m` | 低 |
| `COOKIE_SECRET` | Cookie 署名キー（最低 32 文字） | 必須 | `openssl rand -base64 32` で生成 | 高 |
| `TOKEN_ENCRYPTION_KEY` | Instagram トークン暗号化キー（64 文字 hex = 32 bytes AES-256） | 必須 | `openssl rand -hex 32` で生成 | 高 |
| `INSTAGRAM_CLIENT_ID` | Instagram Graph API クライアント ID | 必須 | `1234567890` | 高 |
| `INSTAGRAM_CLIENT_SECRET` | Instagram Graph API クライアントシークレット | 必須 | `abcdef1234567890...` | 高 |
| `INSTAGRAM_REDIRECT_URI` | Instagram OAuth コールバック URL | 必須 | `https://app.example.com/api/v1/auth/instagram/callback` | 低 |
| `ANTHROPIC_API_KEY` | Anthropic Claude API キー | 必須 | `sk-ant-...` | 高 |
| `ANTHROPIC_MODEL` | 使用する Claude モデル ID | 必須 | `claude-haiku-4-5-20251001` | 低 |
| `PORT` | バックエンドサーバーのリッスンポート | 任意 | `3001` | 低 |
| `NODE_ENV` | 実行環境識別子 | 必須 | `production` | 低 |
| `CORS_ORIGIN` | 許可するフロントエンドオリジン（本番ドメイン） | 必須 | `https://app.example.com` | 低 |
| `REPORT_OUTPUT_DIR` | PDF/CSV レポートの出力ディレクトリ | 必須 | `/app/storage/reports` | 低 |

### 機密性の定義

- **高**: 漏洩した場合にシステム侵害・不正アクセス・金銭的損失につながる。Secret Manager または GitHub Secrets で管理する。
- **中**: 内部ネットワーク情報。外部に公開しないが漏洩時の影響は限定的。
- **低**: 公開情報または設定値。漏洩しても直接的な損害なし。

---

## GitHub Secrets の設定手順

### 設定場所

GitHub リポジトリページ > **Settings** > **Secrets and variables** > **Actions** > **New repository secret**

### 設定する Secrets の一覧

以下の Secret を順番に登録してください。

#### DATABASE_URL

```
名前: DATABASE_URL
値: postgresql://<user>:<password>@<host>:5432/<dbname>?sslmode=require
```

本番 PostgreSQL の接続 URL を設定します。`?sslmode=require` を必ず付加して SSL 接続を強制してください。

#### REDIS_HOST / REDIS_PORT

```
名前: REDIS_HOST
値: <Redis サーバーのホスト名または IP アドレス>

名前: REDIS_PORT
値: 6379
```

#### JWT_SECRET

```
名前: JWT_SECRET
値: <生成したランダム文字列>
```

生成コマンド:

```bash
openssl rand -base64 32
```

出力例（実際の値を使用すること）:

```
K7mP2xQnR8vLdHjF5tYsWcGbNuAeZiOp3w==
```

最低 32 文字以上が必須です。短すぎると JWT の安全性が損なわれます。

#### COOKIE_SECRET

```
名前: COOKIE_SECRET
値: <生成したランダム文字列>
```

生成コマンド:

```bash
openssl rand -base64 32
```

JWT_SECRET とは別に独立した値を使用してください。

#### TOKEN_ENCRYPTION_KEY

```
名前: TOKEN_ENCRYPTION_KEY
値: <生成した 64 文字 hex 文字列>
```

生成コマンド:

```bash
openssl rand -hex 32
```

出力例（実際の値を使用すること）:

```
a3f2c1e8b4d7960521034e6f78a9bc1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6078
```

この値は AES-256-GCM 暗号化で Instagram アクセストークンを保護するために使用します。必ず 64 文字の hex 文字列（32 bytes）を設定してください。

#### INSTAGRAM_CLIENT_ID / INSTAGRAM_CLIENT_SECRET

```
名前: INSTAGRAM_CLIENT_ID
値: <Meta Developer Console のアプリ ID>

名前: INSTAGRAM_CLIENT_SECRET
値: <Meta Developer Console のアプリシークレット>
```

取得元: [Meta for Developers](https://developers.facebook.com/) > マイアプリ > 対象アプリ > 基本設定

#### ANTHROPIC_API_KEY

```
名前: ANTHROPIC_API_KEY
値: sk-ant-<your-key>
```

取得元: [Anthropic Console](https://console.anthropic.com/) > API Keys

このキーはログに出力しないこと。NestJS のロガー設定で `ANTHROPIC_API_KEY` のマスキングを確認してください。

### CI ワークフローでの利用方法

`.github/workflows/ci.yml` の E2E テストジョブでは GitHub Secrets を以下のように参照します:

```yaml
env:
  DATABASE_URL: ${{ secrets.DATABASE_URL }}
  JWT_SECRET: ${{ secrets.JWT_SECRET }}
  COOKIE_SECRET: ${{ secrets.COOKIE_SECRET }}
  TOKEN_ENCRYPTION_KEY: ${{ secrets.TOKEN_ENCRYPTION_KEY }}
  INSTAGRAM_CLIENT_ID: ${{ secrets.INSTAGRAM_CLIENT_ID }}
  INSTAGRAM_CLIENT_SECRET: ${{ secrets.INSTAGRAM_CLIENT_SECRET }}
  ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

注意: 現在の `ci.yml` の E2E ジョブはテスト用のダミー値を使用しています。本番デプロイジョブを追加する場合は、上記のように GitHub Secrets を参照してください。

---

## Secrets ローテーション手順

### JWT_SECRET のローテーション

JWT の有効期限は `JWT_EXPIRES_IN=15m`（15分）に設定されています。

**手順:**

1. 新しい JWT_SECRET を生成する。
   ```bash
   openssl rand -base64 32
   ```

2. アプリケーションが新旧両方のシークレットを受け入れる「デュアルキーモード」を一時的に有効化する（NestJS の JwtModule で `secret` と `issuer` を利用したキー識別を実装している場合）。

3. GitHub Secrets の `JWT_SECRET` を新しい値に更新する。

4. デプロイを実行する。デプロイ後、既存のセッションは最大 15 分（JWT 有効期限）で自然に無効化されます。

5. 15 分経過後、旧キーのサポートを削除して再デプロイする（デュアルキーモードを実装している場合）。

**影響範囲:** ローテーション直後から既存の JWT は無効になります（デュアルキーモードなしの場合）。ユーザーは再ログインが必要になります。メンテナンス時間帯に実施することを推奨します。

### TOKEN_ENCRYPTION_KEY のローテーション

このキーは保存済みの Instagram アクセストークンの暗号化に使用されています。ローテーション時は既存の暗号化トークンの再暗号化が必要です。

**手順:**

1. 新しい TOKEN_ENCRYPTION_KEY を生成する。
   ```bash
   openssl rand -hex 32
   ```

2. 既存の暗号化トークンをすべて DB から取得し、旧キーで復号後に新キーで再暗号化するマイグレーションスクリプトを作成・実行する。

   ```bash
   # マイグレーションスクリプト例（backend/scripts/ に配置）
   npx ts-node backend/scripts/rotate-token-encryption-key.ts \
     --old-key <旧キー> \
     --new-key <新キー>
   ```

3. マイグレーション完了後、GitHub Secrets の `TOKEN_ENCRYPTION_KEY` を新しい値に更新する。

4. デプロイを実行する。

**注意:** 手順 2 と 3 の間にデプロイが発生すると、再暗号化済みトークンを旧キーで読もうとして復号失敗が発生します。メンテナンスウィンドウ内でアトミックに実行してください。

### ANTHROPIC_API_KEY のローテーション

1. [Anthropic Console](https://console.anthropic.com/) > API Keys で新しいキーを発行する。
2. GitHub Secrets の `ANTHROPIC_API_KEY` を新しい値に更新する。
3. デプロイを実行する。
4. デプロイ後に旧キーを Anthropic Console で無効化する。

**影響範囲:** デプロイ中の数分間、API 呼び出しが失敗する可能性があります。LLM を使う分析機能（ブランド適合コメント生成など）が一時的に `unavailable` を返します。

### INSTAGRAM_CLIENT_ID / INSTAGRAM_CLIENT_SECRET のローテーション

1. [Meta for Developers](https://developers.facebook.com/) > 対象アプリ > 基本設定 でシークレットを再生成する。
2. GitHub Secrets の `INSTAGRAM_CLIENT_ID` と `INSTAGRAM_CLIENT_SECRET` を更新する。
3. デプロイを実行する。
4. **重要:** シークレット変更後、既存のユーザーの Instagram アクセストークンは無効化される可能性があります。ユーザーへの再認証促知を検討してください。

---

## セキュリティチェックリスト

デプロイ前に以下をすべて確認してください。

### ファイル管理

- [ ] `.env` および `.env.local` が `.gitignore` に記載されている
- [ ] `git log --all -- backend/.env.local` でコミット履歴に `.env.local` が含まれていないことを確認した
- [ ] `git log --all -- backend/.env` でコミット履歴に `.env` が含まれていないことを確認した

### GitHub Secrets

- [ ] `DATABASE_URL` が GitHub Secrets に設定されている
- [ ] `REDIS_HOST` が GitHub Secrets に設定されている
- [ ] `REDIS_PORT` が GitHub Secrets に設定されている
- [ ] `JWT_SECRET` が GitHub Secrets に設定されている
- [ ] `COOKIE_SECRET` が GitHub Secrets に設定されている
- [ ] `TOKEN_ENCRYPTION_KEY` が GitHub Secrets に設定されている
- [ ] `INSTAGRAM_CLIENT_ID` が GitHub Secrets に設定されている
- [ ] `INSTAGRAM_CLIENT_SECRET` が GitHub Secrets に設定されている
- [ ] `ANTHROPIC_API_KEY` が GitHub Secrets に設定されている

### Secret の品質

- [ ] `JWT_SECRET` が最低 32 文字（`echo -n "$JWT_SECRET" | wc -c` で確認）
- [ ] `COOKIE_SECRET` が最低 32 文字
- [ ] `TOKEN_ENCRYPTION_KEY` がちょうど 64 文字の hex 文字列（`echo -n "$TOKEN_ENCRYPTION_KEY" | wc -c` で確認）
- [ ] `JWT_SECRET` と `COOKIE_SECRET` が異なる値である
- [ ] ローカル開発用のデフォルト値（`change-me-in-production`、`local-dev-*`）が本番に使用されていない

### データベース

- [ ] `DATABASE_URL` に `?sslmode=require` が付加されている
- [ ] 本番 DB のユーザーは最小権限（SELECT / INSERT / UPDATE / DELETE のみ。CREATE TABLE / DROP TABLE は持たない）
- [ ] Prisma マイグレーションは専用の DB ユーザーまたは CI ステップで実行している

### アプリケーション設定

- [ ] `NODE_ENV=production` が設定されている
- [ ] `CORS_ORIGIN` が本番フロントエンドドメイン（例: `https://app.example.com`）に制限されている。ワイルドカード `*` は禁止
- [ ] `INSTAGRAM_REDIRECT_URI` が本番ドメインに設定されている

### コード内の確認

- [ ] バックエンドのログ設定で `ANTHROPIC_API_KEY`、`JWT_SECRET`、`TOKEN_ENCRYPTION_KEY` がマスキングされている
- [ ] `ANTHROPIC_API_KEY` を `sk-ant-` で始まる形式でログ出力していないことを `grep -r "ANTHROPIC_API_KEY" backend/src/` で確認した
- [ ] `TOKEN_ENCRYPTION_KEY` が環境変数以外の場所（設定ファイル、ソースコード）に記載されていないことを確認した

---

## 関連ドキュメント

- `backend/.env.production.example` — 本番環境用環境変数テンプレート
- `backend/.env.example` — 開発環境用環境変数テンプレート
- `.claude/rules/security.md` — プロジェクト全体のセキュリティルール
- `.github/workflows/ci.yml` — CI における環境変数の利用状況
