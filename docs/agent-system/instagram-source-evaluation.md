# Instagram データソース評価ドキュメント

| 項目 | 内容 |
|------|------|
| ステータス | Accepted |
| 更新日 | 2026-04-09 |
| 作成者 | instagram-integration-engineer |
| 関連 ADR | ADR-005（Instagram API with Instagram Login 収束方針） |
| 関連スキル | data-source-compliance |

---

## 1. 正規データソース

本プロジェクトの Instagram 公式データソースは **Instagram API with Instagram Login** のみとする。

- 非公式 API、スクレイピング、サードパーティのデータ再販売 API は採用しない
- 取得できないデータは `UNAVAILABLE` または `ESTIMATED` として表現する
- `FACT` は Instagram API with Instagram Login から直接取得したデータのみに付与する

## 2. 取得主体と取得対象

### 2.1 定義

- **connected account**: OAuth で実際に連携済みの Instagram Business / Creator アカウント
- **target profile**: 分析対象として検索・保存された Instagram プロフィール

### 2.2 原則

- connected account と target profile は別概念として扱う
- target profile が connected account と一致しない場合、取得不能な media metrics / insights は `UNAVAILABLE` とする
- connected account のインサイトを target profile の値として保存しない

## 3. Capability Matrix

| 項目 | Connected Account | Third-Party Target Profile | Unavailable / 備考 |
|------|-------------------|----------------------------|--------------------|
| `username`, `name`, `biography` | `FACT` | `FACT`（公式 API が返す範囲） | 非公開 / 非対応アカウントは `UNAVAILABLE` |
| `followers_count`, `follows_count`, `media_count` | `FACT` | `FACT`（公式 API が返す範囲） | Personal account は `UNAVAILABLE` |
| `profile_picture_url`, `website`, `account_type` | `FACT` | `FACT`（返却時のみ） | 未返却なら `UNAVAILABLE` |
| recent media list | `FACT` | `UNAVAILABLE` | target profile が connected account と異なる場合は取得しない |
| media insights (`reach`, `impressions`, `engagement`, `saved`) | `FACT` | `UNAVAILABLE` | `instagram_business_manage_insights` が必要 |
| engagement rate | recent media から `ESTIMATED` | `UNAVAILABLE` または別ロジックで `ESTIMATED` | connected account の値を流用しない |
| follower list / follower identities | `UNAVAILABLE` | `UNAVAILABLE` | API 非提供かつ PII 対象 |
| personal account profile metrics | `UNAVAILABLE` | `UNAVAILABLE` | Instagram API の対象外 |
| private account data | `UNAVAILABLE` | `UNAVAILABLE` | API 仕様上取得不可 |

## 4. OAuth とスコープ

### 4.1 使用する OAuth

- Authorization URL: `https://www.instagram.com/oauth/authorize`
- Token exchange / refresh: `https://graph.instagram.com`

### 4.2 標準スコープ

| スコープ | 用途 |
|---------|------|
| `instagram_business_basic` | connected account の基本プロフィール情報 |
| `instagram_business_manage_insights` | connected account の media insights |

### 4.3 設定値

| 環境変数 | 用途 |
|---------|------|
| `INSTAGRAM_CLIENT_ID` | Meta App ID |
| `INSTAGRAM_CLIENT_SECRET` | Meta App Secret |
| `INSTAGRAM_REDIRECT_URI` | OAuth callback URL |
| `INSTAGRAM_API_VERSION` | 使用する API バージョン |
| `INSTAGRAM_OAUTH_SCOPES` | カンマ区切りの要求スコープ |

## 5. データ契約

### 5.1 `GET /api/v1/instagram/status`

既存の `connected`, `username`, `connectedAt` を維持しつつ、以下を追加で返してよい。

- `provider`
- `scopes`
- `expiresAt`
- `tokenStatus`

### 5.2 `ProfileSnapshot`

以下の保存方針を採用する。

- 既存の fact / estimated / unavailable フィールド区分は維持する
- `providerVariant` を保存する
- `subjectType` を保存する
- `rawResponse` には `providerPayload`, `normalizedPayload`, `providerVariant`, `subjectType` を含める

## 6. レート制限と実行制御

- 単純な `200ms sleep` は採用しない
- Redis ベースで `instagram:${providerVariant}:${userId}` 単位の待機制御を行う
- queue worker は同一 provider / user の処理を直列化する
- `429` または Instagram error code `32` は exponential backoff で再試行する

## 7. `UNAVAILABLE` にするべき代表例

```json
{
  "status": "UNAVAILABLE",
  "reason": "requires_connected_account_match"
}
```

- target profile が connected account と一致しない media insights
- Personal account の follower / following / media metrics
- private account のプロフィールデータ
- follower list や follower identity のような PII

## 8. コンプライアンスガードレール

- 未承認スクレイピングは禁止
- 公式 API で取得できない値を `FACT` にしない
- 推定値には根拠と信頼度を付ける
- plaintext token をログや API レスポンスに含めない
- third-party target profile の欠損を connected account のデータで補完しない
