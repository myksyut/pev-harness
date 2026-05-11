import { test, expect, type Page, type ConsoleMessage } from '@playwright/test';

// Seed test — Playwright Agents (planner/generator) の前提として必須。
// 環境初期化 + 生成 test の参考例として機能する。
// pev-bootstrap-playwright skill (v1.4) が template として置く。
// v1.6: DRY pattern (test.beforeEach + console listener fixture) を seed に組み込み、
//       Generator/Healer が新規 test を書くときの reference として活用する。
// v1.7.1+: sample-project は「イベント申し込みフォーム」に刷新済。 form 系の test を
//          典型 fixture として置いておく。

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

async function goHome(page: Page) {
  await page.goto('/');
  await expect(page.locator('h1')).toBeVisible();
  // localStorage は test ごとに分離する: 前の test の submission が残らないように。
  await page.evaluate(() => localStorage.clear());
}

async function fillValidForm(page: Page) {
  await page.fill('#name', '山田太郎');
  await page.fill('#email', 'taro@example.com');
  await page.selectOption('#plan', 'standard');
  await page.check('#agreement');
}

test('homepage loads with form fields visible', async ({ page }) => {
  await goHome(page);
  await expect(page).toHaveTitle('PEV harness sample — event signup');
  await expect(page.locator('#name')).toBeVisible();
  await expect(page.locator('#email')).toBeVisible();
  await expect(page.locator('#phone')).toBeVisible();
  await expect(page.locator('#plan')).toBeVisible();
  await expect(page.locator('#agreement')).toBeVisible();
  await expect(page.locator('#submit-btn')).toBeVisible();
});

test('valid submit: success message appears and form resets', async ({ page }) => {
  await goHome(page);
  await fillValidForm(page);
  await page.click('#submit-btn');
  await expect(page.locator('#success')).toBeVisible();
  await expect(page.locator('#success')).toContainText('申し込みを受け付けました');
  await expect(page.locator('#name')).toHaveValue('');
  await expect(page.locator('#email')).toHaveValue('');
});

test('missing required field shows error and blocks submit', async ({ page }) => {
  await goHome(page);
  await page.fill('#name', '山田');
  await page.selectOption('#plan', 'premium');
  await page.check('#agreement');
  await page.click('#submit-btn');
  await expect(page.locator('#email-error')).toContainText('メールアドレスは必須です');
  await expect(page.locator('#success')).toBeHidden();
});

test('invalid email format shows error', async ({ page }) => {
  await goHome(page);
  await page.fill('#name', '山田');
  await page.fill('#email', 'not-an-email');
  await page.selectOption('#plan', 'standard');
  await page.check('#agreement');
  await page.click('#submit-btn');
  await expect(page.locator('#email-error')).toContainText('形式が正しくありません');
});

test('double submit prevention: rapid clicks produce single submission', async ({ page }) => {
  await goHome(page);
  await fillValidForm(page);
  await Promise.all([
    page.click('#submit-btn'),
    page.click('#submit-btn', { force: true }).catch(() => {}),
  ]);
  await expect(page.locator('#success')).toBeVisible();
  const count = await page.evaluate(() => {
    const raw = localStorage.getItem('pev-sample-submissions');
    return raw ? (JSON.parse(raw) as unknown[]).length : 0;
  });
  expect(count).toBe(1);
});
