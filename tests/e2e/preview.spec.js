// "Preview on device" (#6) against the simulator: fast-forward playback, scrubbing, manual levels, stopping.
import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const schemaPath = (name) => fileURLToPath(new URL(`../../schemas/${name}.tmf`, import.meta.url));
const clock = (page) => page.locator('#preview-clock');
const txCount = (page, text) => page.locator('#log .k-tx', { hasText: text }).count();

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (err) => {
    throw err;
  });
  await page.goto('./?sim=1');
  await page.setInputFiles('#file', schemaPath('WINTER'));
});

async function connect(page) {
  await page.click('#btn-connect');
  await page.locator('#toast').getByRole('button', { name: 'Not now' }).click();
}

test('without a controller the preview explains what is needed', async ({ page }) => {
  await page.click('#btn-preview');
  await expect(page.locator('#preview-panel')).toBeVisible();
  await expect(page.locator('#btn-preview')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#preview-state')).toHaveText('Connect the TC420 to preview on the lights.');
  await expect(page.locator('#btn-preview-play')).toBeDisabled();
});

test('plays the program fast-forwarded, pauses, scrubs and stops', async ({ page }) => {
  await connect(page);
  await page.click('#btn-preview');
  await page.check('input[name="preview-speed"][value="1"]');
  await page.click('#btn-preview-play');
  await expect(page.locator('#preview-state')).toHaveText('Playing WINTER on the lights');
  await expect(page.locator('#log .k-tx', { hasText: '0x15' })).toContainText('54 45 53 54 00 7F'); // "TEST"
  await expect(page.locator('#editor-chart .play-cursor')).toHaveCount(1);
  await expect(clock(page)).not.toHaveText('00:00'); // one day per minute: 24 minutes per second

  await page.click('#btn-preview-play'); // pause
  await expect(page.locator('#btn-preview-play')).toHaveText('▶ Play');
  await expect(page.locator('#preview-state')).toHaveText('Holding WINTER at the chosen time');
  const held = await clock(page).textContent();
  await page.waitForTimeout(400);
  await expect(clock(page)).toHaveText(held);

  await page.locator('#preview-time').fill('720'); // 12:00: WINTER is at 100 %
  await expect(clock(page)).toHaveText('12:00');
  await expect(
    page.locator('#log .log-row', { hasText: 'live values CH1–CH5 = 100 / 100 / 100 / 100 / 100' }).first(),
  ).toBeAttached();

  const ends = await txCount(page, '0x02');
  await page.click('#btn-preview-stop');
  await expect(page.locator('#preview-state')).toHaveText('Not playing');
  await expect(page.locator('#editor-chart .play-cursor')).toHaveCount(0);
  expect(await txCount(page, '0x02')).toBe(ends + 1);
});

test('manual mode sets levels by hand', async ({ page }) => {
  await connect(page);
  await page.click('#btn-preview');
  await page.check('input[name="preview-mode"][value="manual"]');
  await expect(page.locator('#preview-manual')).toBeVisible();
  await page.locator('#pv0').fill('60');
  await expect(page.locator('#preview-state')).toHaveText('Manual levels on the lights');
  await expect(
    page.locator('#log .log-row', { hasText: 'live values CH1–CH5 = 60 / 0 / 0 / 0 / 0' }).first(),
  ).toBeAttached();
  await page.click('#btn-preview-stop');
  await expect(page.locator('#preview-state')).toHaveText('Not playing');
});

test('sending a program ends the preview first', async ({ page }) => {
  await connect(page);
  await page.click('#btn-preview');
  await page.click('#btn-preview-play');
  await expect(page.locator('#preview-state')).toHaveText('Playing WINTER on the lights');
  await page.click('#btn-download');
  await page.click('#send-go');
  await expect(page.locator('#dlg-send-title')).toHaveText('✓ WINTER is running on the controller');
  await page.locator('#dlg-send').getByRole('button', { name: 'Done' }).click();
  await expect(page.locator('#preview-state')).toHaveText('Not playing');
});

test('closing the panel stops the preview', async ({ page }) => {
  await connect(page);
  await page.click('#btn-preview');
  await page.click('#btn-preview-play');
  await expect(page.locator('#preview-state')).toHaveText('Playing WINTER on the lights');
  await page.click('#btn-preview');
  await expect(page.locator('#preview-panel')).toBeHidden();
  await expect(page.locator('#log .log-row').filter({ hasText: 'preview stopped' })).toHaveCount(1);
});

test('a refused preview says so and does not keep retrying while scrubbing', async ({ page }) => {
  await page.goto('./?sim=1&simFail=15');
  await page.setInputFiles('#file', schemaPath('WINTER'));
  await connect(page);
  await page.click('#btn-preview');
  const slider = page.locator('#preview-time');
  await Promise.all(['100', '200', '300', '400', '500'].map((v) => slider.fill(v)));
  await expect(page.locator('#preview-state')).toContainText('The controller did not start the preview.');
  await slider.fill('600');
  await slider.fill('700');
  await page.waitForTimeout(200);
  // One attempt; scrubbing afterwards does not retry.
  await expect(page.locator('#log .k-tx', { hasText: '0x15' })).toHaveCount(1);
  await page.click('#btn-preview-play'); // Play does try again
  await expect(page.locator('#log .k-tx', { hasText: '0x15' })).toHaveCount(2);
});
