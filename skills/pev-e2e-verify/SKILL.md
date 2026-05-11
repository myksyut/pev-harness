---
name: pev-e2e-verify
description: AC に UI / E2E 系の項目が含まれる時、 Playwright CLI で end-to-end test を実行して verify する skill。 token 効率のため MCP ではなく CLI を採用、 Playwright Agents (planner/generator/healer) を reference して test 生成・修復は委譲する。 verifier から auto-dispatch (AC keyword 検知) もしくは --e2e フラグで明示起動される。
---

# pev-e2e-verify

`verifier` agent の sub-skill。 npm test (unit) では検証できない **UI / E2E** AC を Playwright で確認する。

token 効率のため Playwright **CLI** ベース (`npx playwright test`)。 Playwright MCP は使わない (~75% コンテキスト節約、 公式推奨)。 test 生成 / 修復は Playwright が出荷する **3 agent** (planner/generator/healer、 `.claude/agents/` 配下の Markdown agent definitions) に委譲する。

## When to Use

起動すべき場面:

- AC に UI / E2E 系の **keyword** が含まれる時 (verifier が auto-dispatch):
  - `click` / `navigate` / `page` / `screen` / `button` / `form` / `dialog` / `modal` / `redirect` / `appears` / `visible` / `hidden` / `accessible` / `ARIA`
- ユーザーが明示的に `--e2e` フラグを付けて `/pev` / `/pev-verify` を起動した時
- `/pev-verify-e2e` 直接呼び出し時

起動すべきでない場面:

- API endpoint の HTTP response 確認 → 通常の verifier (curl / supertest)
- 純粋な library / function の unit test → vitest 等
- AC が完全に backend 系 (DB migration / cron job / etc.)

dispatch logic は **default auto-detect** + **explicit `--e2e` / `--no-e2e` override 可** (v1.4 設計)。

## Prerequisites

- `@playwright/test` が プロジェクトに install済 (`package.json` の devDependencies)
- `npx playwright install --with-deps chromium` 実行済 (browser binary)
- `playwright.config.ts` 存在 (testDir / webServer / baseURL の設定)
- `tests-e2e/seed.spec.ts` 存在 (Playwright agents の前提)
- `.claude/agents/playwright-test-{planner,generator,healer}.md` 存在 (`npx playwright init-agents --loop=claude` で生成)
- `.mcp.json` に `playwright-test` MCP server 設定 (init-agents が同時に書く)

未 install の場合は `pev-bootstrap-playwright` skill を起動 (上記5項目を 1 コマンドで bootstrap)。

## Architecture

```text
[verifier agent]
  │ AC keyword 検知 or --e2e フラグ
  ▼
[pev-e2e-verify skill]
  │
  ├─ Step 1: preflight (playwright install 確認、 seed.spec.ts 確認、 agents 初期化済か確認)
  │   └─ 未setup → pev-bootstrap-playwright を促す
  │
  ├─ Step 2: existing test 実行
  │   └─ npx playwright test --reporter=json,html
  │       (artifacts/e2e/ に保存)
  │
  ├─ Step 3: AC に対応する test が無い → Playwright agents に委譲
  │   ├─ Planner agent → specs/<ac-slug>.md
  │   └─ Generator agent → tests-e2e/<ac-slug>.spec.ts
  │   └─ npx playwright test を再実行
  │
  ├─ Step 4: 失敗 → Healer agent (option)
  │   ├─ 失敗 step を replay
  │   ├─ patch 提案
  │   └─ 再 test
  │
  └─ Step 5: artifacts/e2e/ に結果保存 + sync_state.json 更新
```

## Step 詳細

### Step 1: Preflight (v1.3 規約準拠)

```bash
# 必須項目 5 つ
[ -f node_modules/@playwright/test/package.json ] || echo "playwright not installed"
npx playwright --version > /dev/null 2>&1 || echo "playwright CLI not available"
[ -f playwright.config.ts ] || [ -f playwright.config.js ] || echo "playwright config missing"
[ -f tests-e2e/seed.spec.ts ] || echo "seed test missing (required for Playwright agents)"
[ -d .claude/agents ] && ls .claude/agents/playwright-test-{planner,generator,healer}.md > /dev/null 2>&1 || echo "playwright agents not initialized"
[ -f .mcp.json ] && grep -q "playwright-test" .mcp.json || echo "playwright-test MCP server not configured"
```

不在の項目があれば warning + `pev-bootstrap-playwright` skill を起動するか提案。 `linear-project-workflow` の Preflight と同じ規約 (Read=warning continue / Write=hard fail) を踏襲。

### Step 2: Existing test 実行

```bash
mkdir -p artifacts/e2e

# JSON reporter で agent-parseable + HTML reporter で人間レビュー用
npx playwright test \
  --reporter=json,html \
  --output=artifacts/e2e/test-results/ \
  2>&1 | tee artifacts/e2e/stdout.log

# json output は別 path に rename (playwright default は test-results.json)
mv test-results.json artifacts/e2e/results.json 2>/dev/null || true
```

reporter 選択基準:

- `json`: agent が parse して PASS/FAIL を判定
- `html`: 人間レビュー用、 失敗時の screenshot/trace 込み
- `line` / `list`: token 節約 (stdout が長くなるなら未使用)

artifacts 構造:

```text
artifacts/e2e/
├── results.json              # machine-readable verdict
├── playwright-report/        # HTML reporter output
├── test-results/             # screenshot, trace, video
├── stdout.log                # raw stdout
└── sync_state.json           # pev-e2e-verify 動作の trace
```

### Step 3: AC に対応する test が無い → Playwright agents 委譲

verifier が AC を見て「これは E2E test として書ける」と判断、 かつ既存 test に対応するものがない場合:

```text
1. Planner agent invoke (.github/ 配下のMarkdown agent を Claude Code が読む)
   - input: AC 文字列 (例: "ログインボタンを押すと dashboard に遷移する")
   - output: specs/<ac-slug>.md (Markdown test plan)
2. Generator agent invoke
   - input: specs/<ac-slug>.md + tests-e2e/seed.spec.ts (ref)
   - output: tests-e2e/<ac-slug>.spec.ts (executable Playwright test)
3. Step 2 を再実行 (新規生成 test を含めて npx playwright test)
```

これらの agent は **Playwright が用意した Markdown agent definitions** で、 pev-harness 側で再実装しない。 単に `.claude/agents/playwright-test-{planner,generator,healer}.md` 配下にあれば Claude Code が認識する。

**重要**: 各 agent definition の `tools:` field には `mcp__playwright-test__*` (browser_click / browser_navigate / planner_save_plan / generator_write_test 等) が大量に listed されている。 これは Playwright が独自に提供する **`playwright-test` MCP server** (一般 `playwright` MCP とは別物、 test 生成専用) によって動く。 `.mcp.json` が config を保持する。

つまり pev-harness の verifier は:

- ✅ `npx playwright test` で test 実行 (CLI、 token 効率)
- ✅ test 生成 / 修復は Playwright agents に委譲 (これらは内部で専用 MCP を使う、 公式の効率的設計)

の二段構え。 pev-harness 側で MCP の用意は不要 (Playwright init-agents が自動 setup)。

### Step 4: Healer agent (option、 default ON)

test が失敗した場合:

```text
1. results.json の failure 詳細を読む
2. Healer agent invoke (.github/healer.md)
   - input: 失敗した test 名 + failure context
   - output: locator 更新 / wait 調整 などの patch
3. patch を tests-e2e/ に適用
4. 再 test (npx playwright test --grep <failed test>)
5. 再 fail → Healer 再起動 (max 2 round)
6. それでも失敗 → "Healer unable to fix" を verify.json に記録、 verifier 親 agent が判断
```

Healer は test side の問題 (locator drift など) を fix する。 **アプリ側のバグは Healer は fix しない** (planner agent に戻して retry)。

### Step 5: artifacts への記録

```text
artifacts/e2e/sync_state.json:
{
  "ran_at": "2026-05-11T...",
  "preflight": {
    "playwright_installed": true,
    "config_present": true,
    "seed_test_present": true,
    "agents_initialized": true
  },
  "test_result": {
    "total": 5,
    "passed": 4,
    "failed": 1,
    "skipped": 0
  },
  "generated_tests": [
    {"spec": "specs/login-redirect.md", "test": "tests-e2e/login-redirect.spec.ts", "via": "Planner+Generator"}
  ],
  "healer_runs": [
    {"failed_test": "...", "rounds": 1, "outcome": "fixed | unfixable"}
  ],
  "verdict": "PASS | FAIL"
}
```

verifier 親 agent が `sync_state.json.verdict` を読んで verify.json に統合する。

## Examples

### Example 1: AC が UI 系 (auto-dispatch)

```text
AC: "/healthz エンドポイントに加えて、 / ページに 'Status: ok' バッジが表示される"

verifier の動作:
1. AC parse → "ページ" "表示" の keyword 検知
2. pev-e2e-verify skill auto-dispatch
3. Step 1 preflight: 全 OK
4. Step 2: 既存 test 実行 → "ステータスバッジ表示" 系 test なし
5. Step 3: Planner → specs/status-badge.md 生成
   Generator → tests-e2e/status-badge.spec.ts 生成
   再 test → PASS
6. Step 5: artifacts/e2e/ に保存
```

### Example 2: 明示的 --e2e フラグ

```bash
/pev-harness:pev https://linear.app/.../issue/TES-99 --e2e
```

verifier 親 agent が `--e2e=true` を渡し、 pev-e2e-verify が必ず invoke される (AC keyword に関わらず)。

### Example 3: --no-e2e で disable

```bash
/pev-harness:pev https://linear.app/.../issue/TES-100 --no-e2e
```

verifier が AC keyword を検知しても skip。 unit test のみで verdict 判定。

## MCP error handling

Playwright CLI は MCP ではないが、 dependent な MCP tool (browser 操作系) を使う場合は `linear-project-workflow` の MCP error handling 表を参照 (single source of truth)。

## Token 効率の根拠

| アプローチ | Token/session |
|---|---|
| Playwright MCP | ~114K |
| **Playwright CLI (このskill)** | **~27K** |
| 節約 | 87K (~75% コンテキスト残る) |

公式推奨: "If your tasks involve coding, testing, and you're using a coding agent — use CLI" ([Playwright Docs](https://playwright.dev/docs/getting-started-cli))。

## Limitations

- **Playwright agents が `.github/` 配下に init されていることが前提** (`pev-bootstrap-playwright` が自動 setup)
- **dev server は webServer config が起動する想定** (手動起動不要)
- **Healer は test side の修正のみ** (アプリ側 bug は planner に戻す)
- **token 制御**: stdout が長すぎる場合は `--quiet` / `--reporter=json` のみに切替

## Related

- [`pev-bootstrap-playwright`](../pev-bootstrap-playwright/SKILL.md) — 新規プロジェクトの Playwright setup を自動化
- `agents/verifier.md` — dispatch logic (AC keyword + --e2e フラグ)
- `commands/pev-verify-e2e.md` — explicit invocation
- Playwright 公式: <https://playwright.dev/docs/test-agents>
- 設計判断: 2026-05-11 dog food session 後の v1.4 design (CLI 採用、 token 効率最重視)
