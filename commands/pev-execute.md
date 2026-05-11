---
description: Run only the Execute phase. Reads artifacts/plan.md and implements changes
---

# /pev-execute

既存の `artifacts/plan.md` を読んで実装する。

## Usage

```
/pev-execute
/pev-execute --parallel      # 独立ファイル変更を並列実行 (最大3)
```

## 前提条件

- `artifacts/plan.md` が存在すること
- plan.md に File-level changes セクションがあること
- 不在ならエラーで停止し、`/pev-plan` を促す

## 実行手順

1. `artifacts/plan.md` を読む
2. File-level changes リストを解析
3. `--parallel` 指定時:
   - 独立ファイル群を識別 (shared依存なし)
   - 最大 `PEV_PARALLEL_EXECUTOR_MAX` (default: 3) のexecutorを並列起動
   - 各executor は `~/.claude/pev/{task_id}/executor-{N}.md` にmemory書き込み
4. `--parallel` なし:
   - 1人のexecutorが順次変更
5. 全executor完了後、`artifacts/execute.log` に変更ファイル一覧と提案コミットメッセージを記録
6. Stop hook が自動で `/pev-verify` を促す

## Notes

- このコマンドは git commit を打たない (人間が境界を決める)
- `--strict` フラグはここでは無視 (Verify phaseのみで効く)
- 並列起動失敗時 (依存が複雑) は自動で順次実行にフォールバック

## 出力例

```
[Phase 2: Execute done]
Mode: parallel (3 executors)
Files changed: 3
  - src/auth/middleware.ts (executor-1, +45/-12)
  - src/auth/jwt.ts (executor-2, +30/-0)
  - src/auth/session.ts (executor-3, +18/-5)

Proposed commits:
  - feat(auth): extract createAuthFactory()
  - feat(auth): add JWT helper
  - feat(auth): use factory in session handler

Stop hook triggered → run /pev-verify
```
