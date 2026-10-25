// End-to-end tests for the visual program editor (#3).
import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const schemaPath = (name) => fileURLToPath(new URL(`../../schemas/${name}.tmf`, import.meta.url));
const rows = (page) => page.locator('#editor-table tr[data-minute]');
const row = (page, hhmm) => page.locator(`#editor-table tr[data-minute="${toMin(hhmm)}"]`);
const toMin = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));
const timeValues = (page) =>
  rows(page)
    .locator('input[type=time]')
    .evaluateAll((els) => els.map((e) => e.value));

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (err) => {
    throw err;
  });
  await page.goto('./?sim=1');
});

async function fromTemplate(page, id) {
  await page.selectOption('#template-select', id);
  await page.click('#btn-add-template');
}

// Client coordinates of a time/level on the chart (viewBox 760 × 260, plot 44..744 × 12..214).
async function chartPoint(page, minute, level) {
  await page.locator('#editor-chart svg').scrollIntoViewIfNeeded();
  const box = await page.locator('#editor-chart svg').boundingBox();
  const scale = box.width / 760;
  return { x: box.x + (44 + (minute / 1440) * 700) * scale, y: box.y + (214 - level * 2.02) * scale };
}

async function setTime(page, from, to) {
  // fill() on a time input already fires the change event.
  await row(page, from).locator('input[type=time]').fill(to);
}

async function setLevel(page, hhmm, level) {
  const input = row(page, hhmm).locator('input[type=number]');
  await input.fill(String(level));
  await input.press('Tab');
}

test('builds the WINTER program from scratch and exports exactly the PLed-style file', async ({ page }) => {
  const started = Date.now();
  await page.click('#btn-new-mode');
  await expect(page.locator('#link-channels')).toBeChecked();
  const name = page.locator('#modes .mode-item input.name');
  await name.fill('winter');
  await name.press('Enter');
  await expect(name).toHaveValue('WINTER');

  // Adjust the 5 default steps (00:00, 08:00, 08:30, 20:00, 20:30), then add four more.
  await setLevel(page, '00:00', 10);
  await setTime(page, '08:00', '07:00');
  await setLevel(page, '07:00', 10);
  await setTime(page, '08:30', '07:30');
  await setLevel(page, '07:30', 70);
  await setLevel(page, '20:00', 70);
  await setLevel(page, '20:30', 10);
  for (const [time, level] of [
    ['11:00', 70],
    ['11:30', 100],
    ['15:00', 100],
    ['15:30', 70],
  ]) {
    const before = await timeValues(page);
    await page.click('#btn-add-step');
    await expect(rows(page)).toHaveCount(before.length + 1);
    const added = (await timeValues(page)).find((v) => !before.includes(v));
    await setTime(page, added, time);
    await setLevel(page, time, level);
  }
  await expect(rows(page)).toHaveCount(9);
  expect(await timeValues(page)).toEqual([
    '00:00',
    '07:00',
    '07:30',
    '11:00',
    '11:30',
    '15:00',
    '15:30',
    '20:00',
    '20:30',
  ]);

  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#btn-export-tmf')]);
  expect(readFileSync(await download.path())).toEqual(readFileSync(schemaPath('WINTER')));
  expect(Date.now() - started).toBeLessThan(120_000);
});

test('dragging a point changes time and level; undo and redo restore it', async ({ page }) => {
  await fromTemplate(page, 'winter');
  await expect(page.locator('#modes .mode-item input.name')).toHaveValue('WINTER');
  const from = await chartPoint(page, 450, 70); // 07:30, 70 %
  const to = await chartPoint(page, 480, 40); // 08:00, 40 %
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
  await expect(row(page, '08:00')).toHaveCount(1);
  await expect(row(page, '07:30')).toHaveCount(0);
  await expect(row(page, '08:00').locator('input[type=number]')).toHaveValue('40');
  await expect(page.locator('#btn-undo')).toBeEnabled();

  await page.click('#btn-undo');
  await expect(row(page, '07:30').locator('input[type=number]')).toHaveValue('70');
  await expect(row(page, '08:00')).toHaveCount(0);
  await page.click('#btn-redo');
  await expect(row(page, '08:00').locator('input[type=number]')).toHaveValue('40');

  await page.reload();
  await expect(row(page, '08:00').locator('input[type=number]')).toHaveValue('40');
});

test('double-clicking the chart adds a step on the curve', async ({ page }) => {
  await fromTemplate(page, 'winter');
  const at = await chartPoint(page, 600, 50); // 10:00
  await page.mouse.dblclick(at.x, at.y);
  await expect(rows(page)).toHaveCount(10);
  await expect(row(page, '10:00').locator('input[type=number]')).toHaveValue('70');
});

test('keyboard: arrows move a point, Delete removes it, Ctrl+Z undoes', async ({ page }) => {
  await fromTemplate(page, 'winter');
  const point = page.locator('#editor-chart circle[data-minute="420"]'); // 07:00
  await point.focus();
  await page.keyboard.press('ArrowRight');
  await expect(row(page, '07:05')).toHaveCount(1);
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Shift+ArrowUp');
  await expect(row(page, '07:05').locator('input[type=number]')).toHaveValue('21');
  await expect(page.locator('#editor-chart circle[data-minute="425"]')).toBeFocused();
  await page.keyboard.press('Delete');
  await expect(rows(page)).toHaveCount(8);
  await page.keyboard.press('ControlOrMeta+z');
  await expect(rows(page)).toHaveCount(9);
});

test('refuses two steps at the same time and keeps at least two steps', async ({ page }) => {
  await fromTemplate(page, 'daynight');
  await setTime(page, '08:00', '08:30');
  await expect(page.locator('#editor-message')).toHaveText('There is already a step at 08:30.');
  await expect(row(page, '08:00').locator('input[type=time]')).toHaveValue('08:00');
  while ((await rows(page).count()) > 2) await rows(page).first().getByRole('button', { name: 'Delete step' }).click();
  await expect(rows(page).first().getByRole('button', { name: 'Delete step' })).toBeDisabled();
});

test('fade/instant toggle per step', async ({ page }) => {
  await fromTemplate(page, 'daynight');
  const toggle = row(page, '08:30').getByRole('button', { name: 'Fade' });
  await toggle.click();
  const instant = row(page, '08:30').getByRole('button', { name: 'Instant' });
  await expect(instant).toHaveAttribute('aria-pressed', 'true');
});

test('separate channels, linking them again, and channel names', async ({ page }) => {
  await fromTemplate(page, 'winter');
  await page.uncheck('#link-channels');
  await expect(page.locator('#channel-picker .channel-btn')).toHaveCount(5);
  await expect(page.locator('#editor-table th')).toHaveText(['#', 'Time', 'CH1', 'CH2', 'CH3', 'CH4', 'CH5', '']);
  const ch2 = row(page, '07:30').locator('input[type=number]').nth(1);
  await ch2.fill('5');
  await ch2.press('Tab');
  await expect(ch2).toHaveValue('5');

  await page.locator('#editor details summary').click();
  const name1 = page.getByLabel('Name of channel 1');
  await name1.fill('White');
  await name1.press('Tab');
  await expect(page.locator('#editor-table th').nth(2)).toHaveText('White');

  page.once('dialog', (d) => {
    expect(d.message()).toContain('levels of White');
    d.accept();
  });
  await page.check('#link-channels');
  await expect(page.locator('#editor-table th')).toHaveText(['#', 'Time', 'Level (all channels)', 'Change', '']);
  await page.uncheck('#link-channels');
  await expect(row(page, '07:30').locator('input[type=number]').nth(1)).toHaveValue('70');

  await page.reload();
  await expect(page.locator('#editor-table th').nth(2)).toHaveText('White');
});

test('templates include the PLed examples with separate channels', async ({ page }) => {
  const labels = await page.locator('#template-select option').allTextContents();
  expect(labels).toContain('AFRIKA (PLed example)');
  await fromTemplate(page, 'afrika');
  await expect(page.locator('#modes .mode-item input.name')).toHaveValue('AFRIKA');
  await expect(page.locator('#last-T4')).toHaveText('Last result: Program AFRIKA created from a template');
  await expect(rows(page)).toHaveCount(21);
  await expect(page.locator('#link-channels')).not.toBeChecked();
});

test('the editor is translated', async ({ page }) => {
  await fromTemplate(page, 'winter');
  await page.selectOption('#lang', 'de');
  await expect(page.locator('#btn-undo')).toHaveText('Rückgängig');
  await expect(page.locator('#editor-table th').nth(2)).toHaveText('Helligkeit (alle Kanäle)');
  await expect(rows(page).first().getByRole('button', { name: 'Überblenden' })).toBeVisible();
  await page.selectOption('#lang', 'nl');
  await expect(page.locator('#template-select option').nth(1)).toHaveText('Eenvoudig dag en nacht');
});
