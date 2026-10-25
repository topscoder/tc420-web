// End-to-end tests for browser support and onboarding (#9): the welcome on a
// first visit, browsers without USB access and the Linux setup.
import { test, expect } from '@playwright/test';

const UA = {
  safari:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  ipad: 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  linux: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
};

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (err) => {
    throw err;
  });
});

// Pretends to be a browser without WebHID.
const withoutHid = (page) =>
  page.addInitScript(() => {
    delete Navigator.prototype.hid;
  });

test('first visit: the welcome offers three ways to start', async ({ page }) => {
  await page.goto('./?sim=1');
  const welcome = page.locator('#modes .welcome');
  await expect(welcome).toContainText('Create a lighting schedule for your TC420');
  await expect(welcome.locator('.choice')).toHaveCount(3);
  await page.click('#welcome-empty');
  await expect(page.locator('#modes .mode-item')).toHaveCount(1);
  await expect(page.locator('#modes .welcome')).toHaveCount(0);
});

test('the welcome can import PLed files', async ({ page }) => {
  await page.goto('./?sim=1');
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('#welcome-import')]);
  expect(chooser.isMultiple()).toBe(true);
});

test.describe('Safari on a Mac', () => {
  test.use({ userAgent: UA.safari });
  test('explains which browsers work; editing still works', async ({ page }) => {
    await withoutHid(page);
    await page.goto('./');
    await expect(page.locator('#unsupported-text')).toHaveText(
      'Safari cannot connect to USB devices. You can make, import and export programs here. To send them to the controller, open TC420 Web in Chrome or Edge.',
    );
    await expect(page.locator('#btn-connect')).toHaveText('⚠ USB not available');
    await page.click('#welcome-empty');
    await expect(page.locator('#btn-download')).toBeDisabled();
    await expect(page.locator('#dl-progress')).toHaveText('Sending needs Chrome or Edge on a computer.');

    await page.click('#btn-connect');
    await expect(page.locator('#dlg-support')).toBeVisible();
    await expect(page.locator('#dlg-support')).toContainText('Does not work: Safari, Firefox');
    await page.click('#dlg-support-close');
    await page.click('#btn-support-more');
    await expect(page.locator('#dlg-support')).toBeVisible();
  });
});

test.describe('iPad', () => {
  test.use({ userAgent: UA.ipad, hasTouch: true });
  test('says phones and tablets cannot connect', async ({ page }) => {
    await withoutHid(page);
    await page.goto('./');
    await expect(page.locator('#unsupported-text')).toContainText('Phones and tablets cannot connect to the TC420.');
    await page.locator('#advanced > summary').click();
    await expect(page.locator('#platform-info')).toHaveText('Safari · iPhone or iPad · cannot connect to the TC420');
  });
});

test.describe('Linux', () => {
  test.use({ userAgent: UA.linux });
  test('a blocked device offers the one-time setup', async ({ page }) => {
    await page.goto('./?sim=1&simOpen=NotAllowedError');
    await page.click('#btn-connect');
    await expect(page.locator('#toast-text')).toHaveText(
      'Linux blocked access to the controller. This needs a one-time setup.',
    );
    await page.locator('#toast').getByRole('button', { name: 'Linux setup' }).click();
    await expect(page.locator('#dlg-linux')).toBeVisible();
    await expect(page.locator('#linux-commands')).toContainText('ATTRS{idVendor}=="0888", ATTRS{idProduct}=="4000"');
    await expect(page.locator('#linux-commands')).toContainText('sudo udevadm trigger');
  });
});

test('a supported browser shows no banner and says so under Advanced', async ({ page }) => {
  await page.goto('./?sim=1');
  await expect(page.locator('#unsupported')).toBeHidden();
  await page.locator('#advanced > summary').click();
  await expect(page.locator('#platform-info')).toContainText('can connect to the TC420');
});

test('the support texts are translated', async ({ page }) => {
  await withoutHid(page);
  await page.goto('./');
  await page.selectOption('#lang', 'de');
  await expect(page.locator('#btn-connect')).toHaveText('⚠ USB nicht verfügbar');
  await expect(page.locator('#btn-support-more')).toHaveText('Welche Browser funktionieren?');
  await page.selectOption('#lang', 'nl');
  await expect(page.locator('#modes .welcome h3')).toHaveText('Maak een lichtschema voor je TC420');
});
