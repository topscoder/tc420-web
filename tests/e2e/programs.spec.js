// End-to-end tests for the program library (#4): saving, names, import, backup, controller state.
import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const schemaPath = (name) => fileURLToPath(new URL(`../../schemas/${name}.tmf`, import.meta.url));
const items = (page) => page.locator('#modes .mode-item');

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (err) => {
    throw err;
  });
  await page.goto('./?sim=1');
});

test('programs and edits are saved and survive a reload', async ({ page }) => {
  await expect(page.locator('#lib-status')).toHaveText('Saved automatically in this browser.');
  await page.setInputFiles('#file', [schemaPath('WINTER'), schemaPath('ZOMER')]);
  await expect(items(page)).toHaveCount(2);
  await expect(page.locator('#last-T4')).toHaveText('Last result: 2 programs imported');

  const name = items(page).nth(1).locator('input.name');
  await name.fill('summer');
  await name.press('Enter');
  await expect(name).toHaveValue('SUMMER');
  await page.locator('#editor-table tr').nth(3).locator('input[type=number]').first().fill('80');
  await page.locator('#editor-table tr').nth(3).locator('input[type=number]').first().press('Enter');

  await page.reload();
  await expect(items(page)).toHaveCount(2);
  await expect(items(page).nth(1).locator('input.name')).toHaveValue('SUMMER');
  await expect(page.locator('#editor-title')).toHaveText('Edit: SUMMER');
  await expect(page.locator('#editor-table tr').nth(3).locator('input[type=number]').first()).toHaveValue('80');
});

test('names are limited while typing and converted on import', async ({ page }) => {
  await page.setInputFiles('#file', {
    name: 'Zwölf Uhr.tmf',
    mimeType: 'application/octet-stream',
    buffer: readFileSync(schemaPath('WINTER')),
  });
  await expect(page.locator('#last-T4')).toContainText('Zwölf Uhr.tmf imported as ZWOLF UH');
  const name = items(page).first().locator('input.name');
  await name.fill('');
  await name.pressSequentially('abc!é_xyz123');
  await expect(name).toHaveValue('ABCEXYZ1');
});

test('duplicate and delete', async ({ page }) => {
  await page.setInputFiles('#file', schemaPath('WINTER'));
  await items(page).first().getByRole('button', { name: 'Duplicate' }).click();
  await expect(items(page)).toHaveCount(2);
  await expect(items(page).nth(1).locator('input.name')).toHaveValue('WINTER-2');

  page.once('dialog', (d) => {
    expect(d.message()).toBe('Delete program WINTER-2? This cannot be undone.');
    d.dismiss();
  });
  await items(page).nth(1).getByRole('button', { name: 'Remove' }).click();
  await expect(items(page)).toHaveCount(2);
  page.once('dialog', (d) => d.accept());
  await items(page).nth(1).getByRole('button', { name: 'Remove' }).click();
  await expect(items(page)).toHaveCount(1);
});

test('exports a backup and restores it', async ({ page }) => {
  await page.setInputFiles('#file', [schemaPath('WINTER'), schemaPath('AFRIKA')]);
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#btn-export-backup')]);
  expect(download.suggestedFilename()).toMatch(/^tc420-web-backup-\d{8}-\d{4}\.json$/);
  const file = await download.path();
  const backup = JSON.parse(readFileSync(file, 'utf8'));
  expect(backup.format).toBe('tc420-web-backup');
  expect(backup.programs.map((p) => p.name)).toEqual(['WINTER', 'AFRIKA']);

  for (let i = 0; i < 2; i++) {
    page.once('dialog', (d) => d.accept());
    await items(page).first().getByRole('button', { name: 'Remove' }).click();
  }
  await expect(page.locator('#modes')).toHaveText('No programs yet.');

  page.once('dialog', (d) => {
    expect(d.message()).toContain('with the 2 programs from the backup');
    d.accept();
  });
  await page.setInputFiles('#backup-file', file);
  await expect(page.locator('#last-T4')).toHaveText('Last result: 2 programs restored from the backup');
  await expect(items(page)).toHaveCount(2);
  await page.reload();
  await expect(items(page)).toHaveCount(2);
});

test('rejects a file that is not a backup', async ({ page }) => {
  await page.setInputFiles('#backup-file', {
    name: 'notes.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"a":1}'),
  });
  await expect(page.locator('#last-T4')).toHaveText('Last result: notes.json is not a TC420 Web backup');
});

test('marks the program on the controller and notices edits after sending', async ({ page }) => {
  await page.setInputFiles('#file', schemaPath('WINTER'));
  await page.click('#btn-download');
  await page.click('#send-go');
  await page.locator('#dlg-send').getByRole('button', { name: 'Done' }).click();
  await expect(page.locator('#dl-progress')).toHaveText('Sent: 1 program is on the controller');
  await expect(items(page).first().locator('.on-controller')).toHaveText('On controller');
  await expect(page.locator('#btn-backup-after')).toBeVisible();

  const level = page.locator('#editor-table tr').nth(2).locator('input[type=number]').first();
  await level.fill('42');
  await level.press('Enter');
  await expect(items(page).first().locator('.changed')).toHaveText('changed since it was sent');

  await page.reload();
  await expect(items(page).first().locator('.on-controller')).toHaveText('On controller');
  await expect(items(page).first().locator('.changed')).toBeVisible();
});

test('multiple programs setting shows slot numbers and reordering, and is remembered', async ({ page }) => {
  await page.setInputFiles('#file', [schemaPath('WINTER'), schemaPath('ZOMER')]);
  await expect(items(page).first().locator('.tid')).toHaveCount(0);
  await page.check('#setting-multiple');
  await expect(items(page).first().locator('.tid')).toHaveText('Program 1');
  await items(page).nth(1).getByRole('button', { name: 'Move up' }).click();
  await expect(items(page).first().locator('input.name')).toHaveValue('ZOMER');

  await page.reload();
  await expect(page.locator('#setting-multiple')).toBeChecked();
  await expect(items(page).first().locator('input.name')).toHaveValue('ZOMER');
  await expect(items(page).nth(1).locator('.tid')).toHaveText('Program 2');
});

test('warns when the browser cannot store anything', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'indexedDB', { get: () => undefined });
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new Error('blocked');
      },
    });
  });
  await page.goto('./?sim=1');
  await expect(page.locator('#lib-status')).toContainText('This browser cannot store data');
  await page.setInputFiles('#file', schemaPath('WINTER'));
  await expect(items(page)).toHaveCount(1);
});

test('the library is shown in Dutch and German too', async ({ page }) => {
  await page.setInputFiles('#file', schemaPath('WINTER'));
  await page.selectOption('#lang', 'nl');
  await expect(page.locator('[data-test="T4"] h2')).toHaveText("Mijn programma's");
  await expect(page.locator('#lib-status')).toHaveText('Automatisch opgeslagen in deze browser.');
  await expect(items(page).first().getByRole('button', { name: 'Dupliceren' })).toBeVisible();
  await page.selectOption('#lang', 'de');
  await expect(page.locator('#btn-export-backup')).toHaveText('Sicherung erstellen');
  await expect(items(page)).toHaveCount(1);
});
