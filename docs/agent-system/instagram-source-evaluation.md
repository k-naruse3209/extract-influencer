# Instagramデータソース評価ドキュメント

| 項目 | 内容 |
|------|------|
| ステータス | Accepted |
| 作成日 | 2026-03-20 |
| 作成者 | instagram-integration-engineer |
| 関連 ADR | ADR-003（Instagram連携方針） |
| 関連スキル | data-source-compliance |

---

## 1. 取得可能データ（公式 Instagram Graph API）

### 1.1 前提条件

Instagram Graph API でデータを取得するには、対象アカウントが以下のいずれかである必要がある。

- **Business アカウント**: Facebookページに接続された法人・ブランド向けアカウント
- **Creator アカウント**: クリエイター向けの専門機能が使えるアカウント

**個人アカウント（Personal Account）は Graph API での取得対象外。** Basic Display API でも本人連携なしに他者の個人アカウントデータを取得することはできない。

---

### 1.2 取得可能フィールド一覧

#### プロフィール情報（本人連携あり: instagram_business_account スコープ）

| フィールド | 型 | 備考 |
|-----------|-----|------|
| `id` | string | Instagram ビジネスアカウント ID |
| `username` | string | ユーザー名 |
| `name` | string | 表示名 |
| `biography` | string | プロフィール文 |
| `website` | string | プロフィールリンク |
| `followers_count` | integer | フォロワー数（公開アカウントのみ） |
| `follows_count` | integer | フォロー数 |
| `media_count` | integer | 投稿数 |
| `profile_picture_url` | string | プロフィール画像 URL（30日有効） |
| `account_type` | string | BUSINESS / CREATOR / PERSONAL |

#### メディア情報（本人連携あり）

| フィールド | 型 | 備考 |
|-----------|-----|------|
| `id` | string | メディア ID |
| `caption` | string | キャプション |
| `media_type` | string | IMAGE / VIDEO / CAROUSEL_ALBUM |
| `timestamp` | datetime | 投稿日時 |
| `like_count` | integer | いいね数 |
| `comments_count` | integer | コメント数 |
| `permalink` | string | 投稿 URL |

#### インサイト（本人連携あり + `instagram_manage_insights` スコープ必須）

| フィールド | 備考 |
|-----------|------|
| `reach` | リーチ数（投稿単位） |
| `impressions` | インプレッション数 |
| `engagement` | エンゲージメント総数 |
| `saved` | 保存数 |

---

### 1.3 取得に必要なパーミッション・スコープ

| スコープ | 用途 | 取得方法 |
|---------|------|---------|
| `instagram_basic` | プロフィール・メディア基本情報 | OAuth 2.0 ユーザー連携 |
| `instagram_manage_insights` | インサイトデータ | OAuth 2.0 ユーザー連携（Business/Creator のみ） |
| `pages_read_engagement` | Facebook ページ連携確認 | OAuth 2.0 ユーザー連携 |
| `instagram_content_publish` | 投稿（MVP スコープ外） | 使用しない |

**注意**: `instagram_basic` スコープだけでは `followers_count` が返らないケースがある。`instagram_manage_insights` を組み合わせて取得する。

---

### 1.4 レート制限（アクセストークン種別ごと）

| トークン種別 | 制限 | 備考 |
|------------|------|------|
| ユーザーアクセストークン（短命） | 200 calls / hour | ユーザーごとに独立カウント |
| ユーザーアクセストークン（長命） | 200 calls / hour | 短命から交換後も同じ制限 |
| ページアクセストークン | 200 calls / hour | 有効期限なし |
| アプリアクセストークン | 制限異なる（アプリ全体で共有） | プロフィール取得には不適 |

- レート制限超過時のエラーコード: `#32`（API Error Code 32）
- HTTP ステータス: `429 Too Many Requests` または `400 Bad Request`（エラーコードで判定）
- 対応: Exponential Backoff でリトライ（後述）

---

## 2. 取得不可能データ（MVP では `unavailable` 表示）

### 2.1 個人アカウント（Personal Account）のデータ

Instagram Graph API はBusiness/Creator アカウントに限定される。個人アカウントに対して API を呼び出した場合、データは取得できない。

```json
{
  "status": "unavailable",
  "reason": "personal_account_not_supported",
  "message": "個人アカウントはGraph APIの対象外です。Business/Creatorアカウントのみ分析可能です"
}
```

### 2.2 フォロワーの詳細リスト（PII）

フォロワーの個別ユーザー情報（username、プロフィール等）の一括取得はAPIで提供されていない。取得した場合でも PII に該当するため保存・処理は行わない。

```json
{
  "status": "unavailable",
  "reason": "follower_list_not_provided_by_api",
  "message": "フォロワーリストはInstagram Graph APIで取得できません"
}
```

### 2.3 他アカウントのメディア（本人認証なし）

本人の OAuth 連携なしに、他者の Instagram アカウントのメディアや詳細データを取得することはできない。

```json
{
  "status": "unavailable",
  "reason": "requires_account_owner_consent",
  "message": "本人の連携なしに他アカウントのメディア詳細は取得できません"
}
```

### 2.4 非公開アカウントのデータ

非公開設定のアカウントは、フォロワー数を含む全データが取得不可となる。

```json
{
  "status": "unavailable",
  "reason": "private_account",
  "message": "このアカウントは非公開のため分析できません"
}
```

### 2.5 インサイトデータ（本人連携なし）

エンゲージメント率・リーチ・インプレッション等のインサイトは本人の `instagram_manage_insights` 権限付与が必須。

```json
{
  "status": "unavailable",
  "reason": "requires_user_consent",
  "message": "インサイトデータの取得にはアカウントオーナーの連携が必要です"
}
```

### 2.6 データ分離原則に基づくフィールド表現

取得不可フィールドを含む場合の API レスポンス例:

```json
{
  "followerCount": {
    "value": 12500,
    "source": "instagram_api",
    "type": "fact",
    "fetchedAt": "2026-03-20T10:00:00Z"
  },
  "engagementRate": {
    "value": 0.032,
    "source": "calculated",
    "type": "estimated",
    "confidence": "high",
    "basis": "like_count + comments_count / followers_count (last 12 posts)"
  },
  "followerList": {
    "status": "unavailable",
    "reason": "follower_list_not_provided_by_api"
  },
  "insights": {
    "status": "unavailable",
    "reason": "requires_user_consent"
  }
}
```

---

## 3. 認証フロー設計

### 3.1 OAuth 2.0 フロー（ユーザー連携）

インフルエンサー本人が自分のアカウントを連携する場合のフロー。

```
1. ユーザーが「Instagramアカウントを連携」ボタンをクリック
2. バックエンドが Authorization URL を生成して返却
   - endpoint: https://api.instagram.com/oauth/authorize
   - params: client_id, redirect_uri, scope, response_type=code, state（CSRF トークン）
3. ユーザーがInstagramの認証画面で権限を承認
4. InstagramがコールバックURLにauthorization_codeを付与してリダイレクト
5. バックエンドが authorization_code を検証（state パラメータで CSRF チェック）
6. バックエンドが短命トークン（short-lived token）を取得
   - POST https://api.instagram.com/oauth/access_token
7. バックエンドが長命トークン（long-lived token）に変換
   - GET https://graph.instagram.com/access_token?grant_type=ig_exchange_token&...
8. 長命トークンを暗号化してDBに保存
```

**CSRF 対策**: `state` パラメータに署名付きランダム値を使用。コールバック時に検証する。

### 3.2 アクセストークンの有効期限管理

| トークン種別 | 有効期限 | 取得方法 |
|------------|---------|---------|
| 短命トークン（Short-lived） | 1時間 | Authorization Code フロー |
| 長命トークン（Long-lived） | 60日 | 短命トークンと交換 |
| ページアクセストークン | 無期限 | ユーザートークン経由で取得 |

**重要**: ユーザートークンとページトークンを混同しない。有効期限管理の仕組みが異なる。

### 3.3 トークン更新の自動化方針

長命トークンの有効期限（60日）に対する自動更新戦略:

```
- 有効期限の30日前: バックグラウンドジョブ（BullMQ）でリフレッシュ実行
- 更新API: GET https://graph.instagram.com/refresh_access_token
           ?grant_type=ig_refresh_token&access_token={long-lived-token}
- 更新条件: トークン発行から24時間以上経過していること（Instagramの制約）
- 更新失敗時: ユーザーに再連携を促す通知を送信
- 有効期限7日前でも未更新の場合: 再連携フロー強制
```

BullMQ ジョブ設計:

```
JobName: refresh-instagram-token
Schedule: 毎日 02:00 JST（バッチ実行）
Target: 有効期限まで30日以内のトークン全件
Retry: 3回（exponential backoff）
OnFailure: AuditLogに記録 + ユーザーへの通知キュー登録
```

---

## 4. レート制限対応方針

### 4.1 制約の整理

- 上限: 200 calls / hour / user token
- 1分あたりの実質上限: 約3.3 calls/minute（均等分散時）
- エラーコード: Instagram Error Code `#32`

### 4.2 Redisキャッシュ戦略

| データ種別 | キャッシュキー | TTL | 更新タイミング |
|----------|--------------|-----|-------------|
| プロフィール情報 | `ig:profile:{instagram_id}` | 6時間 | キャッシュMISS時のみAPI呼び出し |
| メディア一覧 | `ig:media:{instagram_id}:page:{cursor}` | 1時間 | キャッシュMISS時のみAPI呼び出し |
| インサイト | `ig:insights:{media_id}` | 24時間 | キャッシュMISS時のみAPI呼び出し |
| レート制限カウンター | `ig:ratelimit:{user_token_hash}` | 1時間（sliding window） | API呼び出しごとにインクリメント |

キャッシュヒット時はAPIを呼び出さない。`source`フィールドに `"cache"` を付与してレスポンスを返す。

```json
{
  "followerCount": {
    "value": 12500,
    "source": "cache",
    "type": "fact",
    "cachedAt": "2026-03-20T08:00:00Z",
    "ttlRemainingSeconds": 14400
  }
}
```

### 4.3 リクエストキュー設計（BullMQ）

並列リクエストの大量発行を防ぐため、Instagram API 呼び出しはすべてジョブキュー経由とする。

```
Queue: instagram-api-queue
Concurrency: 1（ユーザートークンごと）
Rate: 最大 180 calls/hour（安全マージン 10% を確保）
RateLimiter: { max: 180, duration: 3600000 } // BullMQ のレート制限機能を使用
Priority: 手動リクエスト > バックグラウンドバッチ
```

### 4.4 エラーハンドリング（429 / Error Code 32）

```
1. Instagram API から Error Code 32 または 429 を受信
2. レスポンスヘッダーの x-app-usage / x-business-use-case-usage を確認
3. Exponential Backoff でリトライ
   - 1回目: 2秒後
   - 2回目: 4秒後
   - 3回目: 8秒後
   - 最大3回リトライ後も失敗: エラーレスポンスを返す
4. BullMQ のジョブに delay を設定してキューに戻す
5. AuditLog に rate_limit_hit イベントを記録
```

エラーレスポンス形式:

```json
{
  "error": {
    "code": "INSTAGRAM_RATE_LIMIT_EXCEEDED",
    "message": "APIのレート制限に達しました。しばらく時間をおいて再試行してください",
    "instagramErrorCode": 32,
    "retryAfterSeconds": 3600,
    "status": "rate_limited"
  }
}
```

---

## 5. MVP スコープ

### 5.1 MVP で実装する取得項目と優先順位

| 優先度 | 項目 | 取得方法 | 連携要否 |
|------|------|---------|---------|
| P0 | ユーザー名・表示名・プロフィール文 | Graph API | 本人連携必須 |
| P0 | フォロワー数・フォロー数・投稿数 | Graph API | 本人連携必須 |
| P0 | プロフィール画像 URL | Graph API | 本人連携必須 |
| P1 | 直近12投稿のいいね数・コメント数 | Graph API | 本人連携必須 |
| P1 | 投稿日時・メディア種別 | Graph API | 本人連携必須 |
| P2 | インサイト（リーチ・インプレッション） | Graph API | 本人連携 + insights スコープ必須 |
| P2 | キャプションテキスト | Graph API | 本人連携必須 |

### 5.2 本人連携なしで取得できる情報の限界

本人連携（OAuth 2.0）なしで取得できるデータは **存在しない**。

Instagram Graph API は認証済みトークンが必須。未認証での公開プロフィール取得も Graph API では不可。

**設計上の対応**: 本人連携なしで分析依頼があった場合は、以下のエラーを返す。

```json
{
  "error": {
    "code": "INSTAGRAM_AUTH_REQUIRED",
    "message": "Instagramアカウントの分析には本人の連携が必要です",
    "status": "auth_required",
    "authUrl": "/api/v1/instagram/oauth/initiate"
  }
}
```

### 5.3 `unavailable` を返すケースの定義

| ケース | `reason` 値 | 対応 |
|------|------------|------|
| 個人アカウント（非Business/Creator） | `personal_account_not_supported` | unavailable |
| 非公開アカウント | `private_account` | unavailable |
| 本人連携なし | `auth_required` | エラー（認証フローへ誘導） |
| インサイト（insights スコープなし） | `requires_insights_scope` | unavailable |
| フォロワーリスト | `follower_list_not_provided_by_api` | unavailable（恒久的） |
| APIレート制限超過 | `rate_limit_exceeded` | rate_limited（一時的） |
| APIトークン失効 | `token_expired` | エラー（再連携フローへ誘導） |
| アカウントが存在しない | `account_not_found` | unavailable |
| アカウントが凍結・削除 | `account_unavailable` | unavailable |

---

## 6. セキュリティ・コンプライアンス

### 6.1 アクセストークンの保存方法（暗号化）

```
保存先: PostgreSQL の ApiKey テーブル（または専用の InstagramToken テーブル）
暗号化: AES-256-GCM
暗号化キー管理: 環境変数（INSTAGRAM_TOKEN_ENCRYPTION_KEY）または Secret Manager
平文トークンのログ出力: 禁止
平文トークンのレスポンス返却: 禁止（部分マスク表示のみ許可: xxxx...{last4chars}）
```

DB スキーマ（概要）:

```
InstagramToken
  id            uuid PRIMARY KEY
  profileId     uuid REFERENCES InfluencerProfile(id)
  encryptedToken text NOT NULL        -- AES-256-GCM で暗号化
  tokenType     enum(short_lived, long_lived, page)
  expiresAt     timestamp NOT NULL
  lastRefreshedAt timestamp
  createdAt     timestamp NOT NULL
  deletedAt     timestamp             -- 論理削除
```

### 6.2 PII最小化方針

- フォロワーの個人情報（ username・ID 等）は取得・保存しない
- Instagram の `id` フィールドは内部識別子として保存するが、ログに出力しない
- `biography` に含まれる個人連絡先（電話番号・メールアドレス等）は抽出・インデックス化しない
- プロフィール画像 URL は30日で失効するため、画像そのものの永続保存は行わない（URL のキャッシュのみ）

### 6.3 Meta社利用規約の遵守事項

| 遵守項目 | 内容 | 対応方法 |
|---------|------|---------|
| データ使用制限 | 取得データは本サービスの機能目的のみに使用する | 用途をシステム設計に明記 |
| データ保持期間 | Meta が指定するデータ保持ポリシーに従う | 90日超のデータは再取得ではなくキャッシュ更新で対応 |
| 未承認スクレイピング禁止 | 公式 Graph API 以外でのデータ取得は行わない | 設計・実装レビューで確認必須 |
| ユーザー同意 | データ取得前に対象アカウントオーナーの同意を取得 | OAuth フローで明示的に権限を承認させる |
| データ削除要求対応 | ユーザーがアカウント連携を解除した場合、データを削除 | 連携解除 API で論理削除 + 物理削除スケジュール設定 |
| アプリレビュー | `instagram_manage_insights` スコープは Meta のアプリレビュー通過が必要 | MVP 公開前にアプリレビューを申請する |

---

## 変更履歴

| 日付 | 変更内容 |
|------|---------|
| 2026-03-20 | 初版作成（instagram-integration-engineer） |
