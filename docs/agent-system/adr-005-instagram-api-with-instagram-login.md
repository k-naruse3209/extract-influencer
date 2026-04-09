# ADR-005: Instagram API with Instagram Login 収束方針

| 項目 | 内容 |
|------|------|
| ステータス | Accepted |
| 決定日 | 2026-04-09 |
| 決定者 | solution-architect, instagram-integration-engineer |
| Supersedes | ADR-003（Instagram連携方針） |
| 関連 ADR | ADR-001（技術スタック）、ADR-002（DBスキーマ）、ADR-004（Auth / RBAC） |
| 関連ドキュメント | docs/agent-system/instagram-source-evaluation.md, docs/development/instagram-oauth-migration.md |

---

## コンテキスト

Instagram 連携の実装は、OAuth と HTTP クライアントはすでに `instagram.com/oauth/authorize` と `graph.instagram.com` を利用している一方、README、法務文面、設定画面、AI プロンプト、PDF legend、ADR は旧 `Instagram Graph API` 前提の記述が残っていた。

さらに、実装上も以下の設計リスクがあった。

1. connected account と target profile の区別が曖昧で、media insights の取得主体が混線していた
2. レート制限がコメントベースで、実際の直列化と待機制御が不十分だった
3. トークン状態・付与スコープ・provider variant が永続化されず、status API から再認証要否を判断しづらかった

このため、公開 API を壊さずに内部設計を再編し、プロダクト表面の表現を `Instagram API with Instagram Login` に収束させる必要がある。

## 検討した選択肢

### 選択肢 A: 既存の `Instagram Graph API` 表記を維持し、内部実装だけ差し替える

**メリット**
- ドキュメント差分が小さい
- 一見すると移行コストが低い

**デメリット**
- 現在の OAuth 実装と公開説明が一致しない
- scope、認証フロー、取得制約の誤認を招く
- Meta App Review 向け文面と実装が乖離する

### 選択肢 B: 外部契約を維持しつつ、内部 provider 境界と公開文言を `Instagram API with Instagram Login` に統一する

**メリット**
- 既存ルートや UI 導線を壊さない
- 認証方式、scope、データ取得制約を現実に合わせて表現できる
- 今後 provider 実装を差し替える場合も orchestration 層を保守しやすい

**デメリット**
- ドキュメント、法務文面、テストの広範な更新が必要
- connected account / target profile の分離を保存モデルにも反映する必要がある

## 決定

選択肢 B を採用する。

### 決定 1: canonical provider 名を `Instagram API with Instagram Login` とする

- README、法務ページ、設定画面、AI プロンプト、PDF legend、運用ドキュメントの正規名称を統一する
- `Business Discovery` は内部の target profile discovery 実装を説明するときだけ使う
- 旧 `Instagram Graph API` 表現は履歴ドキュメントに限定する

### 決定 2: 外部契約は維持し、内部は provider 境界で再編する

- 既存エンドポイント `/api/v1/auth/instagram`, `/api/v1/auth/instagram/callback`, `/api/v1/instagram/status`, `/api/v1/instagram/disconnect`, `/api/v1/influencer-profiles/:profileId/fetch` は維持する
- HTTP 仕様、OAuth URL、scope、retry / backoff は provider 実装に閉じ込める
- `InstagramService` は orchestration と persistence に責務を限定する

### 決定 3: connected account と target profile を明示的に分離する

- queue payload に `providerVariant`, `targetAccountId`, `subjectType` を含める
- target profile が connected account と異なる場合、取得不能な media metrics / insights は `UNAVAILABLE` とする
- connected account のデータで target profile の欠損を埋めない
- `ProfileSnapshot` には `providerVariant` と `subjectType` を保存する

### 決定 4: token / rate limit の状態を実装と契約に反映する

- `InstagramToken` に `providerVariant`, `grantedScopes`, `tokenStatus`, `lastValidatedAt` を保持する
- `GET /api/v1/instagram/status` は後方互換を維持しつつ、`provider`, `scopes`, `expiresAt`, `tokenStatus` を追加で返す
- rate limit は Redis ベースの per-user / per-provider 制御で直列化し、429 / code 32 は exponential backoff で扱う

## 結果

この決定により、以下をシステムの正本とする。

1. 公式データソースは `Instagram API with Instagram Login` のみ
2. 外部 API 契約は additive change のみで維持する
3. 取得主体と取得対象は永続化モデルと queue payload の両方で分離する
4. 非取得データは `UNAVAILABLE` で明示し、別主体のデータで補完しない
5. トークン状態、scope、provider variant は status API と DB の両方から追跡可能にする

## 影響

### 実装

- provider 境界の導入により HTTP 呼び出し責務が集約される
- queue worker は provider variant ごとの排他制御を前提とする
- snapshot / token スキーマに additive な列追加が必要になる

### プロダクト表面

- 設定画面に provider / scopes / expiresAt / tokenStatus を表示できる
- Privacy Policy、Terms、Data Deletion は current implementation と同じ認証方式を説明する
- PDF と AI コメントの provenance 文言が公式 API 名と一致する

### 運用

- Meta App Review の説明と実装差分が減る
- 再認証が必要なトークンを status API で確認できる
- historical doc は migration record として残しつつ、現行仕様の参照先を限定できる
