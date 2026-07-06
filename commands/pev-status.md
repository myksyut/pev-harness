---
description: Show current PEV task state, artifacts, and remaining budget
---

# /pev-status

現在進行中のPEVタスクの状態を表示する。

## Usage

```text
/pev-status                    # 現在のタスク表示
/pev-status --recent           # 直近5タスクの履歴
/pev-status --clean            # 現タスクのartifacts/とmemoryを削除
/pev-status --gc               # 30日経過の stale task をリスト
/pev-status --gc --apply       # stale task を実際に削除
/pev-status --escalate         # retry上限到達の処理
```

## Implementation

### Default 表示

```bash
if [ ! -f artifacts/.task_id ]; then
  echo "[PEV] No active task."
  STALE=$(find ~/.claude/pev -maxdepth 1 -mindepth 1 -type d -mtime +30 2>/dev/null | wc -l | tr -d ' ')
  if [ "$STALE" -gt 0 ]; then
    echo "[PEV] $STALE stale task(s) >30 days old. Run /pev-status --gc to review."
  fi
  exit 0
fi

TASK_ID=$(cat artifacts/.task_id)

echo "[PEV Status]"
echo "Task ID:    $TASK_ID"
echo "Retry:      driven by /goal (rounds tracked by the official evaluator, max PEV_MAX_RETRIES)"
echo ""
echo "Artifacts:"
for f in plan.md execute.log verify.json recap.log; do
  if [ -f "artifacts/$f" ]; then
    LINES=$(wc -l < "artifacts/$f" | tr -d ' ')
    echo "  ✅ artifacts/$f ($LINES lines)"
  else
    echo "  ⏳ artifacts/$f (pending)"
  fi
done

if [ -d ~/.claude/pev/$TASK_ID ]; then
  echo ""
  echo "Memory: ~/.claude/pev/$TASK_ID/"
  ls -1 ~/.claude/pev/$TASK_ID 2>/dev/null | sed 's/^/  - /'
fi

if [ -f artifacts/recap.log ]; then
  echo ""
  echo "Recent recap (last 5 entries):"
  tail -n 5 artifacts/recap.log | sed 's/^/  /'
fi

# Session telemetry summary (v4.3.0+)
if [ -f artifacts/session.json ]; then
  echo ""
  echo "Telemetry (artifacts/session.json):"
  jq -r '"  started:  \(.started_at)\n  result:   \(.result // "in progress")\n  duration: \(.duration_seconds // "-")s\n  tokens:   in=\(.tokens.input // "-") out=\(.tokens.output // "-") (approx)\n  git:      \(.git.branch)@\(.git.head[0:8]) (dirty files: \(.git.dirty_files))"' artifacts/session.json
  echo "  archive:  ~/.claude/pev/telemetry/ (dataset、 --clean 後も残る)"
fi
```

### --recent

```bash
echo "[Recent PEV tasks]"
find ~/.claude/pev -maxdepth 1 -mindepth 1 -type d ! -name telemetry -print0 2>/dev/null \
  | xargs -0 stat -f "%m %N" 2>/dev/null \
  | sort -rn \
  | head -5 \
  | while read mtime path; do
      printf "  %s  %s\n" "$(date -r $mtime '+%Y-%m-%d %H:%M')" "$(basename $path)"
    done
```

### --clean

```bash
TASK_ID=$(cat artifacts/.task_id 2>/dev/null)
if [ -z "$TASK_ID" ]; then
  echo "[PEV] No active task."
  exit 0
fi
echo "About to remove:"
echo "  - artifacts/"
echo "  - ~/.claude/pev/$TASK_ID/"
read -p "Confirm (y/N)? " ans
if [ "$ans" = "y" ] || [ "$ans" = "Y" ]; then
  # telemetry は dataset として保全してから削除 (v4.3.0+)
  if [ -f artifacts/session.json ]; then
    mkdir -p ~/.claude/pev/telemetry
    cp artifacts/session.json ~/.claude/pev/telemetry/$TASK_ID.session.json
  fi
  rm -rf artifacts/
  rm -rf ~/.claude/pev/$TASK_ID
  echo "[PEV] Cleaned task $TASK_ID (telemetry archived to ~/.claude/pev/telemetry/)"
fi
```

### --gc

```bash
APPLY=""
[ "$1" = "--apply" ] && APPLY="yes"

# telemetry/ は dataset 蓄積用なので gc 対象外 (v4.3.0+)
STALE_DIRS=$(find ~/.claude/pev -maxdepth 1 -mindepth 1 -type d ! -name telemetry -mtime +30 2>/dev/null)
if [ -z "$STALE_DIRS" ]; then
  echo "[PEV] No stale tasks (>30 days)."
  exit 0
fi

echo "[PEV] Stale tasks (>30 days):"
echo "$STALE_DIRS" | while read d; do
  echo "  - $(basename $d) (mtime: $(stat -f '%Sm' -t '%Y-%m-%d' $d))"
done

if [ "$APPLY" = "yes" ]; then
  echo "$STALE_DIRS" | xargs rm -rf
  echo "[PEV] Removed stale tasks."
else
  echo ""
  echo "Run with --apply to delete."
fi
```

### --escalate

```bash
if [ ! -f artifacts/verify.json ]; then
  echo "[PEV] No verify.json found."
  exit 1
fi
node -e "
  const v = JSON.parse(require('fs').readFileSync('artifacts/verify.json','utf8'));
  console.log('[ESCALATION]');
  console.log('Task ' + (v.task_id || '<unknown>') + ' failed after ' + (v.retry_count || '?') + ' retries.');
  console.log('');
  console.log('Unresolved issues:');
  (v.critical_issues || []).forEach(i => console.log('  - ' + i));
  console.log('');
  console.log('Suggestions:');
  console.log('  1. Inspect artifacts/plan.md — is the plan wrong?');
  console.log('  2. Run /pev-plan manually to revise');
  console.log('  3. Run /pev-status --clean and start over');
"
```
