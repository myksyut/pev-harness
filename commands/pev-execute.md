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

### Step 1: Pre-check

```bash
if [ ! -f artifacts/plan.md ]; then
  echo "[PEV] artifacts/plan.md not found. Run /pev-plan first."
  exit 1
fi
if [ ! -f artifacts/.task_id ]; then
  echo "[PEV] artifacts/.task_id missing. Run /pev to start a fresh task."
  exit 1
fi
TASK_ID=$(cat artifacts/.task_id)
echo "[PEV] Execute phase for task $TASK_ID"
```

### Step 2: Parse plan

`artifacts/plan.md` の `## File-level changes` セクションを読んでファイル一覧を抽出。

### Step 3: Decide parallelism

```bash
PARALLEL_MAX=${PEV_PARALLEL_EXECUTOR_MAX:-3}
# --parallel フラグがあり、独立した複数ファイルがある場合のみ並列化
```

### Step 4: Invoke executor(s)

- 並列モード: 同一メッセージ内で複数 Agent tool calls を発射 (最大 `$PARALLEL_MAX`)
- 順次モード: 1つの executor agent (model: sonnet, effort: high) を起動

各executorは `~/.claude/pev/$TASK_ID/executor-N.md` にmemory書き込み。

### Step 5: Aggregate output

全executor完了後:

```bash
echo "[$(date -u +%FT%TZ)] Phase 2 (Execute) done" >> artifacts/execute.log
# 各executorが書いたファイル一覧と提案commit messageを統合
```

pev-recap が Phase 2 完了エントリを `artifacts/recap.log` に追記。

### Step 6: Trigger verify

```bash
echo "[PEV] Execute done. Stop hook will prompt /pev-verify, or run it manually."
```

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
