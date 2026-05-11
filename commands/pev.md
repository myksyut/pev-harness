---
description: Run full Plan-Execute-Verify pipeline for a coding task
---

# /pev

PEV harnessのメインコマンド。Plan → Execute → Verify を順に実行する。

## Usage

```
/pev <task description>
/pev <task> --strict       # dual review有効化
/pev <task> --parallel     # 独立ファイル変更を並列実行
/pev <linear-issue-url>    # (v1.x) Linear Issueから自動展開
```

## 実行手順

### Step 1: Initialize task

既存タスクがある場合は確認:

```bash
if [ -f artifacts/.task_id ]; then
  CURRENT_TASK=$(cat artifacts/.task_id)
  echo "[PEV] Existing task in progress: $CURRENT_TASK"
  echo "[PEV] Run '/pev-status' to see state, or '/pev-status --clean' to discard."
  exit 1
fi
```

新規タスク開始:

```bash
mkdir -p artifacts
TASK_ID="$(date +%s)-$(openssl rand -hex 4 2>/dev/null || printf '%04x%04x' $RANDOM $RANDOM)"
echo "$TASK_ID" > artifacts/.task_id
echo "0" > artifacts/.retry_count
mkdir -p ~/.claude/pev/$TASK_ID
echo "[PEV] Task started: $TASK_ID"
```

### Step 2: Phase 1 — Plan

`pev-spec-template` skill で入力を整形 (不足要素は質問返し)。
整形済み spec + team-conventions.md (あれば) を planner agent に渡す。
planner は `artifacts/plan.md` を出力する。

### Step 3: Gate A — permissionMode判定

```bash
MODE=$(grep -o '"permissionMode"[[:space:]]*:[[:space:]]*"[^"]*"' .claude/settings.json 2>/dev/null | head -1 | cut -d'"' -f4)
MODE=${MODE:-default}

case "$MODE" in
  auto)
    echo "[PEV] Gate A: auto mode — proceeding to Phase 2"
    ;;
  plan)
    echo "[PEV] Gate A: plan mode — terminating after Plan phase"
    cat artifacts/plan.md
    exit 0
    ;;
  *)
    echo "[PEV] Gate A: default mode — please review plan.md then run /pev-execute"
    cat artifacts/plan.md
    exit 0
    ;;
esac
```

### Step 4: Phase 2 — Execute

executor agent を起動 (`--parallel` 指定時は独立ファイルを最大 `PEV_PARALLEL_EXECUTOR_MAX` 並列)。
出力: code edits + `artifacts/execute.log`。

### Step 5: Gate B — Stop hook auto-trigger

executor 完了時に Stop hook が発火し、`/pev-verify` を促す。
このフロー内で連続実行する場合は直接 Phase 3 に進む。

### Step 6: Phase 3 — Verify

verifier agent を起動。`--strict` 指定時は `pev-dual-review` skill 経由で2人レビュー。
出力: `artifacts/verify.json`。

### Step 7: Retry Gate

```bash
VERDICT=$(node -e "console.log(JSON.parse(require('fs').readFileSync('artifacts/verify.json','utf8')).verdict)" 2>/dev/null)
RETRY=$(cat artifacts/.retry_count 2>/dev/null || echo 0)
MAX=${PEV_MAX_RETRIES:-3}

if [ "$VERDICT" = "PASS" ]; then
  echo "[PEV] Verdict: PASS — task complete"
  # pev-recap skill が recap.log に最終エントリ追記
elif [ "$RETRY" -lt "$MAX" ]; then
  echo $((RETRY + 1)) > artifacts/.retry_count
  echo "[PEV] Verdict: FAIL (retry $((RETRY + 1))/$MAX) — invoking planner with diff + verify.json"
  # planner を再起動 (loop back to Step 2)
else
  echo "[PEV] Verdict: FAIL after $MAX retries — ESCALATING"
  # /pev-status --escalate を促す
fi
```

## 完了時の出力

```
[PEV done]
Task: <task_id>
Phases: 1, 2, 3
Result: PASS
Files changed: N
Recap: artifacts/recap.log

Next steps:
- Review changes with `git diff`
- Run `/pev-status --clean` to clear artifacts after commit
```

## Notes

- `--strict` と `--parallel` は同時指定可能
- 既に進行中タスクがある (artifacts/.task_id が存在) 場合、確認プロンプト表示
- `artifacts/` は `.gitignore` 対象、必要に応じてプロジェクト側でコミット運用を決める
