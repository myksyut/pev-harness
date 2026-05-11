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

1. `git diff` で変更を取得
2. `artifacts/plan.md` の Verification strategy セクションを読む
3. リストされたコマンドを順次実行:
   - Build
   - Type check
   - Lint
   - Tests
4. plan.md の各 Acceptance Criteria を ✅/❌ チェック
5. 結果を `artifacts/verify.json` に書き出す
6. `--strict` 指定時、`pev-dual-review` skillを起動して並列でReviewer A/B実行
7. 結果サマリを表示

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
