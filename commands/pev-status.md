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

## Implementation notes

- Bashで `cat artifacts/*.json | jq ...` 程度の薄い実装
- 重い処理は持たない (status表示は安価であるべき)
