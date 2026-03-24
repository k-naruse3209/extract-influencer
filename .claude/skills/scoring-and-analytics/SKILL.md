---
name: scoring-and-analytics
description: スコアリングモデルの設計・サブスコア定義・データ分離原則の確認ワークフロー。スコア設計・変更・新指標追加のときに使う。スコアリングロジックを変更する前に必ず参照する。
user-invocable: true
allowed-tools:
  - Read
  - Glob
  - Grep
---

# スコアリング・アナリティクス スキル

## 目的

インフルエンサー評価の中核であるスコアリングモデルを、一貫性・検証可能性・互換性を保ちながら設計・変更する。

---

## スコア体系

### 総合スコア（0〜100）

```
総合スコア = ブランド適合スコア × 0.4
           + 疑似アクティブ度スコア × 0.35
           + リスクスコア（反転） × 0.25
```

> **注意**: 重みは変更可能だが、変更時は必ず ADR に記録し、既存スコアとの回帰テストを実施する。

---

### サブスコア一覧

| スコア名 | キー | 範囲 | 型 | 主要入力データ |
|---------|------|------|-----|---------------|
| ブランド適合スコア | brandFitScore | 0-100 | estimated | LLM分析, ジャンル, 過去投稿 |
| 疑似アクティブ度スコア | authenticityScore | 0-100 | estimated | フォロワー増減パターン, エンゲージメント比率 |
| リスクスコア | riskScore | 0-100 | estimated | 炎上履歴, コンテンツ分析, 依頼履歴 |
| エンゲージメント率 | engagementRate | 0.0-1.0 | calculated | いいね/コメント/フォロワー数 |
| フォロワー品質スコア | followerQualityScore | 0-100 | estimated | フォロワー属性分析（取得可能な場合のみ） |

---

## データ分離原則（必須）

スコアフィールドは必ず以下の構造で返す:

```typescript
{
  brandFitScore: {
    value: 72,
    type: "estimated",          // fact | estimated | llm | unavailable
    confidence: "medium",       // high | medium | low
    source: "llm_claude_sonnet-4-6",
    calculatedAt: "2026-03-20T10:00:00Z",
    evidence: ["ジャンル一致: beauty", "過去投稿14件のうち12件がコスメ関連"]
  }
}
```

- `type: "fact"` は Instagram API から直接取得した数値のみ
- `type: "estimated"` は計算・推定値（エンゲージメント率等）
- `type: "llm"` は LLM が生成した値・コメント
- `type: "unavailable"` はデータ取得不可の場合

---

## スコア計算手順

### 1. データ収集フェーズ

```
1. Instagram Graph API から事実データを取得（followerCount, mediaCount 等）
2. 取得できなかったフィールドは unavailable でマーク
3. 取得済みデータから calculated 値を算出（engagementRate 等）
4. LLM に投稿サンプルを渡してブランド適合・リスクコメントを生成
```

### 2. スコア算出フェーズ

```
1. 各サブスコアを 0-100 に正規化
2. 欠損サブスコアがある場合は重みを再分配（欠損を 0 にしない）
3. 総合スコアを算出
4. confidence を最低値のサブスコアに合わせる
```

### 3. 出力フェーズ

```
1. スコア + evidence フィールドをセットで返す
2. confidence: low の場合はフロントエンドに警告表示フラグを立てる
3. calculatedAt タイムスタンプを付与する
```

---

## スコア変更時の互換性方針

1. 既存スコアとの差分を計算するマイグレーションスクリプトを用意する
2. 旧スコアを `legacyScore` フィールドに保持（30日間）
3. 変更前後の回帰テストを scoring-engineer が実施する
4. 影響範囲の確認: PDF/CSV レポートの表示フォーマットにも注意

---

## references/scoring-principles.md を参照

詳細な設計原則は `references/scoring-principles.md` を確認すること。

---

## gotchas

- フォロワー数 0 や極小値での除算エラー対策を必ず入れる
- LLM スコアは毎回異なる可能性がある。`calculatedAt` とモデル名を必ず記録する
- エンゲージメント率は定義がバラバラ（いいね÷フォロワー vs いいね+コメント÷投稿）。プロジェクト内で統一定義を使う
- データ鮮度によってスコアが陳腐化する。`calculatedAt` から30日以上経過したら再計算を促す
