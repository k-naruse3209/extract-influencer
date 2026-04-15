# Railway デプロイ設定ガイド

## 概要

本ドキュメントは、Railway 上での frontend / backend サービスの設定分離方針と、デプロイ後の確認手順を記載する。

### なぜ分離したか

以前はリポジトリルートに単一の `railway.json` が存在し、両サービスが共通参照していた。  
この設計により以下の問題が発生した:

- `builder` キー未指定 → Railway がデフォルトで Dockerfile を探索
- `dockerfilePath: "backend/Dockerfile"` が frontend サービスにも適用
- API 経由で `builder: NIXPACKS` を設定しても `railway.json` が上書きする

**対策:** 各サービス専用の設定ファイルに分離し、ルートの `railway.json` を削除した。

---

## ファイル構成

```
extract-influencer/               ← リポジトリルート（Railway の rootDirectory=""）
├── frontend/
│   ├── railway.json              ← frontend service 専用設定
│   └── nixpacks.toml             ← NIXPACKS ビルド設定（monorepo root 前提）
├── backend/
│   ├── railway.json              ← backend service 専用設定
│   └── Dockerfile                ← multi-stage Docker ビルド
└── (railway.json は削除済み)
```

### frontend/railway.json のポイント

| キー | 値 | 意味 |
|------|----|------|
| `build.builder` | `"NIXPACKS"` | **必須** — 未指定だと Dockerfile 探索モードになる |
| `build.nixpacksConfigPath` | `"frontend/nixpacks.toml"` | repo root 基準でパスを指定 |
| `build.watchPatterns` | `["frontend/**", "shared/**", ...]` | frontend 関連変更のみ再デプロイ |
| `deploy.healthcheckPath` | `"/healthz"` | `GET /healthz` で `{"status":"ok"}` を返す専用 endpoint |

### backend/railway.json のポイント

| キー | 値 | 意味 |
|------|----|------|
| `build.dockerfilePath` | `"backend/Dockerfile"` | multi-stage Dockerfile を明示指定 |
| `build.watchPatterns` | `["backend/**", "shared/**", ...]` | backend 関連変更のみ再デプロイ |
| `deploy.healthcheckPath` | `"/api/v1/health"` | NestJS の既存 health endpoint |

---

## 【必須】Railway Dashboard での手動設定

設定ファイルをサービスに紐付けるには **Railway Dashboard での手動設定が必要**。

### frontend service

1. [Railway Dashboard](https://railway.app/dashboard) を開く
2. プロジェクト `zealous-compassion` → サービス `@influencer-platform/frontend`
3. **Settings** タブ → **Service** セクション
4. **Railway Config File** フィールドに `frontend/railway.json` を入力して保存

### backend service

1. 同プロジェクト → サービス `@influencer-platform/backend`
2. **Settings** タブ → **Service** セクション
3. **Railway Config File** フィールドに `backend/railway.json` を入力して保存

> **なぜ必要か:** Railway は `railwayConfigFile` が未設定の場合、リポジトリルートの `railway.json` を探す。ルートを削除した今は API 設定が使われるが、明示的に紐付けることで「どのファイルが使われているか」が Dashboard から確認できる。

---

## デプロイ後の確認手順

### 1. Railway Dashboard でどの Config File が使われたか確認

1. 該当サービス → **Deployments** タブ
2. 最新デプロイをクリック → **Build Logs** を開く
3. 冒頭に以下のような行が表示される:

```
Using config from: frontend/railway.json
```

または build フェーズの冒頭で `nixpacksConfigPath` に指定したファイルが読まれているか確認。

### 2. frontend ヘルスチェック確認

```bash
# HTTP 200 + JSON レスポンスを確認
curl -sf https://<FRONTEND_URL>/healthz | jq .
# 期待値: {"status":"ok","timestamp":"2026-04-15T..."}
```

### 3. backend ヘルスチェック確認

```bash
curl -sf https://influencer-platformbackend-production.up.railway.app/api/v1/health | jq .
```

### 4. frontend → backend API プロキシ確認

```bash
# Next.js rewrites 経由で backend API が通るか確認
curl -sf https://<FRONTEND_URL>/api/v1/health | jq .
```

---

## 再発防止チェックリスト

デプロイ設定を変更するたびに以下を確認する:

- [ ] `railway.json` に **`"builder"` キーを明示**している（未指定は Dockerfile 探索になる）
- [ ] リポジトリルートに `railway.json` を **置かない**（共通設定として使わない）
- [ ] 各サービスの **Railway Config File** が正しいパスに設定されている
- [ ] `healthcheckPath` にフロントエンドは `/healthz`、バックエンドは `/api/v1/health` を使用
- [ ] `watchPatterns` で **サービス間のデプロイが相互に連鎖しない**ようにしている
- [ ] `dockerfilePath` を含む設定が **フロントエンドサービスに漏れていない**

---

## トラブルシューティング

### `Dockerfile 'Dockerfile' does not exist`

**原因:** `railway.json` に `builder` キーがない、または `railwayConfigFile` が設定されていない  
**対策:** Dashboard で `railwayConfigFile` を設定する。`railway.json` に `"builder": "NIXPACKS"` を追加する。

### ヘルスチェックタイムアウト

**原因:** `healthcheckTimeout` が短い、または endpoint が起動前にチェックされる  
**対策:** `healthcheckTimeout: 120` を設定する。frontend では `/healthz`、backend では `/api/v1/health` を使用する。

### `watchPatterns` が効かない・毎回デプロイされる

**原因:** `watchPatterns` の glob パターンが正しくない  
**確認:** パターンは **リポジトリルート基準**で記述する（例: `frontend/**` ✅ / `./frontend/**` ❌）

### frontend で backend の環境変数エラーが出る

**原因:** 以前の失敗パターン A（backend Dockerfile が frontend に適用）が再発している  
**確認:** Railway Dashboard の該当デプロイ Build Logs で `Dockerfile` が使われていないか確認する。`builder: NIXPACKS` を明示する。
