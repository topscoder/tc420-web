// Renders the PNG app icons from webapp/icons/*.svg with Playwright's Chromium.
// Run after changing an SVG: node scripts/make-icons.mjs
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('../webapp/icons/', import.meta.url));
const ICONS = [
  ['icon.svg', 'icon-192.png', 192],
  ['icon.svg', 'icon-512.png', 512],
  ['icon-maskable.svg', 'icon-maskable-512.png', 512],
  ['icon-maskable.svg', 'apple-touch-icon.png', 180],
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const [svg, png, size] of ICONS) {
  await page.setViewportSize({ width: size, height: size });
  const markup = readFileSync(dir + svg, 'utf8').replace('<svg ', `<svg width="${size}" height="${size}" `);
  await page.setContent(`<style>html,body{margin:0;background:transparent}</style>${markup}`);
  await page.locator('svg').screenshot({ path: dir + png, omitBackground: true });
  console.log(`${png} (${size}×${size})`);
}
await browser.close();
