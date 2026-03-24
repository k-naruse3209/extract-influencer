# テーブル・フィルタ UI 仕様テンプレート

## 画面名

`[画面名]`

---

## テーブル定義

| カラム名 | データキー | 型 | ソート可 | 表示幅 | 備考 |
|---------|----------|-----|---------|-------|------|
| フォロワー数 | followerCount.value | number | yes | 120px | 推定値の場合 ※ 表示 |
| エンゲージメント率 | engagementRate.value | percent | yes | 100px | 小数2桁 |
| ブランド適合スコア | brandFitScore.value | 0-100 | yes | 100px | スコアバー表示 |
| リスクスコア | riskScore.value | 0-100 | yes | 100px | 高=赤, 中=黄, 低=緑 |

### 推定値の表示ルール

- `type: "estimated"` のフィールドにはセル右上に `*` マーク
- ホバーで `source` と `confidence` をツールチップ表示
- `confidence: "low"` は橙色テキストで表示

---

## フィルタ定義

| フィルタ名 | タイプ | 対象フィールド | 選択肢 / 範囲 |
|----------|--------|--------------|-------------|
| ジャンル | multiselect | genre | beauty, food, travel, ... |
| フォロワー数 | range | followerCount.value | 1K〜10M |
| ブランド適合スコア | range | brandFitScore.value | 0〜100 |
| リスクレベル | select | riskLevel | low / medium / high |
| データ鮮度 | select | dataFreshness | 1日以内 / 7日以内 / 30日以内 |

---

## 空状態 / ローディング

- 検索中: スケルトンローダー（行数=デフォルトページサイズ）
- 結果0件: 「条件に一致する候補が見つかりませんでした」+ フィルタリセットボタン
- データ未取得: `status: "unavailable"` → 「-」表示 + ツールチップで理由

---

## ページネーション

- デフォルト: 20件/ページ
- 最大: 100件/ページ（エクスポート時は全件対象）

---

## ソート

- デフォルトソート: `createdAt DESC`
- 複数列ソート: 非対応（シンプルに保つ）
