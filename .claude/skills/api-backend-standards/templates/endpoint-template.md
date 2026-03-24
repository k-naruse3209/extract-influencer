# API エンドポイント仕様テンプレート

## [METHOD] /api/v1/[path]

| 項目 | 内容 |
|------|------|
| メソッド | GET / POST / PUT / DELETE |
| 認証 | 必須（JWT） |
| 権限 | admin / analyst / viewer |
| 処理方式 | 同期 / 非同期 |

### リクエスト

**パスパラメータ**:
| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| id | string (uuid) | ○ | |

**クエリパラメータ**:
| パラメータ | 型 | 必須 | デフォルト | 説明 |
|-----------|-----|------|-----------|------|
| | | | | |

**リクエストボディ** (JSON):
```json
{
  "field": "type"
}
```

### レスポンス

**200 OK**:
```json
{
  "data": {
    "id": "uuid",
    "field": {
      "value": "...",
      "type": "fact | estimated | llm_generated",
      "source": "...",
      "confidence": "high | medium | low"
    }
  },
  "meta": {
    "requestId": "...",
    "processedAt": "ISO8601"
  }
}
```

**エラーレスポンス**:
| HTTPコード | エラーコード | 説明 |
|-----------|-------------|------|
| 400 | VALIDATION_ERROR | バリデーションエラー |
| 401 | UNAUTHORIZED | 認証エラー |
| 403 | FORBIDDEN | 権限エラー |
| 404 | NOT_FOUND | リソース未存在 |
| 429 | INSTAGRAM_RATE_LIMIT | レート制限 |
| 500 | INTERNAL_ERROR | サーバーエラー |

### 処理フロー

1. [ステップ1]
2. [ステップ2]
3. [ステップ3]

### 注意事項

- [Instagram API に依存する処理の場合: レート制限考慮]
- [非同期の場合: ジョブ ID を返す]
