// End-to-end tests of the test bench against the built-in simulator (?sim=1).
import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const schema = (name) => fileURLToPath(new URL(`../../schemas/${name}.tmf`, import.meta.url));
const lastLog = (page) => page.locator('#log .log-row').last();

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (err) => {
    throw err;
  });
  await page.goto('./?sim=1');
});

async function connect(page) {
  await page.click('#btn-connect');
  await expect(page.locator('#status-text')).toContainText('Verbonden');
}

test('loads in simulator mode and starts a log session', async ({ page }) => {
  await expect(page).toHaveTitle('TC420 Web');
  await expect(page.locator('#sim-badge')).toBeVisible();
  await expect(page.locator('#log .k-sessie').last()).toContainText('SIMULATIE');
  await expect(page.locator('#btn-sync')).toBeDisabled();
});

test('connects and sets the clock', async ({ page }) => {
  await connect(page);
  await expect(page.locator('#last-T1')).toContainText('verbonden');
  await page.click('#btn-sync');
  await expect(page.locator('#last-T2')).toHaveText('Laatste resultaat: klok gezet, bevestigd');
  await expect(page.locator('#log .k-ack').last()).toContainText('0x11 klok zetten');
});

test('imports a .tmf file, edits it and downloads it to the controller', async ({ page }) => {
  await connect(page);
  await page.setInputFiles('#file', schema('AFRIKA'));
  await expect(page.locator('#modes .mode-item')).toHaveCount(1);
  await expect(page.locator('#modes .mode-item')).toContainText('21 stappen');
  await expect(page.locator('#editor-table tr')).toHaveCount(22);
  await page.click('#btn-add-step');
  await expect(page.locator('#modes .mode-item')).toContainText('22 stappen');

  page.once('dialog', (d) => d.accept());
  await page.click('#btn-download');
  await expect(page.locator('#dl-progress')).toHaveText('Download geslaagd');
  await expect(page.locator('#last-T5')).toContainText("1 schema('s) gedownload");
  await expect(page.locator('#log .k-tx', { hasText: '0x13 stap' })).toHaveCount(22);
  await expect(page.locator('#log .k-ack', { hasText: '0x13 stap' })).toHaveCount(22);
});

test('a cancelled download sends nothing', async ({ page }) => {
  await connect(page);
  await page.click('#btn-test-mode');
  page.once('dialog', (d) => d.dismiss());
  await page.click('#btn-download');
  await expect(lastLog(page)).toContainText('download geannuleerd');
  await expect(page.locator('#log .k-tx')).toHaveCount(0);
});

test('online play starts, follows the sliders and stops', async ({ page }) => {
  await connect(page);
  await page.click('#btn-play-start');
  await expect(page.locator('#btn-play-stop')).toBeEnabled();
  await page.locator('#sl0').fill('70');
  await expect(page.locator('#log .log-row', { hasText: 'live waarden CH1–CH5 = 70' })).toHaveCount(1);
  await page.click('#btn-play-stop');
  await expect(page.locator('#last-T3')).toContainText('gestopt');
  await expect(page.locator('#btn-play-start')).toBeEnabled();
});

test('clearing the controller needs the typed confirmation', async ({ page }) => {
  await connect(page);
  page.once('dialog', (d) => d.accept('nee'));
  await page.click('#btn-clear');
  await expect(lastLog(page)).toContainText('wissen geannuleerd');
  page.once('dialog', (d) => d.accept('WISSEN'));
  await page.click('#btn-clear');
  await expect(page.locator('#last-T6')).toContainText('alles gewist');
});

test('sends a raw packet', async ({ page }) => {
  await connect(page);
  await page.fill('#raw-cmd', '11');
  await page.fill('#raw-payload', '07 EA 0A 18 0A 00 00');
  page.once('dialog', (d) => d.accept());
  await page.click('#btn-raw');
  await expect(page.locator('#last-T7')).toHaveText('Laatste resultaat: bevestigd');
});

test('keeps the log after a reload and exports it as JSON', async ({ page }) => {
  await connect(page);
  await page.click('#btn-sync');
  await expect(page.locator('#last-T2')).toContainText('bevestigd');
  await page.reload();
  await expect(page.locator('#log .k-ack', { hasText: '0x11' })).toHaveCount(1);

  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#btn-export-json')]);
  expect(download.suggestedFilename()).toMatch(/^tc420-testlog-\d{8}-\d{4}\.json$/);
  const doc = JSON.parse(readFileSync(await download.path(), 'utf8'));
  expect(doc.app).toBe('TC420 Web');
  expect(doc.entries.some((e) => e.kind === 'ack' && e.text.includes('0x11'))).toBe(true);
});

test('exports an edited schedule as .tmf', async ({ page }) => {
  await page.setInputFiles('#file', schema('WINTER'));
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#btn-export-tmf')]);
  expect(download.suggestedFilename()).toBe('WINTER.tmf');
  expect(readFileSync(await download.path())).toEqual(readFileSync(schema('WINTER')));
});

test('explains when the browser has no WebHID', async ({ page }) => {
  await page.addInitScript(() => {
    delete Navigator.prototype.hid;
  });
  await page.goto('./');
  await expect(page.locator('#unsupported')).toBeVisible();
  await expect(page.locator('#btn-connect')).toBeDisabled();
});
