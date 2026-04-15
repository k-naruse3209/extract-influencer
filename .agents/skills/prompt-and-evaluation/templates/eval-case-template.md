# eval ケーステンプレート

## ケース情報

```
prompt-name: [対象プロンプト名]
case-id: [EVAL-001]
category: normal | missing-data | edge-case | error
created: YYYY-MM-DD
```

---

## 入力データ

```json
{
  "username": "sample_influencer",
  "followerCount": { "value": 50000, "type": "fact" },
  "genre": "beauty",
  "posts": [
    { "caption": "今日のメイクはナチュラル系...", "likeCount": 1200 },
    { "caption": "おすすめスキンケアアイテム...", "likeCount": 890 }
  ],
  "brandGenre": "cosmetics",
  "targetAge": "20-35",
  "brandTone": "natural, clean",
  "missingFields": []
}
```

---

## 期待出力（完全一致ではなく条件で評価）

### 必ず含まれるべきキーワード

- `evidence` に 1 件以上の根拠
- `comment` が日本語

### 含んではいけないキーワード

- `必ず`（断定形）
- `確実に`
- `間違いなく`
- `null` が `brandFitScore` に入る

### スコア範囲

- `brandFitScore`: 50 以上（美容ジャンル一致のため）
- `confidence`: `high` または `medium`

---

## 実際の出力（テスト実行後に記録）

```json
// テスト実行後にここに記録する
```

---

## 合否判定

- [ ] brandFitScore が 0-100 の整数
- [ ] confidence が high/medium/low のいずれか
- [ ] comment が 200 文字以内
- [ ] evidence が配列（空でも可）
- [ ] 断定形ワードが含まれない
- [ ] JSON が valid

---

## 備考

```
特記事項があればここに書く
```
