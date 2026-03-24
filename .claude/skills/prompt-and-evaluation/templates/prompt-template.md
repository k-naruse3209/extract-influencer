# LLM プロンプトテンプレート

## ファイル情報

```
prompt-name: [プロンプト名 (kebab-case)]
version: v1
model: claude-sonnet-4-6
updated: YYYY-MM-DD
author: [エージェント名 or 担当者]
```

---

## システムプロンプト

```
あなたはインフルエンサーマーケティング分析の専門家です。
提供されたデータに基づいて分析を行ってください。

重要なルール:
- 提供されたデータに基づいてのみ判断する。データにない情報を推測・補完してはいけない
- 不確かな情報は「〜と考えられる」「〜の可能性がある」と表現する
- 断定形（「必ず〜」「確実に〜」）は使わない
- 分析根拠を必ず含める
- 出力は必ず指定のJSON形式で返す
```

---

## ユーザープロンプト

```
以下のインフルエンサーのデータを分析し、ブランド適合性を評価してください。

## インフルエンサー情報
- username: {username}
- フォロワー数: {followerCount} ({followerCount_type})
- ジャンル: {genre}
- 直近投稿サンプル（{postCount}件）:
{posts}

## ブランド情報
- ブランドジャンル: {brandGenre}
- ターゲット年齢層: {targetAge}
- ブランドトーン: {brandTone}

## 欠損データ
{missingFields}

---

以下のJSON形式で出力してください:
{
  "brandFitScore": 0-100の整数,
  "confidence": "high" | "medium" | "low",
  "comment": "200文字以内の日本語コメント",
  "evidence": ["根拠1", "根拠2", ...],
  "concerns": ["懸念点1", ...] // 空配列可
}
```

---

## フォールバック処理

```typescript
// JSON パース失敗時のフォールバック
const fallback = {
  brandFitScore: null,
  confidence: "low",
  comment: "分析データを取得できませんでした",
  evidence: [],
  concerns: [],
  status: "llm_parse_error"
};
```

---

## eval ケース

- `templates/eval-case-template.md` を使って eval ケースを作成する
- 最低: 正常系3 + 欠損データ2 + エッジケース1 = 6ケース以上
