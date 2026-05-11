---
description: Show current PEV task state, artifacts, and remaining budget
---

# /pev-status

現在進行中のPEVタスクの状態を表示する。

## Usage

```
/pev-status                    # 現在のタスク表示
/pev-status --recent           # 直近5タスク一覧
/pev-status --clean            # 現タスクのartifacts/とmemoryを削除
/pev-status --escalate         # retry上限到達の処理
```

## 表示内容 (default)

```
[PEV Status]

Task ID:    1715394123-a3f9c2
Started:    2026-05-11T14:00:00Z (elapsed 27min)
Phase:      Verify (in progress)
Retry:      1 / 3

Artifacts:
  ✅ artifacts/plan.md         (47 lines)
  ✅ artifacts/execute.log     (12 lines)
  ⏳ artifacts/verify.json     (pending)
  ✅ artifacts/recap.log       (3 entries)

Memory:     ~/.claude/pev/1715394123-a3f9c2/
  - notes.md, executor-1.md, executor-2.md, executor-3.md, verifier.md

Budget:
  - Plan:    47.2k / 50k (94%)
  - Execute: 88.5k / 100k (88%)
  - Verify:   pending

Recent recap (last 3 entries):
  [14:05] Phase 1 (Plan) done. Goal: Refactor auth middleware
  [14:22] Phase 2 (Execute) done. 3 files changed
  [14:26] Phase 3 (Verify) started

Next: wait for /pev-verify to complete
```

## --recent

直近5タスクの履歴 (recap.log があるもの):

```
[Recent PEV tasks]
1. 1715394123-a3f9c2  2026-05-11 14:00  Verify-in-progress
2. 1715350000-b7e1d8  2026-05-10 22:30  PASS
3. 1715303000-c4a9f2  2026-05-10 09:15  FAIL (escalated)
...
```

## --clean

現タスクをcleanup:

```bash
TASK_ID=$(cat artifacts/.task_id)
rm -rf artifacts/
rm -rf ~/.claude/pev/$TASK_ID
echo "Cleaned task $TASK_ID"
```

確認プロンプトを表示してから実行。

## --escalate

retry上限到達時の処理:

```
[ESCALATION]
Task 1715394123-a3f9c2 failed after 3 retries.

Unresolved issues:
- Test failure in tests/server.test.ts:42 (persistent across rounds)
- Type error in src/server.ts:18 (re-introduced in round 2)

Manual intervention required.

Suggestions:
1. Inspect artifacts/plan.md — is the plan wrong?
2. Run /pev-plan manually to revise
3. Run /pev-status --clean and start over with refined spec
```

## 実装

### Default 表示

```bash
if [ ! -f artifacts/.task_id ]; then
  echo "[PEV] No active task."
  exit 0
fi

TASK_ID=$(cat artifacts/.task_id)
RETRY=$(cat artifacts/.retry_count 2>/dev/null || echo 0)
MAX=${PEV_MAX_RETRIES:-3}

echo "[PEV Status]"
echo ""
echo "Task ID:    $TASK_ID"
echo "Retry:      $RETRY / $MAX"
echo ""

echo "Artifacts:"
for f in plan.md execute.log verify.json recap.log; do
  if [ -f "artifacts/$f" ]; then
    LINES=$(wc -l < "artifacts/$f" | tr -d ' ')
    echo "  ✅ artifacts/$f         ($LINES lines)"
  else
    echo "  ⏳ artifacts/$f         (pending)"
  fi
done

echo ""
echo "Memory:     ~/.claude/pev/$TASK_ID/"
if [ -d ~/.claude/pev/$TASK_ID ]; then
  ls -1 ~/.claude/pev/$TASK_ID 2>/dev/null | sed 's/^/  - /'
fi

if [ -f artifacts/recap.log ]; then
  echo ""
  echo "Recent recap (last 5 entries):"
  tail -n 5 artifacts/recap.log | sed 's/^/  /'
fi
```

### --clean

```bash
TASK_ID=$(cat artifacts/.task_id 2>/dev/null)
if [ -z "$TASK_ID" ]; then
  echo "[PEV] No active task to clean."
  exit 0
fi
echo "About to remove:"
echo "  - artifacts/"
echo "  - ~/.claude/pev/$TASK_ID/"
read -p "Confirm (y/N)? " ans
if [ "$ans" = "y" ] || [ "$ans" = "Y" ]; then
  rm -rf artifacts/
  rm -rf ~/.claude/pev/$TASK_ID
  echo "[PEV] Cleaned task $TASK_ID"
fi
```

### --escalate

retry 上限到達時のメッセージ表示。verify.json の `critical_issues` を抽出して人間に判断を仰ぐ。

```bash
node -e "
  const v = JSON.parse(require('fs').readFileSync('artifacts/verify.json','utf8'));
  console.log('[ESCALATION]');
  console.log('Task ' + v.task_id + ' failed after ' + v.retry_count + ' retries.');
  console.log('');
  console.log('Unresolved issues:');
  v.critical_issues.forEach(i => console.log('  - ' + i));
  console.log('');
  console.log('Suggestions:');
  console.log('  1. Inspect artifacts/plan.md — is the plan wrong?');
  console.log('  2. Run /pev-plan manually to revise');
  console.log('  3. Run /pev-status --clean and start over');
"
```

## Implementation notes

- Bashで `cat artifacts/*.json | node -e ...` 程度の薄い実装
- 重い処理は持たない (status表示は安価であるべき)
- `jq` 依存を避ける (node があれば動く環境を前提)
