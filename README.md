# Influencer Discovery & Deep Analysis Platform

Instagram インフルエンサーの発掘・分析・比較・レポート出力を行うプラットフォームです。

---

## 目次

- [機能一覧](#機能一覧)
- [セットアップ](#セットアップ)
- [使い方](#使い方)
  - [ログイン](#1-ログイン)
  - [Instagram 連携](#2-instagram-連携)
  - [候補検索・登録](#3-候補検索登録)
  - [データ取得](#4-データ取得)
  - [スコア計算](#5-スコア計算)
  - [候補の保存](#6-候補の保存)
  - [候補の比較](#7-候補の比較)
  - [レポート生成](#8-レポート生成)
  - [管理機能](#9-管理機能)
- [技術スタック](#技術スタック)

---

## 機能一覧

| 機能 | 説明 |
|------|------|
| 候補検索 | Instagram ユーザー名でインフルエンサーを検索・登録 |
| データ取得 | Instagram Graph API 経由でプロフィール・投稿データを自動取得 |
| スコア計算 | ブランド適合性・エンゲージメント・疑似アクティブ度・リスク・成長性の 5 軸評価 |
| 候補保存 | 気になる候補をブックマーク保存 |
| 候補比較 | 最大 10 件の候補を並べて比較 |
| レポート生成 | PDF / CSV 形式でレポートを出力・ダウンロード |
| ダークモード | ライト / ダーク テーマの切り替え |
| 管理画面 | ユーザー管理・API キー管理（管理者のみ） |

---

## セットアップ

### 必要なもの

- Node.js 18 以上
- Docker / Docker Compose
- Meta（Facebook）Developer アカウント（Instagram API 連携用）
- Anthropic API キー（AI 分析コメント生成用、任意）

### 1. リポジトリをクローン

```bash
git clone https://github.com/k-naruse3209/extract-influencer.git
cd extract-influencer
```

### 2. 依存パッケージをインストール

```bash
npm install
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
```

### 3. 環境変数を設定

```bash
cp backend/.env.example backend/.env.local
```

`backend/.env.local` を編集して、以下の値を設定してください:

| 変数名 | 説明 | 例 |
|--------|------|-----|
| `DATABASE_URL` | PostgreSQL 接続 URL | `postgresql://user:password@localhost:5432/influencer_platform` |
| `REDIS_HOST` | Redis ホスト | `localhost` |
| `JWT_SECRET` | JWT 署名キー（任意の文字列） | `your-secret-key` |
| `COOKIE_SECRET` | Cookie 署名キー（任意の文字列） | `your-cookie-secret` |
| `INSTAGRAM_CLIENT_ID` | Facebook App ID | `884895251041997` |
| `INSTAGRAM_CLIENT_SECRET` | Facebook App Secret | Developer Console で取得 |
| `INSTAGRAM_REDIRECT_URI` | OAuth コールバック URL | `http://localhost:3001/api/v1/auth/instagram/callback` |
| `ANTHROPIC_API_KEY` | Claude API キー（任意） | `sk-ant-...` |

### 4. インフラを起動（PostgreSQL + Redis）

```bash
make dev
```

### 5. データベースのマイグレーション

```bash
make migrate
```

### 6. シードデータの投入（初回のみ）

```bash
make seed
```

### 7. バックエンドを起動

```bash
cd backend && npm run start:dev
```

`http://localhost:3001` でバックエンド API が起動します。

### 8. フロントエンドを起動（別ターミナル）

```bash
cd frontend && npm run dev
```

`http://localhost:3000` でフロントエンドが起動します。

---

## 使い方

### 1. ログイン

ブラウザで `http://localhost:3000` にアクセスし、ログイン画面からログインします。

初期ユーザーは `make seed` で作成されます（シードデータの内容を確認してください）。

### 2. Instagram 連携

1. サイドバーの **設定** をクリック
2. **Instagram 連携** ページへ移動
3. **Instagram アカウントを連携** をクリック
4. Facebook ログイン画面が表示されるので、Instagram ビジネスアカウントに紐づいた Facebook アカウントでログイン
5. アクセス許可を承認
6. 連携完了後、設定画面に「連携中」と表示されます

> **注意:** Instagram ビジネスアカウントまたはクリエイターアカウントが必要です。個人アカウントでは一部データが取得できません。

### 3. 候補検索・登録

1. サイドバーの **候補検索** をクリック
2. 検索フォームに Instagram ユーザー名を入力（例: `shinya_yamanakaya`）
3. プラットフォームで **INSTAGRAM** を選択
4. **検索** をクリック
5. 候補が登録され、詳細ページに遷移します

### 4. データ取得

候補の詳細ページで:

1. **データ取得** ボタンをクリック
2. Instagram Graph API 経由でプロフィールデータが取得されます（バックグラウンドで処理）
3. 数秒後にページをリロードすると、取得結果が反映されます

取得されるデータ:
- フォロワー数 / フォロー数 / 投稿数
- プロフィール文（自己紹介）
- プロフィール画像
- エンゲージメント率（投稿データから算出）

> **開発モードの制限:** Business Discovery API は Advanced Access（App Review 承認後）が必要です。開発モードでは、自分の Instagram アカウントのデータのみ取得可能です。

### 5. スコア計算

1. データ取得が完了した候補の詳細ページで **スコア再計算** をクリック
2. 以下の 5 つのサブスコアが算出されます:

| サブスコア | 説明 |
|-----------|------|
| **BRAND_FIT** | ブランドとの適合性（AI 分析） |
| **ENGAGEMENT** | エンゲージメント率の評価 |
| **PSEUDO_ACTIVITY** | 疑似フォロワー・不正活動の検知度 |
| **RISK** | リスク評価（低いほど安全） |
| **GROWTH** | 成長性の評価 |

- 各サブスコアは 0〜100 の範囲
- 総合スコアはサブスコアの加重平均
- 信頼度（高・中・低）も表示されます

### 6. 候補の保存

- 候補の詳細ページまたは一覧ページで **保存** ボタンをクリック
- サイドバーの **保存済み** から保存した候補の一覧を確認できます

### 7. 候補の比較

1. サイドバーの **保存済み** をクリック
2. 比較したい候補にチェックを入れる（最大 10 件）
3. **比較する** ボタンをクリック
4. 並べて比較画面が表示されます

比較画面では以下が並んで表示されます:
- プロフィール情報
- 各サブスコアのバーチャート
- フォロワー数・エンゲージメント率

### 8. レポート生成

候補の詳細ページで:

1. **レポート生成** ボタンをクリック
2. **PDF** または **CSV** を選択
3. レポートはバックグラウンドで生成されます
4. サイドバーの **レポート** ページで生成状況を確認
5. 生成完了後、**ダウンロード** ボタンからファイルを取得

比較レポートの場合:
- 比較画面から複数候補のレポートを一括生成できます

### 9. 管理機能

管理者ユーザーのみアクセス可能です。

**ユーザー管理** (`/admin/users`):
- ユーザー一覧の表示
- ユーザーの役割変更（admin / analyst / viewer）

**API キー管理** (`/admin/api-keys`):
- API キーの発行・失効
- 有効期限の設定
- 最終使用日時の確認

---

## 画面構成

```
http://localhost:3000/
  |
  +-- /login              ... ログイン
  +-- /dashboard          ... ダッシュボード（概要統計）
  +-- /candidates         ... 候補検索・一覧
  |     +-- /[id]         ... 候補詳細（データ取得・スコア・レポート）
  +-- /saved              ... 保存済み候補
  +-- /compare            ... 候補比較
  +-- /reports            ... レポート一覧・ダウンロード
  +-- /settings           ... 設定
  |     +-- /instagram    ... Instagram 連携管理
  +-- /admin/users        ... ユーザー管理（管理者のみ）
  +-- /admin/api-keys     ... API キー管理（管理者のみ）
```

---

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| フロントエンド | Next.js 14, React, TailwindCSS, React Query |
| バックエンド | NestJS, Fastify, Prisma ORM |
| データベース | PostgreSQL 16 |
| キャッシュ / キュー | Redis 7, BullMQ |
| AI 分析 | Anthropic Claude API |
| 外部 API | Instagram Graph API (Facebook Login) |
| レポート | PDFKit (PDF), csv-stringify (CSV) |

---

## ライセンス

Private Repository
