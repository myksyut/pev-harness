import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

// AC2: 入力してEnterで未完了sectionに追加される
test('AC2: add task via Enter — appears in pending list', async ({ page }) => {
  await page.fill('#add-input', 'buy milk');
  await page.keyboard.press('Enter');

  const pendingItems = page.locator('#pending-list li');
  await expect(pendingItems).toHaveCount(1);
  await expect(pendingItems.first().locator('.text')).toHaveText('buy milk');

  // AC7 supplement: sections exist
  await expect(page.locator('#pending-section')).toBeVisible();
  await expect(page.locator('#done-section')).toBeVisible();
});

// AC3: toggle → done section に移動
test('AC3: toggle task — moves to done list', async ({ page }) => {
  await page.fill('#add-input', 'write tests');
  await page.keyboard.press('Enter');

  await page.locator('#pending-list li').first().locator('button[data-action="toggle"]').click();

  await expect(page.locator('#pending-list li')).toHaveCount(0);
  await expect(page.locator('#done-list li')).toHaveCount(1);
  await expect(page.locator('#done-list li').first().locator('.text')).toHaveText('write tests');
});

// AC4: done → untoggle → pending に戻る
test('AC4: untoggle task — moves back to pending list', async ({ page }) => {
  await page.fill('#add-input', 'review PR');
  await page.keyboard.press('Enter');

  await page.locator('#pending-list li').first().locator('button[data-action="toggle"]').click();
  await expect(page.locator('#done-list li')).toHaveCount(1);

  await page.locator('#done-list li').first().locator('button[data-action="untoggle"]').click();

  await expect(page.locator('#pending-list li')).toHaveCount(1);
  await expect(page.locator('#done-list li')).toHaveCount(0);
  await expect(page.locator('#pending-list li').first().locator('.text')).toHaveText('review PR');
});

// AC5: pending と done 両方の delete を確認
test('AC5: delete task from pending and done', async ({ page }) => {
  // add two tasks
  await page.fill('#add-input', 'task-pending');
  await page.keyboard.press('Enter');
  await page.fill('#add-input', 'task-done');
  await page.keyboard.press('Enter');

  // toggle second task to done
  const pendingItems = page.locator('#pending-list li');
  await pendingItems.filter({ hasText: 'task-done' }).locator('button[data-action="toggle"]').click();

  // delete from pending
  await page.locator('#pending-list li').first().locator('button[data-action="delete"]').click();
  await expect(page.locator('#pending-list li')).toHaveCount(0);

  // delete from done
  await page.locator('#done-list li').first().locator('button[data-action="delete"]').click();
  await expect(page.locator('#done-list li')).toHaveCount(0);
});

// AC6: reload後もlocalStorageからタスクが復元される
test('AC6: tasks persist across reload', async ({ page }) => {
  await page.fill('#add-input', 'task-1');
  await page.keyboard.press('Enter');
  await page.fill('#add-input', 'task-2');
  await page.keyboard.press('Enter');
  await page.fill('#add-input', 'task-3');
  await page.keyboard.press('Enter');

  await expect(page.locator('#pending-list li')).toHaveCount(3);

  await page.reload();

  await expect(page.locator('#pending-list li')).toHaveCount(3);
});

// AC8: 空文字/whitespaceのみで submit → 追加されない
test('AC8: empty or whitespace input is silently ignored', async ({ page }) => {
  // empty string
  await page.fill('#add-input', '');
  await page.keyboard.press('Enter');
  await expect(page.locator('#pending-list li')).toHaveCount(0);

  // whitespace only
  await page.fill('#add-input', '   ');
  await page.keyboard.press('Enter');
  await expect(page.locator('#pending-list li')).toHaveCount(0);
});
