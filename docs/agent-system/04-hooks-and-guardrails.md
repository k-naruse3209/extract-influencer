# フック・ガードレール設計

## 目的

`.claude/settings.json` の hooks と permissions で、安全でない操作・品質劣化・ドキュメント乖離を自動的に抑制する。

---

## permissions（アクセス制御）

### 許可（allow）

- `Read`, `Edit`, `Write`: ファイル操作全般
- `Bash(git status/diff/log)`: git 参照系
- `Bash(ls/find/cat/pwd)`: 探索系
- `Bash(npm test/pnpm test/pnpm lint/pnpm typecheck/pytest)`: テスト・品質チェック

### 確認必要（ask）

- `Bash(git push *)`: 外部への push は必ず確認
- `Bash(rm *)`: ファイル削除は確認
- `Bash(curl/wget *)`: 外部通信は確認
- `Bash(brew install/npm publish/docker push *)`: パッケージ管理・公開系は確認

---

## hooks の役割

### PreToolUse (Bash)

**目的**: 危険なコマンド実行前に警告を出す

防ぐもの:
- `rm -rf` による誤削除
- `git push --force` による本番コード破壊
- 本番 DB への直接操作
- 長時間コマンドのバックグラウンド未実行

### PostToolUse (Edit/Write)

**目的**: ファイル変更後の品質チェックを促す

促進するもの:
- lint / typecheck / format の実行
- `console.log` / `print` デバッグ残骸の確認
- `TODO` / `HACK` コメントの確認

### SubagentStart / SubagentStop

**目的**: subagent の開始・終了をログし、作業の可視性を上げる

促進するもの:
- subagent 開始時に「目的・スコープ・期待成果物」の明確化
- subagent 終了時に「成果物の確認・doc-sync の必要性チェック」

---

## sandbox 設定

```json
{
  "sandbox": {
    "enabled": true,
    "autoAllowBashIfSandboxed": true,
    "excludedCommands": ["git", "docker"]
  }
}
```

- sandbox 有効: デフォルトで安全な環境で実行
- git/docker は sandbox 除外（通常操作に必要なため）

---

## 何を防がないか（意図的な非制限）

- 通常のファイル読み取り・編集: 制限しない（開発効率のため）
- `git commit`: 制限しない（通常の開発フロー）
- テスト実行: 制限しない（品質確認に必要）

---

## gotchas

- hooks が重すぎると開発速度が落ちる。最小限のメッセージに絞る
- `autoAllowBashIfSandboxed: true` により sandbox 内では Bash が承認なしで実行できる
- 危険コマンドの「防止」ではなく「警告・確認」を基本とする（完全ブロックは開発を阻害する）
