# Instagram OAuth / API 修正・移行ドキュメント

**プロジェクト**: Influencer Discovery & Deep Analysis Platform  
**ドキュメント作成日**: 2026-04-09  
**対象バージョン**: commit `a63e49e`  
**対象範囲**: Instagram Graph API 統合・OAuth 認証フロー・DB スキーマ

---

## 概要

Instagramユーザー名を入力して「取得・分析」→「データ取得」を実行してもデータが取得できない問題を調査・修正した記録。  
最終的に **Facebook Login フロー → Instagram Login フロー** への完全移行を実施した。

---

## システム構成

```
Frontend (Next.js / Vercel)
    │
    │ REST API
    ▼
Backend (NestJS / Railway)
    ├── InstagramController       ← OAuth 開始・コールバック
    ├── InstagramService          ← ビジネスロジック
    ├── InstagramApiClient        ← Graph API HTTP クライアント
    ├── InstagramFetchProcessor   ← BullMQ ジョブハンドラ
    └── Prisma (PostgreSQL)       ← トークン・スナップショット保存
```

---

## 問題一覧

| # | 問題 | 重大度 | 状態 |
|---|------|--------|------|
| 1 | OAuthトークン未連携 | 高 | ✅ 修正済み |
| 2 | `appsecret_proof` 欠如 | 高 | ✅ 修正済み |
| 3 | `instagramUsername` DB 未保存 | 中 | ✅ 修正済み |
| 4 | Business Discovery API 権限エラー（開発モード） | 高 | ✅ 修正済み（フォールバック） |
| 5 | `instagram_basic` スコープ廃止による取得不可 | 高 | ✅ Instagram Login フロー移行で解決 |

---

## 問題1: OAuthトークン未連携

### 症状

```
[WARN] Instagram token not found for userId=cmnfxlwyp0000246iajh245o7. OAuth consent required.
```

データ取得ジョブが実行されるたびに上記ログが出力され、データが一切取得できない状態。

### 原因

`/settings/instagram` ページで Instagram 連携（OAuth フロー）を一度も実施していなかった。  
アプリの `instagramTokens` テーブルに該当ユーザーのレコードが存在しなかった。

### 調査方法

Railway のデプロイログで `Instagram token not found` を検索し、ジョブが `resolveAccessToken()` で即時失敗していることを確認。

### 対応

`/settings/instagram` にアクセスし「連携する」ボタンから Facebook OAuth フローを実施。  
コールバックで `instagramTokens` テーブルへトークンが保存されたことをログで確認。

---

## 問題2: `appsecret_proof` 欠如

### 症状

OAuth 連携後、データ取得を実行すると以下のエラーが発生:

```
code=100 type=GraphMethodException
message=API calls from the server require an appsecret_proof argument
```

### 原因

Facebook の App Settings で **「Require App Secret」** が有効になっている場合、  
サーバーサイドからの API コールにはすべて `appsecret_proof` パラメーターの付与が必要。

```
appsecret_proof = HMAC-SHA256(app_secret, access_token)
```

実装当初、このパラメーターを一切送信していなかった。

### 修正内容

`InstagramApiClient` に `computeAppSecretProof()` プライベートメソッドを追加し、  
全 API コールの URL パラメーターに付与するよう修正した。

```typescript
// backend/src/modules/instagram/instagram-api.client.ts

import { createHmac } from 'node:crypto'

private computeAppSecretProof(accessToken: string): string {
  return createHmac('sha256', this.clientSecret)
    .update(accessToken)
    .digest('hex')
}

// 使用例（getProfile 内）
url.searchParams.set('appsecret_proof', this.computeAppSecretProof(accessToken))
```

対象メソッド: `getProfile`, `getProfileByIgUserId`, `getProfileByUsername`, `getMediaInsights`, `getRecentMedia`, `getMediaInsightsForMedia`, `exchangeLongLivedToken`

### 変更ファイル

- `backend/src/modules/instagram/instagram-api.client.ts`

---

## 問題3: `instagramUsername` が DB に保存されていなかった

### 症状

`/settings/instagram` の設定画面で連携済みユーザー名として `@17841407124576611`（数値ID）が表示される。  
実際の Instagram ユーザー名（例: `@jananeseonline`）が保存・表示されていなかった。

またこれが原因で、後述のフォールバックロジック（自アカウントかどうかの username 比較）も動作しなかった。

### 原因

OAuthコールバック処理 (`handleOAuthCallback`) で、Instagram Business Account ID（数値）は取得・保存していたが、  
対応するユーザー名（文字列）を保存するカラムとロジックが未実装だった。

### 修正内容

#### 1. DB スキーマ変更

```prisma
// backend/prisma/schema.prisma

model InstagramToken {
  // ...既存フィールド...
  instagramUserId   String
  instagramUsername String?   // ← 追加
  // ...
}
```

#### 2. マイグレーション作成

```sql
-- backend/prisma/migrations/20260408100000_add_instagram_username/migration.sql
ALTER TABLE "instagram_tokens" ADD COLUMN "instagramUsername" TEXT;
```

#### 3. OAuth コールバックで保存

```typescript
// backend/src/modules/instagram/instagram.service.ts

await this.prisma.instagramToken.upsert({
  create: {
    instagramUserId: igAccount.igUserId,
    instagramUsername: igAccount.igUsername,  // ← 追加
    // ...
  },
  update: {
    instagramUserId: igAccount.igUserId,
    instagramUsername: igAccount.igUsername,  // ← 追加
    // ...
  },
})
```

#### 4. 接続状態取得で username を返す

```typescript
// getConnectionStatus()
return {
  connected: true,
  username: token.instagramUsername ?? token.instagramUserId ?? undefined,
  connectedAt: (token.refreshedAt ?? token.createdAt).toISOString(),
}
```

### 変更ファイル

- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/20260408100000_add_instagram_username/migration.sql`
- `backend/src/modules/instagram/instagram.service.ts`

---

## 問題4: Business Discovery API 権限エラー（開発モード）

### 症状

自アカウント以外のユーザー名でデータ取得を実行すると:

```
[WARN] Instagram API error: code=10 type=OAuthException
       message=(#10) Application does not have permission for this action
[ERRO] Job failed: Business Discovery API でのデータ取得に失敗しました（対象: @shinya_yamanakaya）
```

### 原因

Facebook アプリが **開発モード（Development Mode）** の場合、  
Business Discovery API はアプリにロールを持つユーザーのアカウントしか取得できない。  
（Tester/Developer として登録されたアカウントのみ）

### 対応と設計方針

`InstagramFetchProcessor` にフォールバックロジックを実装:

```
Business Discovery 試みる
    │
    ├── 成功 → profileData を使用
    │
    └── 失敗（code=10）
           │
           └── 自アカウントか確認（getProfileByIgUserId で username を取得）
                  │
                  ├── username 一致 → 自アカウントのデータを使用
                  └── username 不一致 → エラーをスロー（他アカウントは取得不可）
```

**問題3の修正後**、username が正しく保存されたことで、自アカウントのフォールバックが正常動作するようになった。

他アカウントの取得については、後述の問題5（Instagram Login フロー移行）で解決。

---

## 問題5: Facebook Login フロー限界・Instagram Login フローへ移行

### 症状と経緯

Business Discovery API で他アカウントを取得するために `instagram_basic`・`instagram_manage_insights` スコープを OAuth に追加しようとしたところ:

```
このコンテンツは現在ご利用いただけません
Invalid Scopes: instagram_basic, instagram_manage_insights.
This message is only shown to developers.
```

### 原因の深掘り

| 事実 | 内容 |
|------|------|
| `instagram_basic` の廃止日 | 2025年1月27日 |
| Facebook Login フローでの有効スコープ | `pages_show_list`, `pages_read_engagement`, `business_management`, `ads_read` のみ |
| Business Discovery API に必要な権限 | `instagram_business_basic`（Instagram Login フロー専用） |
| 結論 | Facebook Login フローのままでは他アカウントの Business Discovery API は永続的に使用不可 |

### 解決策: Instagram Login フローへの完全移行

#### 両フローの違い

| 項目 | Facebook Login（移行前） | Instagram Login（移行後） |
|------|--------------------------|--------------------------|
| Auth URL | `https://www.facebook.com/v21.0/dialog/oauth` | `https://www.instagram.com/oauth/authorize` |
| スコープ | `pages_show_list,pages_read_engagement,business_management,ads_read` | `instagram_business_basic,instagram_business_manage_insights` |
| Token Exchange | `GET https://graph.facebook.com/v21.0/oauth/access_token` | `POST https://api.instagram.com/oauth/access_token`（フォームエンコード） |
| Long-lived Token | `fb_exchange_token`（graph.facebook.com） | `ig_exchange_token`（graph.instagram.com） |
| IG ユーザー情報取得 | `/me/accounts?fields=instagram_business_account{id,username}` | `/me?fields=id,username,name` |
| API ベース URL | `https://graph.facebook.com` | `https://graph.instagram.com` |
| `appsecret_proof` | 必要（HMAC-SHA256） | 不要 |

#### 変更詳細

**① Auth URL・スコープ変更**（`instagram.controller.ts`）

```typescript
// 変更前
const authUrl = new URL('https://www.facebook.com/v21.0/dialog/oauth')
authUrl.searchParams.set('scope', 'pages_show_list,pages_read_engagement,business_management,ads_read')

// 変更後
const authUrl = new URL('https://www.instagram.com/oauth/authorize')
authUrl.searchParams.set('scope', 'instagram_business_basic,instagram_business_manage_insights')
```

**② Short-lived Token Exchange**（`instagram-api.client.ts`）

```typescript
// 変更前: GET リクエスト（クエリパラメーター）
const url = new URL('https://graph.facebook.com/v21.0/oauth/access_token')
url.searchParams.set('client_id', ...)
const response = await fetch(url.toString(), { method: 'GET' })

// 変更後: POST リクエスト（フォームエンコード）+ user_id を返す
const body = new URLSearchParams({
  client_id: this.clientId,
  client_secret: this.clientSecret,
  redirect_uri: this.redirectUri,
  code,
  grant_type: 'authorization_code',
})
const response = await fetch('https://api.instagram.com/oauth/access_token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: body.toString(),
})
// レスポンスに user_id（IG User ID）が含まれる
```

**③ Long-lived Token Exchange**（`instagram-api.client.ts`）

```typescript
// 変更前
url.searchParams.set('grant_type', 'fb_exchange_token')
url.searchParams.set('fb_exchange_token', shortLivedToken)
// → graph.facebook.com へ

// 変更後
url = new URL('https://graph.instagram.com/access_token')
url.searchParams.set('grant_type', 'ig_exchange_token')
url.searchParams.set('client_secret', this.clientSecret)
url.searchParams.set('access_token', shortLivedToken)
```

**④ IG ユーザー情報取得の変更**（`instagram-api.client.ts`）

```typescript
// 変更前: Facebook Pages 経由
// GET /me/accounts?fields=instagram_business_account{id,username}
// → Facebook Pages が存在しないと null が返る

// 変更後: 直接 /me を取得
// GET https://graph.instagram.com/v21.0/me?fields=id,username,name
async getInstagramMe(accessToken: string): Promise<{ id: string; username: string; name?: string }> {
  const url = new URL(`/${GRAPH_API_VERSION}/me`, GRAPH_API_BASE)
  url.searchParams.set('fields', 'id,username,name')
  url.searchParams.set('access_token', accessToken)
  return this.get(url.toString())
}
```

**⑤ appsecret_proof の全削除**

`graph.instagram.com` では `appsecret_proof` は不要（Facebook Graph API 固有の要件）。  
`computeAppSecretProof()` メソッドと全呼び出し箇所を削除。

**⑥ handleOAuthCallback の修正**（`instagram.service.ts`）

```typescript
// 変更前
const igAccount = await this.apiClient.getInstagramBusinessAccountId(longLived.accessToken)
if (!igAccount) throw new Error('Instagram Business Account が見つかりません...')

// 変更後
const igUser = await this.apiClient.getInstagramMe(longLived.accessToken)
// igUser.id, igUser.username を直接使用
```

### 変更ファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `backend/src/modules/instagram/instagram.controller.ts` | Auth URL・スコープ変更 |
| `backend/src/modules/instagram/instagram-api.client.ts` | 全 API エンドポイント・トークン交換・appsecret_proof 削除 |
| `backend/src/modules/instagram/instagram.service.ts` | handleOAuthCallback を getInstagramMe に変更 |
| `backend/src/modules/instagram/queues/instagram-fetch.processor.ts` | エラーメッセージ更新 |
| `backend/src/modules/instagram/types/instagram-api.types.ts` | ShortLivedTokenResponse に userId 追加 |

---

## Meta Developer Console の設定変更

Instagram Login フロー使用には、Meta Developer Console での追加設定が必要。

### 追加手順

1. [developers.facebook.com/apps](https://developers.facebook.com/apps) → アプリを選択
2. **「プロダクトを追加」** → **「Instagram Platform」** を追加
3. 「API setup with Instagram Business Login」を選択
4. `Instagram` → `API setup with Instagram Business Login` → `Business login settings` → `OAuth redirect URIs` に以下を登録:

```
https://influencer-platformbackend-production.up.railway.app/api/v1/auth/instagram/callback
```

### 環境変数

| 変数名 | 値 | 備考 |
|--------|-----|------|
| `INSTAGRAM_CLIENT_ID` | Facebook App ID | Instagram Login でも同じ App ID を使用 |
| `INSTAGRAM_CLIENT_SECRET` | App Secret | 同上 |
| `INSTAGRAM_REDIRECT_URI` | `https://influencer-platformbackend-production.up.railway.app/api/v1/auth/instagram/callback` | Meta Console に登録した URI と完全一致必須 |

---

## その他の変更

### CLAUDE.md の短縮

プロジェクト指示ファイル（`CLAUDE.md`）を 192行 → 107行に削減。  
**ルール・制約・委任先はすべて維持**しつつ、冗長な説明を排除した。

### Minimax 強制フックの追加

`.claude/settings.json` に `PreToolUse` フックを追加。  
Edit/Write ツール実行前に Minimax API の事前呼び出しを強制する警告を表示。

```json
"hooks": {
  "PreToolUse": [
    {
      "matcher": "Edit|Write",
      "hooks": [
        {
          "type": "command",
          "command": "echo '{\"hookSpecificOutput\":{...\"additionalContext\":\"⚠️ MINIMAX REQUIRED: Before applying any code change...\"}}'",
          "statusMessage": "Minimax pre-check"
        }
      ]
    }
  ]
}
```

---

## 教訓

### 1. Meta API フローの変更追跡が重要

Meta は 2025年1月に `instagram_basic` を廃止し、Instagram API の認証フローを大幅に刷新した。  
**公式ドキュメントの定期的な確認**と、廃止予告が出た時点での移行計画が必要。

### 2. 開発モードとライブモードの動作差異を把握する

Facebook アプリの開発モードでは Business Discovery API に厳しい制限がある。  
開発初期から**本番相当の権限でテストできる環境**を用意するか、制限を前提とした設計が必要。

### 3. DB スキーマ設計時に表示用フィールドを含める

数値 ID ではなく可読な識別子（username）を保存するカラムを最初から設計すべきだった。  
後から追加するとマイグレーションと再連携が必要になる。

### 4. フロー切替はエンドポイントだけでなく認証方式全体の変更

Facebook Login → Instagram Login は、スコープの変更だけでなく:
- トークン交換エンドポイント・HTTP メソッド
- API ベース URL
- セキュリティパラメーター（appsecret_proof の有無）

これら全体の変更が必要。部分的な変更では動作しない。

---

## 関連リンク

- [Instagram API with Instagram Login - Meta Docs](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/)
- [Business Login for Instagram - Meta Docs](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login/)
- [Instagram Graph API Reference - Meta Docs](https://developers.facebook.com/docs/instagram-platform/reference/)
- [OAuth Authorize Reference - Meta Docs](https://developers.facebook.com/docs/instagram-platform/reference/oauth-authorize/)
