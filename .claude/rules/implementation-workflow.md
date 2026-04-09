# 実装ワークフロールール（必須）

このプロジェクトでは以下の役割分担を**必ず**守ること。

## 担当表

| 作業 | 担当 |
|------|------|
| 設計・アーキテクチャ判断 | Claude Code（私） |
| 複雑なデバッグ・原因調査 | Codex (`/codex:rescue`) |
| コードレビュー | Codex (`/codex:review`) |
| **実装（通常）** | **Minimax API 直接呼び出し（curl via Bash）** |
| 実装（行き詰まった時） | Codex (`/codex:rescue`) |
| セキュリティ観点のレビュー | Codex (`/codex:adversarial-review`) |

## 実装フロー（1行の修正でも必ず守る）

1. **Claude** がタスクを設計・整理する
2. **Minimax API を curl で直接呼び出し**てコード生成を依頼する
3. **Claude** が生成コードを `Edit` / `Write` ツールで適用する
4. **Codex** (`/codex:review`) でレビューを実施する

## Minimax API 直接呼び出し方法

```bash
curl -s -X POST "https://api.minimax.io/v1/chat/completions" \
  -H "Authorization: Bearer $MINIMAX_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "minimax-m2.7",
    "messages": [
      {"role": "system", "content": "You are an expert software engineer."},
      {"role": "user", "content": "YOUR_PROMPT_HERE"}
    ],
    "max_tokens": 4096
  }' | jq -r '.choices[0].message.content'
```

- **endpoint**: `https://api.minimax.io/v1/chat/completions`
- **model**: `minimax-m2.7`
- **auth**: `$MINIMAX_API_KEY`（環境変数として settings.json に設定済み）
- **禁止**: `mcp__openrouter__openrouter_chat` は使わない

## 禁止事項

- Minimax に依頼せず Claude が直接コードを書くことは**禁止**
- `mcp__openrouter__openrouter_chat` 経由での呼び出しは**禁止**（OpenRouter を経由しない）
- 「小さい修正だから」「急いでいるから」という理由でフローを省略することは**禁止**
- Codex レビューを省略したまま実装を完了扱いにすることは**禁止**

## Codex モデル設定

`~/.codex/config.toml` の `model = "gpt-5.4"` が最新モデル設定。

## gotchas

- コンテキストが圧縮されてもこのファイルは毎回ロードされる。ワークフローを忘れたらこのファイルを参照する
- Minimax が生成したコードは必ずそのまま適用せず、Claude がレビューしてから `Edit`/`Write` する
- curl の結果が空の場合は `jq` を外してレスポンス全体を確認すること
