// Offline use (#8) against the built site (scripts/build.mjs), served from a temporary folder.
import { test, expect } from '@playwright/test';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT = 8433;
const BASE = `http://127.0.0.1:${PORT}/`;
let dir;
let server;

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'tc420-site-'));
  execFileSync('node', ['scripts/build.mjs', dir]);
  server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1', '--directory', dir], {
    stdio: 'ignore',
  });
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(BASE)).ok) return;
    } catch {
      // not listening yet
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('test server did not start');
});

test.afterAll(() => {
  server?.kill();
  rmSync(dir, { recursive: true, force: true });
});

test('the built site lists every app file for offline use', () => {
  const text = readFileSync(join(dir, 'precache.js'), 'utf8');
  const { version, files } = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
  expect(version).toMatch(/^[0-9a-f]{12}$/);
  for (const f of ['./', 'index.html', 'manifest.webmanifest', 'css/app.css', 'js/main.js', 'js/locales/de.js']) {
    expect(files).toContain(f);
  }
  expect(files).toContain('icons/icon-512.png');
  expect(files).not.toContain('sw.js');
});

test('works offline after one visit, and offers a new version', async ({ page, context }) => {
  page.on('pageerror', (err) => {
    throw err;
  });
  await page.goto(`${BASE}?sim=1`);
  await page.locator('#settings > summary').click();
  await expect(page.locator('#offline-status')).toHaveText(
    'Ready: TC420 Web now also works without internet in this browser.',
  );

  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('#modes .welcome')).toBeVisible();
  await page.click('#welcome-empty');
  await page.click('#btn-download');
  await page.click('#send-go');
  await expect(page.locator('#dlg-send-title')).toHaveText('✓ PROG1 is running on the controller');
  await page.locator('#dlg-send').getByRole('button', { name: 'Done' }).click();

  // Publish a "new version" and come back online.
  await context.setOffline(false);
  appendFileSync(join(dir, 'css/app.css'), '\n/* v2 */\n');
  const precache = join(dir, 'precache.js');
  writeFileSync(precache, readFileSync(precache, 'utf8').replace(/"version": "[0-9a-f]+"/, '"version": "test2"'));
  await page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => r.update()));
  await expect(page.locator('#toast-text')).toHaveText('A new version of TC420 Web is ready.');
  await Promise.all([
    page.waitForEvent('load'), // the page reloads once the new version has taken over
    page.locator('#toast').getByRole('button', { name: 'Reload' }).click(),
  ]);
  await expect.poll(() => page.evaluate(() => caches.keys())).toEqual(['tc420-web-test2']);
  await expect(page.locator('#modes .mode-item')).toHaveCount(1); // programs survive the update
});

test('the manifest makes the app installable', async ({ request }) => {
  const manifest = await (await request.get(`${BASE}manifest.webmanifest`)).json();
  expect(manifest).toMatchObject({ name: 'TC420 Web', display: 'standalone', start_url: './', scope: './' });
  const sizes = manifest.icons.map((i) => `${i.sizes} ${i.purpose || 'any'}`);
  expect(sizes).toEqual(expect.arrayContaining(['192x192 any', '512x512 any', '512x512 maskable']));
  for (const icon of manifest.icons) expect((await request.get(BASE + icon.src)).ok()).toBe(true);
});
