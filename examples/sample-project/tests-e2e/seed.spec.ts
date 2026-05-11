import { test, expect } from '@playwright/test';

// Seed test — Playwright Agents (planner/generator) の前提として必須。
// 環境初期化 + 生成 test の参考例として機能する。
// このファイルは pev-bootstrap-playwright skill (v1.4) が template として置く。

test('homepage loads and shows page title', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('PEV harness sample');
  await expect(page.locator('h1')).toContainText('PEV harness sample');
});

test('add button computes 2 + 3 = 5', async ({ page }) => {
  await page.goto('/');
  await page.click('#add-btn');
  await expect(page.locator('#result')).toContainText('add(2, 3) = 5');
});

test('subtract button computes 5 - 3 = 2', async ({ page }) => {
  await page.goto('/');
  await page.click('#sub-btn');
  await expect(page.locator('#result')).toContainText('subtract(5, 3) = 2');
});
