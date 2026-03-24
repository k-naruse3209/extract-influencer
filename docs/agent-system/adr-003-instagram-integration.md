# ADR-003: Instagram連携方針

| 項目 | 内容 |
|------|------|
| ステータス | Accepted |
| 決定日 | 2026-03-20 |
| 決定者 | instagram-integration-engineer |
| 関連 ADR | ADR-001（技術スタック）、ADR-002（DBスキーマ） |
| 関連ドキュメント | docs/agent-system/instagram-source-evaluation.md |

---

## コンテキスト

インフルエンサー候補の分析プラットフォームにおいて、Instagram アカウントのデータ取得方針・認証フロー・レート制限対応・トークン管理のアーキテクチャを確定する必要がある。

本 ADR で解決する問題:

1. Instagram データをどの経路で取得するか（公式 API vs 非公式手段）
2. TikTok を MVP でどこまで対応するか
3. アクセストークンをどのように安全に管理するか
4. レート制限（200 calls/hour）にどのアーキテクチャで対応するか

---

## 問題

### 問題 1: データ取得経路の選択

Instagram のデータ取得手段として以下が技術的に存在する。

- (A) Instagram Graph API（公式）
- (B) 非公式 API・サードパーティライブラリ（unofficial clients）
- (C) Webスクレイピング

各手段にはアクセスできる情報の範囲・信頼性・法的リスクが大きく異なる。

### 問題 2: TikTok の MVP スコープ

TikTok も分析対象候補として要望があるが、公式 API の制約と開発リソースの観点からスコープを明確化する必要がある。

### 問題 3: トークン管理

ユーザーアクセストークン（有効期限60日）の管理を誤ると、サービス障害・セキュリティインシデントの両方につながる。特にユーザートークンとページトークンの混同は設計上の典型的な誤りである。

### 問題 4: レート制限対応

200 calls/hour/user token という制約は、複数ユーザーが同時に分析リクエストを送った場合に容易に超過する。並列リクエストの大量発行を防ぐアーキテクチャが必要。

---

## 検討した選択肢

### データ取得経路

#### 選択肢 A: Instagram Graph API（公式）

**概要**: Meta が提供する公式の REST API。OAuth 2.0 による認証が必須。Business/Creator アカウントのみ対応。

**メリット**:
- Meta の利用規約に準拠。法的リスクがない
- データの信頼性が高い（公式ソース）
- アップタイム・品質が Meta によって保証される
- IP ブロック・アカウント BAN のリスクがない
- Meta アプリレビューを通過すれば `instagram_manage_insights` スコープも取得可能

**デメリット**:
- 取得には OAuth 2.0 による本人連携が必須
- Business/Creator アカウントのみ対象（個人アカウント不可）
- レート制限（200 calls/hour/user token）の制約がある
- `instagram_manage_insights` スコープは Meta のアプリレビューが必要（リードタイム数週間）

#### 選択肢 B: 非公式 API・サードパーティライブラリ

**概要**: Instagram の内部 API（web/mobile app が使用するエンドポイント）を直接叩く、またはこれをラップしたサードパーティライブラリを使用する。

**メリット**:
- 個人アカウントを含む全アカウントのデータが取得可能
- 本人連携不要で取得可能な情報が多い

**デメリット**:
- Meta の利用規約（Platform Policy）への明確な違反
- 法的リスク: Meta からの法的措置（CFAA 違反、不正競争防止法等）の可能性
- アカウントおよびアプリの BAN リスク（即時サービス停止につながる）
- API 仕様が予告なく変更される（安定性ゼロ）
- データの正確性・完全性が保証されない
- CLAUDE.md の「未承認スクレイピング禁止」原則に直接違反

#### 選択肢 C: Webスクレイピング

**概要**: Instagram の Web インターフェースをクローラーで解析し、HTML/JSON を抽出する。

**メリット**:
- 公開情報は取得できる

**デメリット**:
- 選択肢 B と同等の法的リスク・BAN リスク
- CAPTCHAや動的レンダリングへの継続的な対応コストが高い
- IP レート制限・ブロックへの対応が継続的に必要
- CLAUDE.md の「未承認スクレイピング禁止」原則に直接違反
- 取得データの信頼性・完全性が保証されない

### TikTok 対応スコープ

#### 選択肢 A: MVP では手動入力のみ（本人連携ベース）

**概要**: TikTok の分析はインフルエンサー本人が自アカウントデータを手動で連携・入力する形式のみとする。

**メリット**:
- TikTok Research API は申請・審査プロセスが長く、MVP のタイムラインに合わない
- 手動入力であれば本人同意が明確で、PII リスクが低い
- 開発リソースを Instagram 公式 API 連携の完成度向上に集中できる

**デメリット**:
- TikTok データの自動取得が MVP に含まれない
- 手動入力データの正確性に依存する

#### 選択肢 B: TikTok Research API を使用

**概要**: TikTok が提供する Research API（学術・研究用）でデータを取得する。

**メリット**:
- 公式 API で法的リスクがない

**デメリット**:
- Research API は商用利用が制限されており、本プロジェクトの用途に適用できない可能性がある
- 申請・審査のリードタイムが長い
- 取得できるデータが限定的

---

## 決定

### 決定 1: データ取得経路 → 選択肢 A（Instagram Graph API 公式）を採用

**理由**:

1. **CLAUDE.md の大前提制約**: 「公式 API 経路優先」「未承認スクレイピングをコア設計に組み込まない」は変更不可の原則であり、選択肢 B・C は検討対象外とする
2. **法的リスク排除**: 選択肢 B・C はサービスの存続そのものを脅かす法的・運用リスクがある。データ取得量のメリットはリスクを正当化しない
3. **データ信頼性**: 公式 API から取得したデータのみが `"type": "fact"` として扱える。非公式手段で取得したデータは信頼性根拠を持てない

**採用しなかった理由の明示記録**:

| 選択肢 | 採用しない理由 |
|--------|-------------|
| 非公式 API | Meta 利用規約違反・法的措置リスク・CLAUDE.md 原則違反。今後も検討しない |
| Webスクレイピング | 同上。コア設計への組み込みを永久に禁止する |

### 決定 2: TikTok → MVP では手動入力のみ（選択肢 A）

**理由**:

1. **タイムライン制約**: TikTok Research API の申請・審査プロセスが MVP のリリーススケジュールに合わない
2. **商用利用制限**: Research API の利用規約が商用プロジェクトへの適用に不明確な点がある。安全を取り手動入力に限定する
3. **開発集中**: Instagram Graph API 連携の品質向上を優先する
4. **CLAUDE.md 非目標の明記**: 「TikTok の大規模自動探索」はMVP非目標として明記されている

**将来対応**: TikTok の公式 Business API や Content API が整備された段階で `tiktok-integration-strategist` と `source-strategist` に方針再評価を委任する。

### 決定 3: トークン管理方針

#### 基本設計

| トークン種別 | 有効期限 | 管理方針 |
|------------|---------|---------|
| 短命トークン（short-lived） | 1時間 | 取得直後に長命トークンへ交換。DBには保存しない |
| 長命トークン（long-lived） | 60日 | AES-256-GCM で暗号化してDBに保存 |
| ページアクセストークン | 無期限 | AES-256-GCM で暗号化してDBに保存。権限剥奪時に無効化 |

**ユーザートークンとページトークンの混同を防ぐ設計**:

- DB の `InstagramToken` テーブルに `tokenType` カラム（enum: `short_lived` / `long_lived` / `page`）を設ける
- サービス層では `TokenType` を型として強制し、wrong type の使用をコンパイルエラーで防止する
- ページトークンを使う箇所・ユーザートークンを使う箇所をサービスクラスで明確に分離する

#### トークン自動更新

- 有効期限 **30日前** に BullMQ のバッチジョブで自動リフレッシュ
- 更新 API: `GET https://graph.instagram.com/refresh_access_token`（24時間以上経過が条件）
- 更新失敗時: ユーザーへの再連携通知 → 7日前でも未更新なら再連携強制

#### セキュリティ

- トークンの平文ログ出力禁止（NestJS の Interceptor でレスポンスフィルタリングを実施）
- トークンのレスポンス返却禁止（マスク表示のみ: `xxxx...{last4chars}`）
- 暗号化キーは環境変数（`INSTAGRAM_TOKEN_ENCRYPTION_KEY`）または AWS Secrets Manager で管理
- `.env` ファイルをリポジトリにコミットしない（`.gitignore` で除外）

### 決定 4: レート制限対応アーキテクチャ

#### アーキテクチャ設計

```
[APIリクエスト]
    |
    v
[NestJS Controller]
    |
    v
[InstagramApiQueueService] -- BullMQ Queue: instagram-api-queue
    |                            Rate: 180 calls/hour/token（安全マージン確保）
    |                            Concurrency: 1（トークンごとにシリアライズ）
    v
[Redis Cache チェック]
    |
    +-- ヒット --> キャッシュ値を返す（source: "cache"）
    |
    +-- ミス  --> Instagram Graph API 呼び出し
                   |
                   +-- 成功 --> Redisにキャッシュ（TTL付き） --> 結果を返す
                   |
                   +-- 429/Error32 --> Exponential Backoffでリトライ（最大3回）
                                        --> 失敗時: rate_limited エラーを返す
```

#### Redis キャッシュ TTL 設定

| データ種別 | TTL | 根拠 |
|----------|-----|-----|
| プロフィール情報 | 6時間 | フォロワー数の変動頻度を考慮 |
| メディア一覧 | 1時間 | 投稿頻度を考慮 |
| インサイト | 24時間 | インサイトデータの更新頻度は低い |

#### Exponential Backoff 設定

```
リトライ1回目: 2秒後
リトライ2回目: 4秒後
リトライ3回目: 8秒後
最大リトライ回数: 3回
全リトライ失敗後: INSTAGRAM_RATE_LIMIT_EXCEEDED エラーをクライアントに返す
AuditLogへのイベント記録: rate_limit_hit
```

#### BullMQ ジョブ設計

```typescript
// ジョブの優先度定義
const JOB_PRIORITIES = {
  MANUAL_REQUEST: 1,    // ユーザーの手動リクエスト（最優先）
  BACKGROUND_BATCH: 10, // バックグラウンドの定期更新
  TOKEN_REFRESH: 5,     // トークンリフレッシュ（中優先度）
} as const;
```

---

## 結果

本 ADR の決定により、以下のアーキテクチャが確定する。

1. **データ取得**: Instagram Graph API（公式）のみ。非公式 API・スクレイピングは永久禁止
2. **TikTok**: MVP では手動入力のみ。公式 API の整備状況を監視し将来対応
3. **トークン管理**: AES-256-GCM 暗号化 + BullMQ 自動更新 + tokenType による型安全な分離
4. **レート制限**: BullMQ + Redis のキューイング + キャッシュ戦略で 200 calls/hour 制約に対応
5. **unavailable 表示**: 個人アカウント・非公開アカウント・フォロワーリスト等は取得不可として明示的に `unavailable` を返す

### ガードレール（実装時の遵守事項）

- Instagram API を呼び出すサービスは必ず `InstagramApiQueueService` 経由とする（直接呼び出し禁止）
- アクセストークンを引数や戻り値としてサービス間に渡す際は必ず暗号化状態のまま扱う
- `followers_count` が `null` のケース（非公開アカウント・API スコープ不足）を必ず処理する
- `type: "fact"` は Instagram Graph API からの直接取得値のみに付与する

---

## 保留事項

- Meta アプリレビュー（`instagram_manage_insights` スコープ）の申請タイミングを release-manager と調整する
- TikTok の公式 Business API の対応状況を四半期ごとに `tiktok-integration-strategist` がレビューする
- トークン暗号化キーの管理サービス（AWS Secrets Manager vs GCP Secret Manager vs HashiCorp Vault）はインフラ設計時に `devops-engineer` が決定する

---

## 変更履歴

| 日付 | 変更内容 |
|------|---------|
| 2026-03-20 | 初版作成（instagram-integration-engineer） |
