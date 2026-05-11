# Sample Project for pev-harness

最小サンプル。 pev-harness を dog food するための「壊れていい」プロジェクト。 v1.4 から **unit test (vitest) + E2E test (Playwright)** の両方を fixture として備える。

## 構造

```text
sample-project/
├── README.md                    (このファイル)
├── package.json                 (vitest + @playwright/test + http-server)
├── vitest.config.js             (unit と E2E の scope 分離)
├── playwright.config.ts         (Playwright config、 webServer 設定)
├── index.html                   (E2E 用 minimal page、 add/subtract ボタン)
├── src/
│   └── index.js                 (add + subtract の実装、 dog food 開始時に reset 可)
├── tests/
│   └── index.test.js            (vitest、 unit test)
├── tests-e2e/
│   └── seed.spec.ts             (Playwright、 seed test 3 件)
├── .claude/
│   └── agents/                  (Playwright init-agents で自動生成)
│       ├── playwright-test-planner.md
│       ├── playwright-test-generator.md
│       └── playwright-test-healer.md
├── .mcp.json                    (playwright-test MCP server 設定、 init-agents で自動生成)
├── specs/                       (Playwright Planner agent の出力先、 init-agents で生成)
├── team-conventions.md          (sample-project 用の規約)
└── .gitignore                   (artifacts/ / node_modules / playwright-report 除外)
```

## How to dog food

### Setup (1 度だけ)

```bash
cd ~/pev-harness/examples/sample-project
npm install
npx playwright install chromium       # browser binary
# init-agents は既に repo にコミット済みなので不要
```

### Unit test dog food (v0.1-v0.6 style)

```bash
# src/index.js を TODO 状態に reset
cat > src/index.js << 'EOF'
export function add(a, b) {
  throw new Error('not implemented');
}
EOF

# pev-harness で起動
claude --plugin-dir ~/pev-harness

# セッション内で
> /pev-harness:pev "Implement add(a, b) in src/index.js to return a + b. Tests should pass."
```

期待: planner → executor (add 実装) → verifier (vitest 4/4 PASS) → 完了。

### E2E test dog food (v1.4+ style)

```bash
# src/index.js は実装済 state (add + subtract)
# pev-harness で起動
claude --plugin-dir ~/pev-harness

# セッション内で (UI 系 keyword を AC に入れる)
> /pev-harness:pev "Add a multiply button to index.html that displays multiply(2, 3) = 6 when clicked. The button must be visible and clicking it shows the result."
```

期待: planner → executor (index.html 拡張 + multiply 実装) → verifier (unit test PASS + AC に "button" "clicking" 検知 → E2E auto-dispatch → Playwright test生成 → 実行) → 完了。

### Direct test commands

```bash
npm test                              # vitest only (unit)
npx playwright test                   # Playwright only (E2E)
npm test && npx playwright test       # 両方
```

## クリーンアップ

```bash
rm -rf artifacts/ playwright-report/ test-results/
git checkout -- src/index.js tests/index.test.js index.html tests-e2e/
```

## Linear連携 (v1.2+)

`.linear-config.yml` が `examples/sample-project/` 配下にあれば Linear MCP plugin 経由で issue/project と sync 可能。 詳細は `~/pev-harness/guide/TEST-PLAN-linear-v1.3.md` 参照。

## E2E configuration notes

- **webServer**: `npm run preview` で http-server を spawn (port 8080)
- **Playwright agents**: `.claude/agents/playwright-test-*.md` に置かれ、 Claude Code が認識
- **MCP server**: `.mcp.json` で `playwright-test` server (`npx playwright run-test-mcp-server`) を spawn
- **trace**: 失敗時のみ artifacts/e2e/ に保存 (config: `trace: 'on-first-retry'`)
