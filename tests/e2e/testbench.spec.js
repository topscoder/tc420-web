// End-to-end tests of the test bench against the built-in simulator (?sim=1).
// Playwright's default browser locale is en-US, so the UI starts in English.
import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const schema = (name) => fileURLToPath(new URL(`../../schemas/${name}.tmf`, import.meta.url));
const lastLog = (page) => page.locator('#log .log-row').last();

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (err) => {
    throw err;
  });
  page.on('console', (msg) => {
    if (msg.text().startsWith('i18n:')) throw new Error(msg.text());
  });
  await page.goto('./?sim=1');
});

async function connect(page) {
  await page.click('#btn-connect');
  await expect(page.locator('#status-text')).toContainText('Connected');
  await page.locator('#toast').getByRole('button', { name: 'Not now' }).click();
}

test('loads in simulator mode and starts a log session', async ({ page }) => {
  await expect(page).toHaveTitle('TC420 Web');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('#sim-badge')).toHaveText('SIMULATOR');
  await expect(page.locator('#log .k-session').last()).toContainText('SIMULATOR');
  await expect(page.locator('#btn-sync')).toBeDisabled();
});

test('connects and sets the clock', async ({ page }) => {
  await connect(page);
  await expect(page.locator('#last-T1')).toContainText('connected to Time Controller');
  await page.click('#btn-sync');
  await expect(page.locator('#last-T2')).toHaveText('Last result: clock set, confirmed');
  await expect(page.locator('#log .k-ack').last()).toContainText('0x11 set clock');
});

test('imports a .tmf file, edits it and sends it to the controller', async ({ page }) => {
  await connect(page);
  await page.setInputFiles('#file', schema('AFRIKA'));
  await expect(page.locator('#modes .mode-item')).toHaveCount(1);
  await expect(page.locator('#modes .mode-item')).toContainText('21 steps');
  await expect(page.locator('#editor-table tr')).toHaveCount(22);
  await page.click('#btn-add-step');
  await expect(page.locator('#modes .mode-item')).toContainText('22 steps');

  await page.click('#btn-download');
  await page.click('#send-go');
  await expect(page.locator('#dlg-send-title')).toHaveText('✓ AFRIKA is running on the controller');
  await page.locator('#dlg-send').getByRole('button', { name: 'Done' }).click();
  await expect(page.locator('#dl-progress')).toHaveText('Sent: 1 program is on the controller');
  await expect(page.locator('#last-T5')).toHaveText('Last result: 1 schedule sent');
  await expect(page.locator('#log .k-tx', { hasText: '0x13 step' })).toHaveCount(22);
  await expect(page.locator('#log .k-ack', { hasText: '0x13 step' })).toHaveCount(22);
});

test('sorts the steps of an out-of-order file on import', async ({ page }) => {
  await page.setInputFiles('#file', schema('AMAZONE'));
  await expect(page.locator('#last-T4')).toHaveText('Last result: AMAZONE.tmf: the steps were sorted by time');
  await expect(page.locator('#editor-warnings li')).toHaveCount(0);
  await expect(page.locator('#editor-table tr').nth(3).locator('input[type=time]')).toHaveValue('00:31');
  await expect(page.locator('#editor-table tr').nth(4).locator('input[type=time]')).toHaveValue('02:30');
});

test('reports a file that is not a schedule', async ({ page }) => {
  await page.setInputFiles('#file', {
    name: 'broken.tmf',
    mimeType: 'application/octet-stream',
    buffer: Buffer.from([1, 2]),
  });
  await expect(page.locator('#last-T4')).toHaveText(
    'Last result: broken.tmf could not be loaded: the file is too short for a .tmf header',
  );
});

test('a cancelled send sends nothing', async ({ page }) => {
  await connect(page);
  await page.click('#btn-test-mode');
  await page.click('#btn-download');
  await page.locator('#dlg-send').getByRole('button', { name: 'Cancel' }).click();
  await expect(page.locator('#dlg-send')).not.toBeVisible();
  await expect(lastLog(page)).toContainText('sending cancelled');
  await expect(page.locator('#log .k-tx')).toHaveCount(0);
});

test('online play starts, follows the sliders and stops', async ({ page }) => {
  await connect(page);
  await page.click('#btn-play-start');
  await expect(page.locator('#btn-play-stop')).toBeEnabled();
  await page.locator('#sl0').fill('70');
  await expect(page.locator('#log .log-row', { hasText: 'live values CH1–CH5 = 70' })).toHaveCount(1);
  await expect(page.locator('#play-stats')).toContainText('packets');
  await page.click('#btn-play-stop');
  await expect(page.locator('#last-T3')).toContainText('stopped;');
  await expect(page.locator('#btn-play-start')).toBeEnabled();
});

test('clearing the controller needs the typed confirmation', async ({ page }) => {
  await connect(page);
  page.once('dialog', (d) => d.accept('no'));
  await page.click('#btn-clear');
  await expect(lastLog(page)).toContainText('clearing cancelled');
  page.once('dialog', (d) => {
    expect(d.message()).toContain('Type CLEAR');
    d.accept('clear');
  });
  await page.click('#btn-clear');
  await expect(page.locator('#last-T6')).toHaveText('Last result: all cleared, confirmed');
});

test('sends a raw packet', async ({ page }) => {
  await connect(page);
  await page.fill('#raw-cmd', '11');
  await page.fill('#raw-payload', '07 EA 0A 18 0A 00 00');
  page.once('dialog', (d) => {
    expect(d.message()).toBe('Send command 0x11 with 7 bytes of payload?');
    d.accept();
  });
  await page.click('#btn-raw');
  await expect(page.locator('#last-T7')).toHaveText('Last result: confirmed');
});

test('keeps the log after a reload and exports it as JSON', async ({ page }) => {
  await connect(page);
  await page.click('#btn-sync');
  await expect(page.locator('#last-T2')).toContainText('confirmed');
  await page.reload();
  await expect(page.locator('#log .k-ack', { hasText: '0x11' })).toHaveCount(1);
  await expect(page.locator('#log-count')).toContainText('lines · kept in this browser');

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
  await expect(page.locator('#unsupported')).toContainText('does not support WebHID');
  await expect(page.locator('#btn-connect')).toBeDisabled();
});

test.describe('languages', () => {
  test('switches language without losing edits and remembers the choice', async ({ page }) => {
    await connect(page);
    await page.click('#btn-sync');
    await expect(page.locator('#last-T2')).toHaveText('Last result: clock set, confirmed');
    await page.setInputFiles('#file', schema('AFRIKA'));
    await page.click('#btn-add-step');

    await page.selectOption('#lang', 'nl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'nl');
    await expect(page.locator('#btn-connect')).toHaveText('● TC420 verbonden ▾');
    await expect(page.locator('[data-test="T2"] h2')).toHaveText('Klok zetten');
    await expect(page.locator('#last-T2')).toHaveText('Laatste resultaat: klok gezet, bevestigd');
    await expect(page.locator('#modes .mode-item')).toContainText('22 stappen');
    await expect(page.locator('#status-text')).toHaveText('Verbonden: Time Controller (simulator)');
    await expect(lastLog(page)).toContainText('language changed to nl');

    await page.selectOption('#lang', 'de');
    await expect(page.locator('[data-test="T2"] h2')).toHaveText('Uhr stellen');
    await expect(page.locator('#modes .mode-item')).toContainText('22 Schritte');
    await expect(page.locator('#t6-text code')).toHaveText('LÖSCHEN');

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'de');
    await expect(page.locator('#lang')).toHaveValue('de');
    await expect(page.locator('#btn-connect')).toHaveText('TC420 verbinden');
  });

  test('the log itself stays in English in every language', async ({ page }) => {
    await page.selectOption('#lang', 'de');
    await page.click('#btn-connect');
    await expect(page.locator('#status-text')).toContainText('Verbunden');
    await page.click('#btn-sync');
    await expect(page.locator('#log .k-ack').last()).toContainText('0x11 set clock');
    await expect(page.locator('#log-count')).toContainText('Zeilen · in diesem Browser gespeichert');
  });
});

for (const [locale, expected] of [
  ['de-DE', { lang: 'de', title: 'Uhr stellen', connect: 'TC420 verbinden' }],
  ['nl-NL', { lang: 'nl', title: 'Klok zetten', connect: 'TC420 verbinden' }],
  ['fr-FR', { lang: 'en', title: 'Set clock', connect: 'Connect TC420' }],
]) {
  test.describe(`browser locale ${locale}`, () => {
    test.use({ locale });
    test(`starts in ${expected.lang}`, async ({ page }) => {
      await expect(page.locator('html')).toHaveAttribute('lang', expected.lang);
      await expect(page.locator('[data-test="T2"] h2')).toHaveText(expected.title);
      await expect(page.locator('#btn-connect')).toHaveText(expected.connect);
    });
  });
}
