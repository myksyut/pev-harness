---
description: Run only the E2E verification phase via Playwright CLI (skips unit-only verifier)
---

# /pev-verify-e2e

Playwright を使った End-to-End verification を実行する。 既存の `/pev-verify` (unit test + AC check) と並列に走るか、 単独で走るかを使い分けられる。

## Usage

```text
/pev-verify-e2e                       # 既存 artifacts/plan.md の AC を参照、 E2E のみ
/pev-verify-e2e --no-heal             # Healer agent を起動しない (失敗そのまま report)
/pev-verify-e2e --skip-generation     # 既存 test のみ実行、 Planner/Generator を起動しない
```

## 前提

- `pev-bootstrap-playwright` skill が completed 済 (= playwright install / agents init 済)
- `artifacts/plan.md` 存在 (AC の source)

## フロー

1. `pev-e2e-verify` skill 起動 (詳細は `skills/pev-e2e-verify/SKILL.md`)
2. Preflight check (playwright install / config / seed / agents)
3. `npx playwright test --reporter=json,html` 実行
4. (option) AC に対応する test 不在 → Playwright Planner/Generator 自動生成
5. (option) test fail → Playwright Healer で auto-fix (max 2 round)
6. `artifacts/e2e/` に結果保存
7. `artifacts/e2e/sync_state.json.verdict` (PASS/FAIL) を verifier に返却

## /pev-verify との関係

- `/pev-verify`: unit test + AC check (既存) — verifier が dispatch logic で E2E を呼ぶ場合あり
- `/pev-verify-e2e`: E2E のみ、 unit test は skip — 主に「unit test 後、 E2E だけ追加で確認したい」場面
- 統合: `/pev-verify --e2e` で unit + E2E 両方 (verifier が両 skill を順次起動)

## Implementation note

skill 内のdispatch logic は v1.4 で実装。 詳細は [Issue tracker](https://github.com/myksyut/pev-harness/issues) で。
