---
name: api-backend-standards
description: バックエンドAPI設計・実装の標準仕様。API設計・エンドポイント実装・バッチジョブ・エラーハンドリングを行うときに参照する。
allowed-tools:
  - Read
  - Write
  - Glob
---

# API & Backend Standards

## API 設計標準

### エンドポイント命名

```
GET    /api/v1/influencer-profiles           # 一覧
POST   /api/v1/influencer-profiles           # 新規追加
GET    /api/v1/influencer-profiles/:id       # 詳細
PUT    /api/v1/influencer-profiles/:id       # 更新
DELETE /api/v1/influencer-profiles/:id       # 削除
POST   /api/v1/influencer-profiles/compare  # 比較
POST   /api/v1/influencer-profiles/:id/refresh  # データ更新
GET    /api/v1/reports/:jobId/status         # レポート生成状態
GET    /api/v1/reports/:jobId/download/pdf   # PDF ダウンロード
GET    /api/v1/reports/:jobId/download/csv   # CSV ダウンロード
```

### レスポンスフォーマット（データ分離必須）

```json
{
  "data": {
    "id": "uuid",
    "platform": "instagram",
    "username": "...",
    "followerCount": {
      "value": 12500,
      "source": "instagram_graph_api",
      "type": "fact",
      "fetchedAt": "2026-01-01T00:00:00Z"
    },
    "engagementRate": {
      "value": 0.032,
      "source": "calculated",
      "type": "estimated",
      "confidence": "high",
      "calculatedAt": "2026-01-01T00:00:00Z"
    },
    "brandFitComment": {
      "value": "...",
      "source": "llm_generated",
      "type": "llm_generated",
      "model": "Codex-sonnet-4-6",
      "promptVersion": "v1.2",
      "confidence": "medium",
      "generatedAt": "2026-01-01T00:00:00Z"
    },
    "unavailableFields": [
      {
        "field": "audienceInsights",
        "status": "unavailable",
        "reason": "requires_user_consent"
      }
    ]
  },
  "meta": {
    "requestId": "...",
    "processedAt": "2026-01-01T00:00:00Z"
  }
}
```

### エラーレスポンスフォーマット

```json
{
  "error": {
    "code": "INSTAGRAM_PRIVATE_ACCOUNT",
    "message": "このアカウントは非公開のため分析できません",
    "details": { "username": "..." },
    "retryAfter": null
  }
}
```

### エラーコード一覧（このプロジェクト固有）

| コード | HTTP | 説明 |
|--------|------|------|
| INSTAGRAM_PRIVATE_ACCOUNT | 422 | 非公開アカウント |
| INSTAGRAM_RATE_LIMIT | 429 | レート制限 |
| INSTAGRAM_TOKEN_EXPIRED | 401 | トークン失効 |
| INFLUENCER_NOT_FOUND | 404 | アカウント未存在 |
| SCORE_CALCULATION_PENDING | 202 | スコア計算中 |

## 非同期処理（バッチジョブ）

Instagram API 呼び出し・PDF 生成は非同期で処理する:

```
POST /api/v1/influencer-profiles
→ 202 Accepted + { jobId: "..." }

GET /api/v1/jobs/:jobId/status
→ { status: "pending|processing|completed|failed", result: ... }
```

## Idempotency

- POST リクエストに `Idempotency-Key` ヘッダーを受け付ける
- 同一キーのリクエストは重複実行しない

## レート制限対応

- Instagram API 呼び出しはキューで順次処理する
- exponential backoff: 1s → 2s → 4s → 8s（最大 4 リトライ）
- 429 エラー時は `Retry-After` ヘッダーを使う

## gotchas

- Instagram API レスポンスの null チェックを必ず行う
- バッチ処理は idempotency なしだと二重実行でデータが壊れる
- レポート生成は同期処理にするとタイムアウトする（必ず非同期に）
