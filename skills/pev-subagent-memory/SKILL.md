---
name: pev-subagent-memory
description: ~/.claude/pev/{task_id}/ 配下にsubagent (主にexecutor) の memory directoryを標準化。並列実行時の情報共有と次セッションへの引き継ぎを実現
---

# pev-subagent-memory

executor が並列起動された時、互いに直接対話せず memory file 経由でのみ協調する仕組み。Opus 4.8 の subagent memory field 思想に準拠。

## When to Use

- executor agent が複数並列起動される時 (`/pev-execute --parallel`)
- 次セッションで前回タスクを再開する時
- 同じ task_id のagentが時間差で起動される時

## How It Works

### ディレクトリ構造

```
~/.claude/pev/{task_id}/
├── notes.md                    # planner が書く全体メモ
├── executor-1.md               # executor #1 の作業ノート
├── executor-2.md               # executor #2 の作業ノート
├── executor-3.md               # executor #3 の作業ノート
└── verifier.md                 # verifier の検証メモ
```

### 各memoryファイルの中身

#### planner: `notes.md`

```markdown
# Task Notes: <task_id>

## High-level decisions
- 認証middlewareの分離方針: factory pattern
- 既存test fixtureを再利用

## Open questions resolved
- JWT secret管理: env varから (既存規約に従う)

## Things to watch
- migrations/* と src/auth/* の整合性
```

#### executor: `executor-{N}.md`

```markdown
# Executor N — assignment

## Files assigned
- src/auth/middleware.ts

## In-progress
- [x] Read existing middleware
- [x] Identify factory extract points
- [ ] Implement factory

## Notes for other executors
- I'm NOT touching src/auth/jwt.ts (executor-2)
- New helper added: createAuthFactory() exported from middleware.ts
```

#### verifier: `verifier.md`

```markdown
# Verify Notes

## Build results
- tsc: passed
- vitest: 1 fail in tests/auth.test.ts:42

## Issues found
- Missing import in middleware.ts (line 18)

## Retry recommendation
- Send diff + this note to planner for retry #1
```

### 並列executor間の協調ルール

1. **直接対話禁止**: agentは互いに送受信しない (Claude Code subagent はそもそも不可)
2. **共有ファイル衝突回避**: planner が同じファイルへの編集を1人に集約
3. **メモ更新タイミング**: 各executorは自分の memoryファイルを「重要な決定があった時のみ」更新
4. **読むタイミング**: 起動時に他の executor-*.md を読んで「既に書き換え予定のファイル」を把握

### 次セッションでの引き継ぎ

セッション再開時、SessionStart hookが `.pev-artifacts/.task_id` を読み:

```bash
TASK_ID=$(cat .pev-artifacts/.task_id 2>/dev/null)
if [ -n "$TASK_ID" ] && [ -d ~/.claude/pev/$TASK_ID ]; then
  echo "[PEV] Resuming task $TASK_ID"
  echo "[PEV] Memory: ~/.claude/pev/$TASK_ID/"
  echo "[PEV] Run /pev-status for details"
fi
```

### Memory directory の cleanup

タスク完了後、自動cleanupは**しない** (デバッグや学習のため残す)。

手動cleanup:

```bash
/pev-status --clean       # .pev-artifacts/ も削除
rm -rf ~/.claude/pev/$TASK_ID  # 手動で
```

`~/.claude/pev/` 全体は 30日経過したものを clean するhelper を v0.5 で追加予定。

## Examples

### 並列executor 3並走の典型

```
~/.claude/pev/1715394123-a3f9c2/
├── notes.md                # planner: factory pattern方針
├── executor-1.md           # middleware.ts担当、factoryに切り出し
├── executor-2.md           # jwt.ts担当、新規依存なし
├── executor-3.md           # session.ts担当、middleware factoryを使用
└── verifier.md             # 全PASS、recap.logへ
```

executor-3 は起動時に `executor-1.md` を読み、「middleware.tsからcreateAuthFactory()がexportされる予定」を知る。これで session.ts側の実装方針を決められる。

## 注意点

- memory directoryに**secret/token類を書かない** (planner/executor agentに明示)
- ファイルサイズは1個10kB以下を目安 (それ以上はsummarize)
- 異なるtask_idのmemoryは絶対に交わらない (path isolation)
- 4.7のsubagent `memory` field 機能が Claude Code v2.x で公開されたら、これと統合
