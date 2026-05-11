import { test, expect, type Page, type ConsoleMessage } from '@playwright/test';

// Seed test — Playwright Agents (planner/generator) の前提として必須。
// 環境初期化 + 生成 test の参考例として機能する。
// このファイルは pev-bootstrap-playwright skill (v1.4) が template として置く。
// v1.6: DRY pattern (test.beforeEach + console listener fixture) を seed に組み込み、
//       Generator/Healer が新規 test を書くときの reference として活用する。

// DRY fixture: 全 test で console error を監視する。
// Playwright Generator が新規 spec を作るときも、 ここを参考に beforeEach 化することを期待。
const consoleErrors: string[] = [];

test.beforeEach(async ({ page }) => {
  consoleErrors.length = 0;
  page.on('console', (msg: ConsoleMessage) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err: Error) => {
    consoleErrors.push(`pageerror: ${err.message}`);
  });
});

test.afterEach(async () => {
  // 任意: 各 test 終了時に console error が出ていないことを assert する場合に使う
  // expect(consoleErrors, `console errors detected: ${consoleErrors.join('\n')}`).toHaveLength(0);
});

// Helper: 共通 navigation + warmup
async function goHome(page: Page) {
  await page.goto('/');
  await expect(page.locator('h1')).toBeVisible();
}

test('homepage loads and shows page title', async ({ page }) => {
  await goHome(page);
  await expect(page).toHaveTitle('PEV harness sample');
  await expect(page.locator('h1')).toContainText('PEV harness sample');
});

test('add button computes 2 + 3 = 5', async ({ page }) => {
  await goHome(page);
  await page.click('#add-btn');
  await expect(page.locator('#result')).toContainText('add(2, 3) = 5');
});

test('subtract button computes 5 - 3 = 2', async ({ page }) => {
  await goHome(page);
  await page.click('#sub-btn');
  await expect(page.locator('#result')).toContainText('subtract(5, 3) = 2');
});
