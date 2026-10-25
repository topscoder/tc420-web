// The main flow with the keyboard only (#10): create a program, change a level, send it.
import { test, expect } from '@playwright/test';

// Presses Tab until the element matching selector has focus.
async function tabTo(page, selector, max = 200) {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab');
    if (await page.evaluate((sel) => document.activeElement?.matches(sel), selector)) return;
  }
  throw new Error(`could not reach ${selector} with Tab`);
}

test('create a program, edit it and send it with the keyboard only', async ({ page }) => {
  page.on('pageerror', (err) => {
    throw err;
  });
  await page.goto('./?sim=1');

  await tabTo(page, '#welcome-empty');
  await page.keyboard.press('Enter');
  await expect(page.locator('#modes .mode-item')).toHaveCount(1);

  await tabTo(page, '#editor-table input[type=number]');
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('40');
  await page.keyboard.press('Tab');
  await expect(page.locator('#editor-table input[type=number]').first()).toHaveValue('40');

  await tabTo(page, '#btn-download');
  await page.keyboard.press('Enter'); // connects to the simulator first
  await expect(page.locator('#send-go')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#dlg-send-title')).toHaveText('✓ PROG1 is running on the controller');
  await page.keyboard.press('Enter'); // "Done" has focus
  await expect(page.locator('#dlg-send')).toBeHidden();
  await expect(page.locator('#modes .on-controller')).toHaveText('On controller');
});

test('Settings and Advanced open with the keyboard and focus is visible', async ({ page }) => {
  await page.goto('./?sim=1');
  await tabTo(page, '#settings > summary');
  const outline = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
  expect(outline).not.toBe('none');
  await page.keyboard.press('Enter');
  await expect(page.locator('#setting-multiple')).toBeVisible();
  await tabTo(page, '#advanced > summary');
  await page.keyboard.press('Space');
  await expect(page.locator('#log')).toBeVisible();
});
