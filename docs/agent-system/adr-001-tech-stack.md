# ADR-001: 技術スタック選定

| 項目 | 内容 |
|------|------|
| ステータス | Accepted |
| 決定日 | 2026-03-20 |
| 決定者 | solution-architect |
| 関連 ADR | なし（初回） |

---

## コンテキスト

インフルエンサー候補抽出・深掘り評価プラットフォームの MVP を構築する。主な機能は Instagram API with Instagram Login 連携によるプロフィール分析、ブランド適合・リスク・疑似アクティブ度のスコアリング、候補比較、PDF/CSV レポート出力、管理画面である。

プロジェクトには以下の制約がある:

- TypeScript 必須（any 禁止）
- 公式 API 経路優先（未承認スクレイピング禁止）
- データ分離原則（事実・推定・LLM 生成をフィールドレベルで分離）
- API レスポンス p95 <= 500ms
- Instagram API のレート制限への対応
- セキュリティ・保守性・監査性を優先

## 問題

MVP に必要な全レイヤー（フロントエンド、バックエンド、DB、キャッシュ、ジョブキュー、PDF 生成、テスト、CI）の技術スタックを選定し、整合性のある構成を確定する必要がある。

## 検討した選択肢

### バックエンドフレームワーク

#### 選択肢 A: NestJS + TypeScript

**概要**: NestJS は Angular にインスパイアされた Node.js フレームワーク。DI コンテナ、モジュールシステム、デコレータベースのルーティングを提供する。

**メリット**:
- TypeScript ファーストで型安全性が高い
- DI コンテナにより依存関係の管理とテスト容易性が優秀
- Guard / Interceptor / Pipe でセキュリティ・バリデーション・ロギングを横断的に適用可能
- BullMQ との公式統合モジュール（@nestjs/bullmq）がある
- OpenAPI (Swagger) 自動生成が標準サポート

**デメリット**:
- 学習コストが比較的高い（デコレータ、DI、モジュール構造の理解が必要）
- ボイラープレートが多い

#### 選択肢 B: Express + TypeScript（手動構成）

**概要**: 最小限の Express に手動で DI・バリデーション・認証を構成する。

**メリット**:
- 軽量で柔軟
- エコシステムが巨大

**デメリット**:
- 構造化されていないため、チーム開発時にコード品質がばらつく
- DI・バリデーション・認証の統合を自前で構築する必要がある
- 監査性・保守性の観点で NestJS に劣る

### データベース

#### 選択肢 A: PostgreSQL + Prisma ORM

**概要**: PostgreSQL をメイン DB とし、Prisma ORM で型安全なクエリを実現する。

**メリット**:
- Prisma が TypeScript 型を自動生成するため、DB スキーマと型の不整合が起きにくい
- マイグレーション管理が組み込み
- JSONB カラムでデータ分離原則（fact/estimated/llm のメタデータ）を柔軟に扱える
- PostgreSQL は JSONB インデックス、全文検索、拡張性が豊富

**デメリット**:
- Prisma は複雑な SQL（ウィンドウ関数、再帰 CTE）で raw query が必要になる場合がある
- Prisma Client のバンドルサイズがやや大きい

#### 選択肢 B: PostgreSQL + TypeORM

**概要**: TypeORM はデコレータベースの ORM。NestJS との統合実績が多い。

**メリット**:
- NestJS との統合が成熟
- Active Record と Data Mapper の両パターンをサポート

**デメリット**:
- 型安全性が Prisma より弱い（ランタイムエラーが出やすい）
- マイグレーションの信頼性に課題がある（コミュニティで報告多数）
- メンテナンス頻度が Prisma より低い

### フロントエンド

#### 選択肢 A: Next.js 14 (App Router) + Tailwind CSS

**概要**: React ベースのフルスタックフレームワーク。SSR/SSG/ISR を統合的に扱える。

**メリット**:
- App Router による Server Components でバンドルサイズ削減
- Tailwind CSS でデザインシステムの一貫性を保ちやすい
- API Route を持つが、本プロジェクトでは BFF 的な薄い層として活用可能
- shadcn/ui との組み合わせでアクセシブルなコンポーネントを迅速に構築

**デメリット**:
- App Router はまだ進化中で breaking change のリスクがある
- SSR が不要な管理画面には over-engineering の面がある

#### 選択肢 B: Vite + React + Tailwind CSS (SPA)

**概要**: 純粋な SPA として構築する。

**メリット**:
- 構成がシンプル
- ビルドが高速

**デメリット**:
- 認証フローのセキュリティ（httpOnly Cookie の取り扱い）で BFF が別途必要になる
- SEO が不要とはいえ、OGP 生成などで SSR が欲しくなる可能性がある

### キャッシュ / ジョブキュー

#### 選択肢 A: Redis + BullMQ

**概要**: Redis をキャッシュストアおよび BullMQ のブローカーとして使用する。

**メリット**:
- Instagram API レート制限対応のキャッシュに最適（TTL 付きキー）
- BullMQ でスコアリングの非同期バッチ処理を実現
- NestJS に公式統合モジュールがある（@nestjs/bullmq）
- ジョブのリトライ・遅延実行・優先度制御が組み込み

**デメリット**:
- Redis のインフラ運用が追加される
- メモリベースのため大量データキャッシュにはコスト注意

#### 選択肢 B: In-memory cache + pg-boss (PostgreSQL ベースキュー)

**概要**: キャッシュは Node.js のインメモリ、キューは PostgreSQL ベースの pg-boss を使用。

**メリット**:
- Redis が不要でインフラがシンプル
- pg-boss は PostgreSQL だけで動作する

**デメリット**:
- インメモリキャッシュはプロセス間で共有できない（水平スケール不可）
- pg-boss のスループットは BullMQ に劣る
- Instagram API のレート制限管理に分散キャッシュが必要になった時点で Redis 導入が必要になる

### PDF 生成

#### 選択肢 A: Puppeteer

**概要**: Headless Chrome を使い HTML/CSS をレンダリングして PDF を生成する。

**メリット**:
- HTML/CSS で自由にレイアウト設計可能
- チャートや画像の埋め込みが容易
- フロントエンドと同じデザインシステムを再利用可能

**デメリット**:
- Chromium のインストールが必要（Docker イメージサイズ増加）
- メモリ消費が大きい（同時生成数に注意）

#### 選択肢 B: PDFKit

**概要**: Node.js ネイティブの PDF 生成ライブラリ。

**メリット**:
- 軽量で依存が少ない
- メモリ効率が良い

**デメリット**:
- レイアウトの自由度が低い（座標指定ベース）
- 複雑なデザインの実装コストが高い
- HTML/CSS のデザイン資産を再利用できない

### 認証方式

#### 選択肢 A: JWT（短命アクセストークン）+ httpOnly Secure Cookie + リフレッシュトークン

**概要**: アクセストークンを短命（15 分）にし、リフレッシュトークンで更新する。Cookie は httpOnly + Secure + SameSite=Strict で設定する。

**メリット**:
- XSS でトークンを窃取されるリスクが低い（httpOnly Cookie）
- CSRF は SameSite=Strict で緩和
- ステートレスな認証でスケーラブル
- セキュリティルールの要件に合致

**デメリット**:
- リフレッシュトークンのローテーション実装が必要
- トークン失効の即時反映にはブラックリスト（Redis）が必要

#### 選択肢 B: セッションベース認証（Redis セッションストア）

**概要**: サーバーサイドセッションを Redis に保存する。

**メリット**:
- 即時ログアウトが容易
- セッション管理がシンプル

**デメリット**:
- 水平スケール時に Redis への依存度が高い
- API のステートレス性が損なわれる

### テストフレームワーク

#### 選択肢 A: Vitest（バックエンド + フロントエンド統一）

**概要**: Vite ベースの高速テストフレームワーク。Jest 互換 API を持つ。

**メリット**:
- ESM ネイティブで TypeScript との相性が良い
- Jest より高速（特に大規模テストスイート）
- バックエンド・フロントエンドで統一可能
- Jest 互換 API のため移行コストが低い

**デメリット**:
- NestJS の公式ドキュメントは Jest 前提で書かれている

#### 選択肢 B: Jest + Supertest

**概要**: Node.js の事実上標準テストフレームワーク。

**メリット**:
- NestJS 公式ドキュメントが Jest ベース
- エコシステムが最も大きい

**デメリット**:
- ESM 対応が不完全で設定が複雑になることがある
- 大規模テストスイートで速度が低下しやすい

---

## 決定

以下の技術スタックを採用する。

| レイヤー | 技術 | バージョン目安 |
|---------|------|---------------|
| 言語 | TypeScript | 5.x |
| バックエンド | NestJS | 10.x |
| ORM | Prisma | 5.x |
| DB | PostgreSQL | 16.x |
| キャッシュ | Redis | 7.x |
| ジョブキュー | BullMQ (@nestjs/bullmq) | 4.x |
| フロントエンド | Next.js (App Router) | 14.x |
| CSS | Tailwind CSS | 3.x |
| UI コンポーネント | shadcn/ui | latest |
| PDF 生成 | Puppeteer | 22.x |
| CSV 生成 | csv-stringify (ストリーミング) | 6.x |
| 認証 | JWT (短命) + httpOnly Cookie | - |
| バリデーション | zod | 3.x |
| テスト | Vitest + Supertest | 1.x / 6.x |
| E2E テスト | Playwright | 1.x |
| CI/CD | GitHub Actions | - |
| コンテナ | Docker + Docker Compose | - |
| モノレポ管理 | npm workspaces | - |
| LLM | Anthropic Claude API (claude-sonnet-4-6) | - |
| Linter / Formatter | ESLint + Prettier | - |

**理由**:

1. **NestJS**: DI コンテナ・Guard・Interceptor により、セキュリティ・監査性・保守性の要件を構造的に満たせる。BullMQ との公式統合があり、Instagram API レート制限対応の非同期ジョブ管理が容易。
2. **Prisma**: TypeScript 型自動生成により DB とアプリ層の型不整合を防止。スキーマファーストなマイグレーション管理が堅牢。
3. **PostgreSQL**: JSONB でデータ分離原則のメタデータ（source, type, confidence）を柔軟に格納。拡張性と信頼性が高い。
4. **Redis + BullMQ**: Instagram API のレート制限（200 calls/hour）に対するキャッシュ戦略と、スコアリングの非同期バッチ処理を一つのインフラで実現。
5. **Next.js 14**: App Router の Server Components でダッシュボードの初期表示を高速化。httpOnly Cookie ベースの認証フローを BFF として統合できる。
6. **Puppeteer**: HTML/CSS ベースの PDF 生成により、フロントエンドのデザインシステム（Tailwind CSS）を再利用。レポートのデザイン品質を担保。
7. **JWT + httpOnly Cookie**: セキュリティルールの要件（httpOnly + secure cookie または短命 JWT）に合致。SameSite=Strict で CSRF を緩和。
8. **Vitest**: ESM ネイティブで TypeScript との統合が円滑。バックエンド・フロントエンドでテストランナーを統一し、設定の分散を防止。
9. **zod**: ランタイムバリデーションと TypeScript 型推論を統合。API 入力・LLM レスポンス解析の両方で活用可能。

**採用しなかった理由**:

- **Express（手動構成）**: 構造化が弱く、セキュリティ・監査性の横断的適用にボイラープレートが必要。チーム開発での品質維持コストが高い。
- **TypeORM**: 型安全性が Prisma に劣り、マイグレーションの信頼性に課題がある。
- **Vite + React SPA**: 認証の httpOnly Cookie フローで BFF 層が別途必要になり、構成が複雑化する。
- **pg-boss**: 水平スケール時にインメモリキャッシュの限界に当たり、結局 Redis 導入が必要になる。初期から Redis を入れておく方が合理的。
- **PDFKit**: レイアウトの自由度が低く、デザインシステムを再利用できない。
- **セッションベース認証**: API のステートレス性が損なわれ、将来のマイクロサービス分割時に障壁になる。
- **Jest**: ESM 対応の不安定さと速度面で Vitest に劣る。

---

## 結果

- モノレポ構成（npm workspaces）で `backend/` と `frontend/` を分離し、共通型定義を `shared/` に配置する
- バックエンドは NestJS + Prisma + BullMQ のモジュール構成で実装する
- フロントエンドは Next.js 14 App Router + Tailwind CSS + shadcn/ui で実装する
- Redis をキャッシュとジョブキューの両方で使用する（単一インスタンス、論理 DB で分離）
- PDF 生成は Puppeteer を使用し、Docker イメージに Chromium を含める（イメージサイズ約 400MB 増加を許容）
- CSV 生成は csv-stringify のストリーミングモードを使用し、大量データ時のメモリ使用を抑制する
- テストは Vitest に統一し、E2E は Playwright を使用する
- 認証は JWT（アクセストークン 15 分 + リフレッシュトークン 7 日）+ httpOnly Secure Cookie で実装する

## 保留事項

- Next.js 15 の安定化状況を監視し、App Router の成熟度に応じてアップグレードを検討する
- Puppeteer の Docker 内での安定性を検証し、問題がある場合は Playwright PDF 生成への切り替えを検討する
- Redis のマネージドサービス選定（AWS ElastiCache / Upstash 等）はインフラ設計時に決定する
- LLM のモデル選定（claude-sonnet-4-6 vs claude-opus-4-6）はプロンプト設計時にコスト・品質のトレードオフで最終決定する

---

## 変更履歴

| 日付 | 変更内容 |
|------|---------|
| 2026-03-20 | 初版作成 |
