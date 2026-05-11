---
description: Run only the Verify phase. Validates changes against plan.md acceptance criteria
---

# /pev-verify

変更を検証する。build/type/lint/testを順に実行し、Acceptance Criteria を1つずつチェック。

## Usage

```
/pev-verify
/pev-verify --strict        # dual review (Reviewer A + B) を実施
```

## 前提条件

- `artifacts/plan.md` が存在 (AC比較のため)
- git作業ツリーに変更がある (verifyすべきものがある)

## 実行手順 (hard-coded)

### Step 1: Pre-check

```bash
if [ ! -f artifacts/plan.md ]; then
  echo "[PEV] artifacts/plan.md not found. Cannot verify without acceptance criteria."
  exit 1
fi
if [ ! -f artifacts/.task_id ]; then
  echo "[PEV] artifacts/.task_id missing."
  exit 1
fi
if git diff --quiet HEAD; then
  echo "[PEV] No uncommitted changes detected. Did execute phase produce changes?"
  # 警告のみ、続行はする
fi
TASK_ID=$(cat artifacts/.task_id)
echo "[PEV] Verify phase for task $TASK_ID"
```

### Step 2: Invoke verifier

verifier agent (model: sonnet, effort: xhigh) を起動。`artifacts/plan.md` + `git diff` を渡す。

### Step 3: Run verification commands

verifier が plan.md の `## Verification strategy` セクションを読み、リストされた各コマンドを順次実行:

- Build
- Type check
- Lint
- Tests

各コマンドの結果を `artifacts/verify.json` の `checks[]` に記録。

### Step 4: Check acceptance criteria

verifier が plan.md の `## Acceptance Criteria` の各項目について `met: true|false` と `evidence` を `verify.json` に書き出す。

### Step 5: --strict mode (optional)

```bash
if [ "$1" = "--strict" ]; then
  echo "[PEV] Strict mode: invoking pev-dual-review skill"
  # pev-dual-review skill が起動:
  #   Reviewer A: subagent_type=verifier, model=opus, effort=xhigh
  #   Reviewer B: subagent_type=verifier, model=sonnet, effort=high
  #   同一メッセージ内で並列起動
  #   両方PASS → NICE / いずれかFAIL → NAUGHTY
fi
```

### Step 6: Report

```bash
VERDICT=$(node -e "console.log(JSON.parse(require('fs').readFileSync('artifacts/verify.json','utf8')).verdict)")
echo "[PEV] Verify done. Verdict: $VERDICT"
cat artifacts/verify.json | node -e "
  const v = JSON.parse(require('fs').readFileSync(0, 'utf8'));
  console.log('Checks:');
  v.checks.forEach(c => console.log('  ' + (c.result === 'PASS' ? '✅' : '❌') + ' ' + c.name));
  console.log('Acceptance Criteria:');
  v.acceptance_criteria.forEach(ac => console.log('  ' + (ac.met ? '✅' : '❌') + ' ' + ac.criterion));
"
```

pev-recap が Phase 3 完了エントリを `artifacts/recap.log` に追記。

## --strict モード

- Reviewer A: subagent_type=verifier, model=opus, effort=xhigh
- Reviewer B: subagent_type=verifier, model=sonnet, effort=high
- 並列実行 (同一message内で2 Agent tool call)
- 両者PASS → NICE → ship
- いずれかFAIL → NAUGHTY → planner に retry依頼

## FAIL時の自動retry

`PEV_MAX_RETRIES` (default: 3) 回まで自動retry:

1. `artifacts/retry_count` を increment
2. plan.md + diff + verify.json を渡して `/pev-plan` を起動
3. plan.md が更新されたら `/pev-execute` 起動
4. 再度 `/pev-verify`

3回超えたら escalate (人間判断待ち)。

## 出力例 (PASS)

```
[Phase 3: Verify done]
Verdict: PASS

Checks:
  ✅ build       (tsc: ok)
  ✅ typecheck   (no errors)
  ✅ lint        (eslint: 0 warnings)
  ✅ tests       (vitest: 18/18 passed)

Acceptance Criteria:
  ✅ GET /healthz returns 200
  ✅ Response is {status: "ok"}
  ✅ tests/server.test.ts contains the new test

Result: ship-ready
```

## 出力例 (FAIL, retry triggered)

```
[Phase 3: Verify done]
Verdict: FAIL (retry 1/3)

Failed checks:
  ❌ tests       (vitest: 17/18 passed)
    - tests/server.test.ts:42 — expected 200, got 404

Triggering /pev-plan retry with diff + verify.json
```
