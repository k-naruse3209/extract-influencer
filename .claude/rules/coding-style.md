# コーディングスタイルルール

## 命名規則

- ファイル: kebab-case（例: `influencer-score.ts`）
- クラス: PascalCase
- 関数・変数: camelCase
- 定数: UPPER_SNAKE_CASE
- DB カラム: snake_case
- API エンドポイント: kebab-case（例: `/api/v1/influencer-profiles`）

## データ分離原則（このプロジェクト固有）

事実データ・推定値・LLM 生成コメントを必ずフィールドレベルで分離する:

```typescript
// 良い例
{
  "followerCount": { "value": 12500, "source": "instagram_api", "type": "fact" },
  "engagementRate": { "value": 0.032, "source": "calculated", "type": "estimated", "confidence": "high" },
  "brandFitComment": { "value": "...", "source": "llm_generated", "type": "llm", "model": "claude-sonnet-4-6" }
}

// 悪い例
{
  "followerCount": 12500,
  "engagementRate": 0.032,
  "brandFitComment": "..."
}
```

## エラーハンドリング

- 外部 API 呼び出しは必ず try/catch でラップする
- エラーレスポンスは統一フォーマット（`{ error: { code, message, details } }`）を使う
- 取得できないデータは `null` を返さず `{ status: "unavailable", reason: "..." }` を使う

## コメント

- コード自体が自明なら不要
- ビジネスロジックの意図・制約・なぜこうしたかを書く
- `TODO` / `HACK` / `FIXME` はコミットに含めない（チケット番号でトレースすること）
- `console.log` / `print` デバッグはコミット前に削除する

## 関数・クラスの責務

- 1 関数 1 責務。100 行を超えたら分割を検討する
- 副作用のある関数は名前で分かるようにする（`fetchAndSave*`, `calculateAndStore*`）
- 純粋関数はスコアリングロジックに積極的に使う（テスト容易性向上）

## 型・バリデーション

- TypeScript: `any` 禁止。型が不明な場合は `unknown` を使い narrowing する
- API の入力値は zod / class-validator などでバリデートする
- DB から取得した値も信頼しない（スキーマドリフトに備える）

## gotchas

- Instagram API のレスポンスフィールドは optional が多い。null チェックを怠らない
- LLM レスポンスの JSON 解析は try/catch が必須。フォーマットが壊れることがある
