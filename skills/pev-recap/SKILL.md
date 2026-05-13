---
name: pev-recap
description: 各 phase 完了時に短い recap を artifacts/recap.log に追記。Claude Code v2.1.x の Session Recaps 機能を補完
---

# pev-recap

phase完了ごとに「何をやったか / 次に何が残ってるか」の1〜3行サマリを `artifacts/recap.log` に追記する。長時間セッションから戻った時の context回復を最適化する。

## When to Use

- **v3.0+**: triage agent が triage.json を書き終えた時 (= Phase 0 完了マーカー、 plan_required / plan_skip の decision を recap)
- planner が plan.md を書き終えた時 (Plan が走った場合)
- 各 executor がコード変更を終えた時
- verifier が verify.json を書き終えた時
- ユーザーが `/pev-status` を実行した時

## How It Works

### recap.log フォーマット

```
[2026-05-11T14:23:01Z] Phase 1 (Plan) done.
  - Goal: Add /healthz endpoint
  - Files planned: src/server.ts, tests/server.test.ts
  - Next: /pev-execute or wait for Gate A

[2026-05-11T14:25:18Z] Phase 2 (Execute) done.
  - Files changed: src/server.ts (+18/-0), tests/server.test.ts (+15/-0)
  - Next: Stop hook will invoke verifier

[2026-05-11T14:26:42Z] Phase 3 (Verify) done.
  - Verdict: PASS
  - All 3 acceptance criteria met
  - Next: review changes and commit
```

### Claude Code Session Recaps との関係

Claude Code本体に Session Recaps 機能がある (3分以上席を外して戻ると自動サマリ表示)。

- **Claude Code Recaps**: 全体的なターン進行、Claude Code側が管理
- **pev-recap**: PEV phaseに特化、artifacts/ に永続化、別セッションからも参照可

両者は補完関係。重複しても問題ない。

### 書き込みタイミング

各phase完了時、対応するagentが内部で:

```bash
APPEND_RECAP() {
  local phase="$1"
  local summary="$2"
  echo "[$(date -u +%FT%TZ)] Phase $phase done." >> artifacts/recap.log
  echo "  - $summary" >> artifacts/recap.log
  echo "  - Next: <next step>" >> artifacts/recap.log
  echo "" >> artifacts/recap.log
}
```

agentはこのhelperをBashで呼ぶ。

### `/pev-status` での表示

```
$ /pev-status
Current task: <task_id>
Phase: Verify (in progress)

Recent recap:
[14:23:01] Phase 1 (Plan) done. Goal: Add /healthz endpoint
[14:25:18] Phase 2 (Execute) done. Files: src/server.ts, tests/server.test.ts
```

(最新3エントリのみ表示、全体は `cat artifacts/recap.log`)

## Examples

### 短時間タスクの recap.log 全体

```
[2026-05-11T14:23:01Z] Phase 1 (Plan) done.
  - Goal: Add /healthz endpoint
  - Next: /pev-execute

[2026-05-11T14:25:18Z] Phase 2 (Execute) done.
  - 2 files changed
  - Next: Stop hook → verify

[2026-05-11T14:26:42Z] Phase 3 (Verify) done.
  - Verdict: PASS
  - Next: human review and commit
```

### Retry時の recap.log

```
[2026-05-11T15:01:00Z] Phase 3 (Verify) done.
  - Verdict: FAIL (test failure in tests/server.test.ts:42)
  - Next: retry #1 — planner re-invoked with diff + verify.json

[2026-05-11T15:03:20Z] Phase 1 (Plan, retry 1) done.
  - Updated plan to fix off-by-one in test assertion
  - Next: /pev-execute (auto-resumed)
```

## 注意点

- recap.log は append only、変更しない
- タスク完了 (`/pev-status --clean`) で artifacts/ ごと削除
- 長時間タスクで recap.log が肥大化する場合は `tail -n 50` で対応
- recap内に PII / secret が混ざらないよう agent側で配慮
