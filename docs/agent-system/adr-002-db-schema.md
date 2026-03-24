# ADR-002: データベーススキーマ設計

| 項目 | 内容 |
|------|------|
| ステータス | Accepted |
| 決定日 | 2026-03-20 |
| 決定者 | data-architect |
| 関連 ADR | ADR-001（技術スタック: PostgreSQL 16 + Prisma 5） |

---

## コンテキスト

ADR-001 で PostgreSQL 16 + Prisma 5 が確定した。本 ADR ではインフルエンサー分析プラットフォームの DB スキーマ設計方針を定める。

プロジェクト固有の制約:

1. **データ分離原則**: 事実データ（Instagram API 取得値）、推定・計算値、LLM 生成コメントをフィールドレベルで分離する
2. **欠損明示**: 取得不可データは null ではなく `status: "unavailable"` で表現する
3. **スナップショット**: スコア・プロフィールデータは上書きせず追記（時系列追跡用）
4. **断定禁止**: 推定値には必ず `confidence` フィールドを付与する
5. **PII 最小化**: 個人情報は必要最小限のみ保持し、ログに出力しない

---

## 設計方針

### 1. テーブル分割: データ種別ごとの分離

事実・推定・LLM 生成を別テーブルに分離する。

```
InfluencerProfile       -- 識別子・基本情報（変更頻度: 低）
  |
  +-- ProfileSnapshot   -- API 取得時点の生データ（fact、追記のみ）
  |
  +-- ScoreRecord       -- スコア算出結果（estimated、追記のみ）
  |     +-- ScoreBreakdown  -- サブスコア詳細
  |
  +-- AiAnalysis        -- LLM 生成コメント（llm_generated、追記のみ）
```

**理由**: 事実データの信頼性を推定値・LLM 出力と混同しないため。各テーブルに `dataType` フィールドを持たせ、API レスポンス構築時にフィールドレベルで分離表示する。

### 2. スナップショット設計

ProfileSnapshot と ScoreRecord は UPDATE しない。新しいデータ取得・スコア算出のたびに INSERT する。

- 「最新」の取得: `ORDER BY createdAt DESC LIMIT 1` または Prisma の `findFirst` + `orderBy`
- 過去との比較: 同一 `profileId` の複数レコードを時系列で取得

**理由**: スコアの変動追跡、データ取得時点の再現性、監査ログとしての役割を果たす。

### 3. JSONB vs 正規化の判断

| データ | 方式 | 理由 |
|--------|------|------|
| フォロワー数・投稿数等の主要指標 | 正規化カラム | 集計・ソート・インデックスが必要 |
| Instagram API の生レスポンス | JSONB (`rawResponse`) | API バージョン変更への備え。検索・集計は不要 |
| スコアの根拠テキスト | 正規化カラム (`rationale`) | 表示・検索に使うため |
| メタデータ (source, confidence 等) | 正規化カラム | WHERE 句・フィルタリングに使うため |
| PDF/CSV レポートのメタ情報 | JSONB (`metadata`) | 構造が可変。検索不要 |

**原則**: 検索・集計・フィルタリング対象は正規化カラム。構造が可変で検索不要なデータのみ JSONB。

### 4. 欠損値の表現

null は「値がセットされていない」という技術的状態のみを意味する。ビジネス的な「取得できなかった」「非公開」は `dataStatus` フィールドで表現する。

```
dataStatus: "fact"        -- API から取得した確定値
dataStatus: "estimated"   -- 計算・推定で算出した値
dataStatus: "unavailable" -- 取得不可（非公開アカウント等）
```

### 5. 論理削除

全テーブルに `deletedAt DateTime?` を持たせる。物理削除は行わない（監査要件）。Prisma の middleware で自動フィルタリングを実装する。

### 6. RBAC

User テーブルに `role` フィールドを持たせる（admin / analyst / viewer）。最小権限原則を適用する。

| ロール | 権限 |
|--------|------|
| admin | 全操作（ユーザー管理・API キー管理含む） |
| analyst | インフルエンサー分析・比較・レポート生成 |
| viewer | 閲覧のみ（レポートダウンロード可） |

---

## 主要テーブル一覧

| テーブル | 責務 | データ種別 |
|---------|------|-----------|
| User | ユーザー管理・認証 | system |
| ApiKey | ユーザーごとの API キー | system |
| InfluencerProfile | インフルエンサーの識別情報 | fact |
| ProfileSnapshot | 取得時点のプロフィールデータ | fact |
| ScoreRecord | スコア算出結果のスナップショット | estimated |
| ScoreBreakdown | サブスコア（brandFit, risk, pseudoActivity） | estimated |
| AiAnalysis | LLM 生成コメント | llm_generated |
| SavedCandidate | ユーザーが保存した候補者 | system |
| ComparisonSession | 比較セッション | system |
| ComparisonItem | 比較セッション内の個別候補 | system |
| Report | 生成済みレポート | system |
| AuditLog | 管理操作の監査ログ | system |

---

## インデックス戦略

| テーブル | インデックス | 理由 |
|---------|-------------|------|
| InfluencerProfile | `username` (UNIQUE) | ユーザー名検索 |
| InfluencerProfile | `platform, username` | プラットフォーム別検索 |
| ProfileSnapshot | `profileId, fetchedAt DESC` | 最新スナップショット取得 |
| ScoreRecord | `profileId, scoredAt DESC` | 最新スコア取得 |
| ScoreRecord | `totalScore` | スコア順ソート |
| SavedCandidate | `userId, profileId` (UNIQUE) | 重複保存防止 |
| AuditLog | `performedAt DESC` | 時系列検索 |
| User | `email` (UNIQUE) | ログイン検索 |

---

## マイグレーション方針

- 初期スキーマは `prisma migrate dev` で作成する
- スキーマ変更は必ず新しいマイグレーションファイルで行う（既存ファイルは変更しない）
- カラム追加は `DEFAULT` 値付きで行い、既存データとの互換性を保つ
- カラム削除は 2 段階で行う: (1) アプリから参照を除去、(2) 次のリリースでカラム削除
- ロールバック手順をマイグレーションファイルと同時に文書化する

---

## トレードオフ

### 採用した方針のデメリット

1. **テーブル数の多さ**: データ種別分離により JOIN が増える。最新スナップショット + 最新スコアの取得に複数 JOIN が必要。p95 500ms の制約下ではインデックス設計とキャッシュ（Redis）で対処する。

2. **スナップショットのストレージ増加**: UPDATE せず INSERT のため、レコード数が時間とともに増加する。古いスナップショットのアーカイブ・パーティション戦略を将来的に検討する必要がある（MVP では不要と判断）。

3. **JSONB の rawResponse**: 生レスポンスの保存でストレージを消費する。ただし API バージョン変更時のデータ再解析に必要。圧縮（PostgreSQL の TOAST）で緩和される。

### 採用しなかった方針

- **単一テーブルに fact/estimated/llm を混在**: データの信頼性が曖昧になり、CLAUDE.md のデータ分離原則に違反する。
- **null で欠損を表現**: 「未取得」「取得不可」「非公開」の区別ができない。
- **UPDATE 型のスコア管理**: スコア変動の追跡ができなくなる。

---

## 変更履歴

| 日付 | 変更内容 |
|------|---------|
| 2026-03-20 | 初版作成 |
