// Accessibility checks with axe-core (#10): WCAG 2.1 AA rules, light and dark.
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { fileURLToPath } from 'node:url';

const schemaPath = (name) => fileURLToPath(new URL(`../../schemas/${name}.tmf`, import.meta.url));

async function violations(page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  return violations.map(
    (v) =>
      `${v.id} (${v.impact}): ${v.nodes
        .map((n) => n.target.join(' '))
        .slice(0, 5)
        .join(' | ')}`,
  );
}

for (const colorScheme of ['light', 'dark']) {
  test.describe(`${colorScheme} theme`, () => {
    test.use({ colorScheme });

    test('first visit has no accessibility violations', async ({ page }) => {
      await page.goto('./?sim=1');
      await expect(page.locator('#modes .welcome')).toBeVisible();
      expect(await violations(page)).toEqual([]);
    });

    test('editor, settings and Advanced have no accessibility violations', async ({ page }) => {
      await page.goto('./?sim=1');
      await page.setInputFiles('#file', [schemaPath('WINTER'), schemaPath('AFRIKA')]);
      await page.locator('#settings > summary').click();
      await page.locator('#advanced > summary').click();
      await page.click('#btn-download'); // connects, then sends AFRIKA: badges and status appear
      await page.click('#send-go');
      await page.locator('#dlg-send').getByRole('button', { name: 'Done' }).click();
      await expect(page.locator('#modes .on-controller')).toHaveCount(1);
      await page.locator('#modes input.name').first().fill('WINTER2');
      await page.locator('#modes input.name').first().press('Tab');
      await page.locator('#editor-table input[type=number]').first().fill('20');
      await page.locator('#editor-table input[type=number]').first().press('Tab');
      expect(await violations(page)).toEqual([]);
    });

    test('dialogs have no accessibility violations', async ({ page }) => {
      await page.goto('./?sim=1');
      await page.setInputFiles('#file', schemaPath('WINTER'));
      await page.click('#btn-download');
      await expect(page.locator('#dlg-send')).toBeVisible();
      expect(await violations(page)).toEqual([]);
    });
  });
}

for (const width of [375, 768, 1024]) {
  test(`no horizontal scrolling at ${width} px wide`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('./?sim=1');
    await page.setInputFiles('#file', schemaPath('AFRIKA'));
    await page.locator('#advanced > summary').click();
    await expect(page.locator('#editor-table tr')).toHaveCount(22);
    const [scroll, inner] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
    expect(scroll).toBeLessThanOrEqual(inner);
  });
}
