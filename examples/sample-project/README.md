# Sample Project for pev-harness

pev-harness の dog food fixture。 v1.7.1 から **イベント参加申し込みフォーム** をモチーフに、 実務でよくある複雑度 (フォーム validation / 二重送信防止 / LocalStorage 永続化 / accessibility / 状態遷移) を持つ。 plan/execute/verify の各 phase が exercise されるサイズに保ちつつ、 単純な計算関数より「実機の気持ち」が出る形にした。

## 構造

```text
sample-project/
├── README.md                    (このファイル)
├── CLAUDE.md                    (sample-project の domain 説明)
├── package.json                 (vitest + @playwright/test + http-server)
├── vitest.config.js             (unit のみ scope、 tests-e2e は exclude)
├── playwright.config.ts         (webServer auto-start で http-server :8080)
├── index.html                   (申し込みフォーム UI、 accessible)
├── src/
│   ├── validation.js            (純関数: validateName/Email/Phone/Plan/Agreement)
│   └── form.js                  (submit handler / LocalStorage / 二重送信防止)
├── tests/
│   ├── validation.test.js       (境界値網羅)
│   └── form.test.js             (mock storage + fake timer)
├── tests-e2e/
│   └── seed.spec.ts             (Playwright: 正常 / 必須欠落 / format / 二重送信)
├── .claude/
│   └── agents/                  (Playwright init-agents で生成済)
├── .mcp.json                    (playwright-test MCP server)
├── specs/                       (Playwright Planner 出力先)
├── team-conventions.md          (sample-project 用の実務規約)
└── .gitignore                   (artifacts/ / node_modules / playwright-report)
```

## Setup (1 度だけ)

```bash
cd ~/pev-harness/examples/sample-project
npm install
npx playwright install chromium
```

## How to dog food

### A. baseline (現状の form を変えない)

```bash
npm test                # vitest (validation + form の unit tests)
npx playwright test     # Playwright E2E (5 件)
```

両方 green であることを確認してから dog food task を流す。

### B. PEV を回す (feature 追加 dog food)

```bash
claude --plugin-dir ~/pev-harness

# セッション内で
> /pev-harness:pev "電話番号フィールドを必須項目化してください。AC: (1) 電話番号未入力で submit すると 'phone-error' に '電話番号は必須です' と表示される (2) 既存の 10/11 桁の format validation はそのまま (3) tests/validation.test.js / tests-e2e/seed.spec.ts が更新され全 test PASS する。"
```

期待:

- planner → 既存 `validatePhone` の任意項目→必須項目への変更 + test 追加を plan
- executor → src/validation.js 修正 + test 修正 + E2E spec 修正
- verifier → vitest + (UI keyword を AC が含むので) E2E auto-dispatch → 全 pass

### Direct test commands

```bash
npm test                              # vitest only
npx playwright test                   # Playwright only
npm test && npx playwright test       # 両方
```

## クリーンアップ (dog food 後)

```bash
rm -rf artifacts/ playwright-report/ test-results/
git checkout -- src/ tests/ tests-e2e/ index.html
```

## Linear 連携 (v1.2+)

`.linear-config.yml` が `examples/sample-project/` 配下にあれば Linear MCP plugin 経由で issue/project と sync 可能。 詳細は `~/pev-harness/guide/TEST-PLAN-linear-v1.3.md` 参照。

## E2E configuration notes

- **webServer**: `npm run preview` で http-server を spawn (port 8080)
- **Playwright agents**: `.claude/agents/playwright-test-*.md` に置かれ、 Claude Code が認識
- **MCP server**: `.mcp.json` で `playwright-test` server (`npx playwright run-test-mcp-server`) を spawn
- **trace**: 失敗時のみ artifacts/e2e/ に保存 (config: `trace: 'on-first-retry'`)
