import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { I18n, MESSAGES, LANGUAGES, detectLanguage, localeFor } from '../../webapp/js/i18n.js';
import { TEMPLATES } from '../../webapp/js/templates.js';

const WEBAPP = fileURLToPath(new URL('../../webapp/', import.meta.url));
const en = MESSAGES.en;

const placeholders = (v) =>
  [...new Set((typeof v === 'object' ? Object.values(v).join(' ') : v).match(/\{\w+\}/g) || [])].sort();

for (const lang of Object.keys(LANGUAGES)) {
  test(`${lang}: has exactly the English keys with the same placeholders`, () => {
    const msgs = MESSAGES[lang];
    assert.deepEqual(Object.keys(msgs).sort(), Object.keys(en).sort());
    for (const [key, value] of Object.entries(en)) {
      assert.deepEqual(placeholders(msgs[key]), placeholders(value), `${lang}:${key}`);
      assert.equal(typeof msgs[key], typeof value, `${lang}:${key} plural shape`);
      if (typeof value === 'object') assert.ok(msgs[key].one && msgs[key].other, `${lang}:${key} needs one/other`);
      assert.ok(String(typeof value === 'object' ? msgs[key].other : msgs[key]).trim(), `${lang}:${key} is empty`);
    }
  });
}

function filesIn(dir, ext) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return name === 'locales' ? [] : filesIn(p, ext);
    return p.endsWith(ext) ? [p] : [];
  });
}

test('every key used in index.html and the UI code exists', () => {
  const html = readFileSync(join(WEBAPP, 'index.html'), 'utf8');
  const keys = new Set();
  for (const m of html.matchAll(/data-i18n(?:-html)?="([^"]+)"/g)) keys.add(m[1]);
  for (const m of html.matchAll(/data-i18n-attr="([^"]+)"/g)) {
    m[1].split(';').forEach((pair) => keys.add(pair.split(':')[1].trim()));
  }
  const prefixes =
    '(?:app|header|banner|main|settings|adv|support|linux|welcome|pwa|preview|about|last|obs|t[1-7]|schedule|log|editor|templates|device|send|common)';
  const literal = new RegExp(`'(${prefixes}\\.[\\w.]+)'`, 'g');
  for (const file of filesIn(join(WEBAPP, 'js'), '.js')) {
    for (const m of readFileSync(file, 'utf8').matchAll(literal)) keys.add(m[1]);
  }
  // Built dynamically from codes in schedule.js.
  ['tooFew', 'tooMany', 'invalidTime', 'sameTime', 'outOfOrder', 'deviceType', 'trailingBytes'].forEach((c) =>
    keys.add(`schedule.warn.${c}`),
  );
  ['tooShort', 'channels'].forEach((c) => keys.add(`schedule.error.${c}`));
  Object.keys(TEMPLATES).forEach((id) => keys.add(`templates.${id}`));
  ['notJson', 'notBackup', 'newerVersion', 'empty'].forEach((c) => keys.add(`t4.backupError.${c}`));
  ['clock', 'clear', 'write', 'end'].forEach((p) => keys.add(`send.phase.${p}`));
  ['disconnected', 'noReply', 'rejected', 'invalid'].forEach((k) => {
    keys.add(`send.error.${k}`);
    keys.add(`send.errorTitle.${k}`);
  });
  ['noDevice', 'denied', 'busy', 'unknown'].forEach((k) => keys.add(`device.error.${k}`));
  ['mobile', 'browser', 'insecure'].forEach((r) => keys.add(`banner.${r}`));
  ['online', 'ready', 'unsupported', 'unavailable'].forEach((s) => keys.add(`pwa.status.${s}`));
  ['mac', 'windows', 'linux', 'chromeos', 'ios', 'android', 'other'].forEach((p) => keys.add(`support.platform.${p}`));
  const missing = [...keys].filter((k) => !(k in en));
  assert.deepEqual(missing, []);
  assert.ok(keys.size > 100, `only ${keys.size} keys found; the scan is probably broken`);
});

test('index.html has no hard-coded text outside translated elements', () => {
  const html = readFileSync(join(WEBAPP, 'index.html'), 'utf8')
    .replace(/<head>[\s\S]*?<\/head>/, '')
    .replace(/<script[\s\S]*?<\/script>/g, '');
  const allowed = new Set(['TC420 Web']);
  const texts = [...html.matchAll(/>([^<>]+)</g)].map((m) => m[1].trim()).filter(Boolean);
  assert.deepEqual(
    texts.filter((t) => !allowed.has(t)),
    [],
  );
});

test('detects the language from the browser preference list', () => {
  assert.equal(detectLanguage(['de-AT', 'en']), 'de');
  assert.equal(detectLanguage(['fr-FR', 'nl-BE']), 'nl');
  assert.equal(detectLanguage(['fr-FR', 'es']), 'en');
  assert.equal(detectLanguage([]), 'en');
});

test('picks a locale for date formatting', () => {
  assert.equal(localeFor('nl', ['en-GB']), 'nl-NL');
  assert.equal(localeFor('de', []), 'de-DE');
  assert.equal(localeFor('en', ['nl-NL', 'en-GB']), 'en-GB');
  assert.equal(localeFor('en', ['nl-NL']), 'en-US');
});

test('interpolates parameters and chooses plural forms', () => {
  const i18n = new I18n({ lang: 'nl' });
  assert.equal(i18n.t('header.status.connected', { name: 'X' }), 'Verbonden: X');
  assert.equal(i18n.t('t4.steps', { count: 1 }), '1 stap');
  assert.equal(i18n.t('t4.steps', { count: 21 }), '21 stappen');
  i18n.setLanguage('de');
  assert.equal(i18n.t('t4.steps', { count: 1 }), '1 Schritt');
});

test('falls back to English and reports missing texts once', () => {
  const warnings = [];
  const i18n = new I18n({
    lang: 'nl',
    messages: { en: { a: 'Apple', b: 'Banana {n}' }, nl: { a: 'Appel' } },
    warn: (w) => warnings.push(w),
  });
  assert.equal(i18n.t('a'), 'Appel');
  assert.equal(i18n.t('b', { n: 2 }), 'Banana 2');
  assert.equal(i18n.t('b', { n: 3 }), 'Banana 3');
  assert.equal(i18n.t('nope'), 'nope');
  assert.equal(warnings.length, 2);
});

test('notifies listeners on language change and ignores unknown languages', () => {
  const i18n = new I18n({ lang: 'en' });
  const seen = [];
  i18n.onChange((l) => seen.push(l));
  i18n.setLanguage('de');
  i18n.setLanguage('de');
  i18n.setLanguage('xx');
  assert.deepEqual(seen, ['de', 'en']);
  assert.equal(i18n.lang, 'en');
});

test('the UI never uses the browser dialogs alert(), confirm() or prompt()', () => {
  const found = filesIn(join(WEBAPP, 'js'), '.js').flatMap((file) =>
    readFileSync(file, 'utf8')
      .split('\n')
      .filter((line) => !line.trim().startsWith('//') && /(^|[^.\w])(alert|confirm|prompt)\(/.test(line))
      .map((line) => `${file}: ${line.trim()}`),
  );
  assert.deepEqual(found, []);
});
