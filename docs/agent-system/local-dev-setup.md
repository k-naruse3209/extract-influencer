# ローカル開発環境セットアップ

## 前提条件

| ツール | 最低バージョン | 確認コマンド |
|--------|--------------|------------|
| Docker Desktop | 4.x 以上 | `docker --version` |
| Node.js | 20 以上 | `node --version` |
| npm | 10 以上 | `npm --version` |
| GNU Make | 3.8 以上 | `make --version` |

macOS の場合、Make は Xcode Command Line Tools に含まれる (`xcode-select --install`)。

---

## 初回セットアップ

```bash
# 1. リポジトリをクローン
git clone <repository-url>
cd extract-influencer

# 2. 依存パッケージをインストール
npm install
cd backend && npm install && cd ..
cd frontend && npm install && cd ..

# 3. 環境変数ファイルを用意
cp backend/.env.example backend/.env.local
# backend/.env.local を開き、必要な値（Instagram API キー等）を埋める

# 4. インフラ（PostgreSQL + Redis）を起動
make dev

# 5. DBマイグレーションを実行
make migrate

# 6. （任意）シードデータを投入
make seed
```

セットアップ完了後の接続先:

| サービス | ホスト | ポート |
|---------|-------|-------|
| PostgreSQL | localhost | 5432 |
| Redis | localhost | 6379 |
| Backend API | localhost | 3001 |
| Frontend | localhost | 3000 |

---

## 日常の開発フロー

```bash
# インフラを起動（すでに起動済みならスキップ）
make dev

# バックエンドを起動（別ターミナル）
cd backend && npm run dev

# フロントエンドを起動（別ターミナル）
cd frontend && npm run dev
```

### テスト実行

```bash
# テスト用インフラを起動（本番DBとは別ポートで起動）
make db-test

# テスト用DBにマイグレーションを適用
make migrate-test

# ユニット + 統合テストを実行
cd backend && npm test

# テスト用インフラを停止
make db-test-stop
```

### 作業終了時

```bash
# 開発用インフラを停止（データは named volume に保持される）
make db-stop
```

---

## よくあるトラブルと解決方法

### ポート競合 (address already in use)

**症状**: `docker compose up` 時に `Error: port 5432 already in use` が出る。

**原因**: ホスト側で PostgreSQL がすでに動いている、または別のコンテナが同ポートを使用している。

**解決手順**:

```bash
# 使用中のプロセスを確認
lsof -i :5432

# ホスト側の PostgreSQL を一時停止（macOS + Homebrew の場合）
brew services stop postgresql@16

# または Docker コンテナが残っていないか確認
docker ps -a
docker rm -f <container-id>

# 再起動
make dev
```

---

### DB接続失敗 (connection refused)

**症状**: `npm run dev` 後に `Error: connect ECONNREFUSED 127.0.0.1:5432` が出る。

**確認手順**:

```bash
# コンテナの状態を確認
docker compose ps

# healthcheck が passing になるまで待つ（最大 50 秒）
docker compose ps | grep postgres
# Status が "healthy" になっていれば接続可能

# ログを確認
docker compose logs postgres
```

**よくある原因**:
- `make dev` を実行してからコンテナの healthcheck が通るまで数秒かかる。バックエンドを起動する前に `docker compose ps` で `healthy` を確認する。
- `backend/.env.local` の `DATABASE_URL` が `.env.example` のままになっている。

---

### マイグレーション失敗

**症状**: `make migrate` 時に `P1001: Can't reach database server` が出る。

**解決手順**:

```bash
# まずインフラが起動しているか確認
docker compose ps

# 起動していなければ起動
make dev

# 再度マイグレーションを実行
make migrate
```

**症状**: `make migrate` 時に `P3006: Migration failed` が出る。

```bash
# マイグレーション履歴を確認
cd backend && npx prisma migrate status

# 問題のあるマイグレーションをリセット（開発環境のみ、データが消えることに注意）
cd backend && npx prisma migrate reset
```

---

### Redis 接続失敗

**症状**: `Error: getaddrinfo ENOTFOUND redis` または `connect ECONNREFUSED 127.0.0.1:6379`

**確認手順**:

```bash
# Redis コンテナの状態を確認
docker compose ps redis

# Redis に直接接続して疎通確認
docker compose exec redis redis-cli ping
# "PONG" が返れば正常

# backend/.env.local の REDIS_HOST が "localhost" になっているか確認
# （Docker ネットワーク内ではなくホストから接続するため "localhost" が正しい）
```

---

### named volume のデータをリセットしたい

```bash
# コンテナを停止して volume ごと削除（データが完全に消えるため注意）
docker compose down -v

# 再起動してマイグレーションを再適用
make dev
make migrate
make seed
```

---

## 環境変数ファイルの管理

| ファイル | 用途 | git 管理 |
|---------|-----|---------|
| `backend/.env.example` | 変数の一覧と説明（値なし） | 管理する |
| `backend/.env.local` | 開発環境の実値（自分で用意） | 管理しない (.gitignore) |
| `backend/.env.test` | テスト実行用の固定値 | 管理する（secrets 非含有） |

Instagram API キー等の secrets は `.env.local` にのみ記載し、絶対に git にコミットしない。
誤って push してしまった場合はトークンを即座に revoke すること（履歴から削除するだけでは不十分）。

---

## 関連ドキュメント

- `docs/agent-system/adr-001-tech-stack.md` — 技術スタック選定の背景
- `docs/agent-system/adr-002-db-schema.md` — DBスキーマ設計
- `docs/agent-system/adr-003-instagram-integration.md` — Instagram API 連携方針
- `.claude/rules/security.md` — secrets 管理ルール
