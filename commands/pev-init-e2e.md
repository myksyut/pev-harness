---
description: Bootstrap Playwright + Playwright agents in the current project (one-time setup)
---

# /pev-init-e2e

新規プロジェクトに Playwright と Playwright agents を導入する **one-time setup** コマンド。 完了後は `/pev-verify-e2e` が利用可能になる。

## Usage

```text
/pev-init-e2e                         # 5 step を全部実行
/pev-init-e2e --only=install          # npm install + browser binary のみ
/pev-init-e2e --only=config           # playwright.config.ts + seed test のみ
/pev-init-e2e --only=agents           # init-agents のみ
```

## フロー (pev-bootstrap-playwright skill 起動)

1. `npm install -D @playwright/test http-server`
2. `npx playwright install --with-deps chromium`
3. `playwright.config.ts` template 作成 (webServer command と baseURL は質問返し)
4. `tests-e2e/seed.spec.ts` template 作成
5. `npx playwright init-agents --loop=claude` ← Playwright agents 自動生成 (`.claude/agents/playwright-test-*.md` + `.mcp.json`)
6. (option) `.gitignore` 更新

詳細は [`skills/pev-bootstrap-playwright/SKILL.md`](../skills/pev-bootstrap-playwright/SKILL.md)。

## 既に setup 済の場合

skill が Preflight で detect し、 該当 step を skip。 incremental に missing step のみ実行。

## 完了後

```text
/pev-verify-e2e   # 動作確認
```

か、 PEV pipeline 内で AC に UI/E2E keyword を含む issue を `/pev <linear-url>` で起動すると verifier が auto-dispatch する。
