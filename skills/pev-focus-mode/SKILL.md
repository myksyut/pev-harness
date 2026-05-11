---
name: pev-focus-mode
description: 長時間タスク中に `/focus` モードを活用して中間出力を抑制し、最終結果に集中させるパターン
---

# pev-focus-mode

Execute phase が長くなる時、`/focus` モードでターミナルを最終結果のみ表示に切り替える。

## When to Use

- Execute phase が 5分以上経過した時
- 並列 executor が同時に走っている時
- ユーザーが「画面がうるさい」と感じる時

## How It Works

### Focus Mode とは

Claude Code v2.1.x の機能。`/focus` で切替可能。中間ステップ (tool calls、思考、検索結果) を隠して、最終的なテキスト応答のみ表示する。

Opus 4.7では「モデルを信頼してプロセスより結果を見る」設計思想に基づき推奨されている。

### このskillの役割

execute.log の経過時間を監視し、5分超で:

```
[PEV] Execute phase has been running for >5min.
      Consider /focus to hide intermediate output.
      Final result and verify.json will still be shown.
```

を表示する。ユーザーが手動で `/focus` を打つかどうかは任意。

### 自動切替はしない

`/focus` をskill側で自動切替するのは avoid:

- ユーザーの好みがある
- デバッグ時は逆に詳細を見たい
- Claude Code側の挙動として手動操作前提

このskillは**推奨を提示するだけ**。

## Examples

### 並列execute時の典型

```
$ /pev "Refactor auth across 3 modules" --parallel
[Phase 1] planner...  done (artifacts/plan.md)
[Phase 2] executor x3 starting...
  - executor-1: src/auth/middleware.ts
  - executor-2: src/auth/jwt.ts
  - executor-3: src/auth/session.ts

[5min elapsed]
[PEV] Long-running phase detected. Consider:
      - /focus  (hide intermediate output)
      - /pev-status (check progress)
```

### Recap連携

pev-recap が recap.log にphase完了を書き込む際、`/focus` 中でも最後の recap.log の内容だけは表示する。これで focus mode と progress visibility のバランスが取れる。

## 注意点

- `/focus` を ON にしても、エラー時の prompt は表示される
- `/focus` ON時、ユーザーが Enter を押すと次の最終出力まで待機する
- ユーザーが何が起こっているか不安になったら `/focus` で OFF に戻せる
