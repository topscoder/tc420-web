// End-to-end tests for the guided device workflow (#5): connect, set clock, send, clear, errors.
import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const schemaPath = (name) => fileURLToPath(new URL(`../../schemas/${name}.tmf`, import.meta.url));
const items = (page) => page.locator('#modes .mode-item');
const dialog = (page) => page.locator('#dlg-send');
const sentCommands = (page) =>
  page.locator('#log .k-tx').evaluateAll((rows) => rows.map((r) => r.textContent.match(/0x([0-9a-f]{2})/i)[1]));

async function open(page, query = '') {
  page.on('pageerror', (err) => {
    throw err;
  });
  await page.goto(`./?sim=1${query}`);
}

async function importBoth(page) {
  await page.setInputFiles('#file', [schemaPath('WINTER'), schemaPath('ZOMER')]);
  await expect(items(page)).toHaveCount(2);
}

test('sends only the selected program: clock, clear, write, end', async ({ page }) => {
  await open(page);
  await importBoth(page);
  await expect(page.locator('#btn-download')).toHaveText('Send ZOMER to TC420');
  await page.click('#btn-download'); // connects first, without the clock toast
  await expect(page.locator('#toast')).toBeHidden();
  await expect(page.locator('#dlg-send-title')).toHaveText('Send ZOMER to the TC420?');
  await expect(dialog(page)).toContainText(
    'The controller will run ZOMER (9 steps). Everything else on the controller is removed.',
  );
  await expect(page.locator('#send-clock')).toBeChecked();
  await page.click('#send-go');
  await expect(page.locator('#dlg-send-title')).toHaveText('✓ ZOMER is running on the controller');
  await expect(dialog(page)).toContainText('The clock was set to');
  await expect(dialog(page)).toContainText('Nothing else is on the controller.');

  expect(await sentCommands(page)).toEqual(['11', '03', '12', ...Array(9).fill('13'), '01', '02']);
  await expect(page.locator('#log .k-tx', { hasText: '0x12 mode header' })).toContainText(
    '12 00 07 00 09 5A 4F 4D 45 52',
  );
  await expect(items(page).nth(1).locator('.on-controller')).toHaveText('On controller');
  await expect(items(page).nth(0).locator('.on-controller')).toHaveCount(0);

  await page.locator('#dlg-send').getByRole('button', { name: 'Done' }).click();
  await expect(dialog(page)).toBeHidden();
  await expect(page.locator('#btn-backup-after')).toBeVisible();
});

test('the clock can be left out', async ({ page }) => {
  await open(page);
  await importBoth(page);
  await page.click('#btn-download');
  await page.uncheck('#send-clock');
  await page.click('#send-go');
  await expect(page.locator('#dlg-send-title')).toHaveText('✓ ZOMER is running on the controller');
  await expect(dialog(page)).not.toContainText('The clock was set');
  expect((await sentCommands(page))[0]).toBe('03');
});

test('multiple programs mode sends all programs in list order', async ({ page }) => {
  await open(page);
  await importBoth(page);
  await page.check('#setting-multiple');
  await expect(page.locator('#btn-download')).toHaveText('Send 2 programs to TC420');
  await page.click('#btn-download');
  await expect(page.locator('#dlg-send-title')).toHaveText('Send 2 programs to the TC420?');
  await expect(dialog(page).locator('li')).toHaveText(['Program 1 ← WINTER (9 steps)', 'Program 2 ← ZOMER (9 steps)']);
  await page.click('#send-go');
  await expect(page.locator('#dlg-send-title')).toHaveText('✓ 2 programs are on the controller');
  await page.locator('#dlg-send').getByRole('button', { name: 'Done' }).click();
  await expect(items(page).nth(0).locator('.on-controller')).toHaveText('On controller (program 1)');
  await expect(items(page).nth(1).locator('.on-controller')).toHaveText('On controller (program 2)');
  const headers = await page
    .locator('#log .k-tx', { hasText: '0x12 mode header' })
    .evaluateAll((rows) => rows.map((r) => r.textContent.match(/00 55 AA 12 00 \w\w (\w\w)/)[1]));
  expect(headers).toEqual(['00', '01']);
});

test('cancelling sends nothing', async ({ page }) => {
  await open(page);
  await importBoth(page);
  await page.click('#btn-download');
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toBeHidden();
  expect(await sentCommands(page)).toEqual([]);
});

test('no reply to the first packet: nothing changed on the controller', async ({ page }) => {
  await open(page, '&simSilent=11');
  await importBoth(page);
  await page.click('#btn-download');
  await page.click('#send-go');
  await expect(page.locator('#dlg-send-title')).toHaveText('The controller did not respond', { timeout: 10_000 });
  await expect(dialog(page)).toContainText('Nothing was changed on the controller.');
  expect(await sentCommands(page)).toEqual(['11']);
  await expect(dialog(page).getByRole('button', { name: 'Try again' })).toBeVisible();
});

test('no reply while writing: the controller may be empty and the badge goes away', async ({ page }) => {
  await open(page, '&simSilent=13');
  await importBoth(page);
  await page.click('#btn-download');
  await page.click('#send-go');
  await expect(page.locator('#dlg-send-title')).toHaveText('The controller did not respond', { timeout: 10_000 });
  await expect(dialog(page)).toContainText('The controller may now be empty or contain an incomplete program.');
  await page.locator('#dlg-send').getByRole('button', { name: 'Show log' }).click();
  await expect(dialog(page)).toBeHidden();
  await expect(page.locator('#log .k-error').last()).toContainText(
    'sending failed: noReply during write (ZOMER step 1)',
  );
  await expect(page.locator('#modes .on-controller')).toHaveCount(0);
  await expect(page.locator('#dl-progress')).toHaveText('Sending failed (see the log)');
});

test('an error reply is shown as refused', async ({ page }) => {
  await open(page, '&simFail=12');
  await importBoth(page);
  await page.click('#btn-download');
  await page.click('#send-go');
  await expect(page.locator('#dlg-send-title')).toHaveText('The controller refused the data');
});

test('pulling the cable while sending offers to reconnect', async ({ page }) => {
  await open(page, '&simUnplug=5');
  await importBoth(page);
  await page.click('#btn-download');
  await page.click('#send-go');
  await expect(page.locator('#dlg-send-title')).toHaveText('Sending was interrupted');
  await expect(dialog(page)).toContainText('The controller may now be empty');
  await expect(page.locator('#btn-connect')).toHaveText('Connect TC420');
  await dialog(page).getByRole('button', { name: 'Reconnect and retry' }).click();
  await expect(page.locator('#btn-connect')).toHaveText('● TC420 connected ▾');
  await expect(page.locator('#dlg-send-title')).toHaveText('Send ZOMER to the TC420?');
});

for (const [name, text] of [
  ['NotAllowedError', 'Your computer blocked access to the controller.'],
  ['InvalidStateError', 'The controller is in use by another tab or app.'],
]) {
  test(`explains a connection error (${name})`, async ({ page }) => {
    await open(page, `&simOpen=${name}`);
    await page.click('#btn-connect');
    await expect(page.locator('#toast-text')).toContainText(text);
    await expect(page.locator('#last-T1')).toContainText(text);
    await expect(page.locator('#btn-connect')).toHaveText('Connect TC420');
  });
}

test('device menu: set clock, clear controller, disconnect', async ({ page }) => {
  await open(page);
  await importBoth(page);
  await page.click('#btn-connect');
  await expect(page.locator('#toast-text')).toContainText("Set it to this computer's time");
  await page.locator('#toast').getByRole('button', { name: 'Set clock' }).click();
  await expect(page.locator('#toast-text')).toContainText('Clock set to');

  await page.click('#btn-download');
  await page.click('#send-go');
  await page.locator('#dlg-send').getByRole('button', { name: 'Done' }).click();
  await expect(page.locator('#modes .on-controller')).toHaveCount(1);

  await page.click('#btn-connect');
  await expect(page.locator('#device-menu')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#device-menu')).toBeHidden();

  await page.click('#btn-connect');
  await page.getByRole('menuitem', { name: 'Clear controller…' }).click();
  await expect(page.locator('#dlg-clear')).toBeVisible();
  await page.locator('#dlg-clear').getByRole('button', { name: 'Remove all programs' }).click();
  await expect(page.locator('#toast-text')).toHaveText('All programs were removed from the controller.');
  await expect(page.locator('#modes .on-controller')).toHaveCount(0);

  await page.click('#btn-connect');
  await page.getByRole('menuitem', { name: 'Disconnect' }).click();
  await expect(page.locator('#btn-connect')).toHaveText('Connect TC420');
});

test('real browser: explains the device chooser once, then reports no selection', async ({ page }) => {
  await page.addInitScript(() => {
    window.requested = 0;
    Object.defineProperty(navigator, 'hid', {
      value: {
        requestDevice: async () => {
          window.requested++;
          return [];
        },
        getDevices: async () => [],
        addEventListener() {},
      },
    });
  });
  await page.goto('./');
  await page.click('#btn-connect');
  await expect(page.locator('#dlg-connect')).toBeVisible();
  await expect(page.locator('#dlg-connect')).toContainText('Choose Time Controller');
  await page.locator('#dlg-connect').getByRole('button', { name: 'Continue' }).click();
  await expect(page.locator('#toast-text')).toHaveText('No controller selected.');
  expect(await page.evaluate(() => window.requested)).toBe(1);

  await page.click('#btn-connect');
  await expect(page.locator('#dlg-connect')).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.requested)).toBe(2);
});

test('the send dialog is translated', async ({ page }) => {
  await open(page);
  await importBoth(page);
  await page.selectOption('#lang', 'de');
  await expect(page.locator('#btn-download')).toHaveText('ZOMER an TC420 senden');
  await page.click('#btn-download');
  await expect(page.locator('#dlg-send-title')).toHaveText('ZOMER an den TC420 senden?');
  await page.click('#send-go');
  await expect(page.locator('#dlg-send-title')).toHaveText('✓ ZOMER läuft auf dem Controller');
});
