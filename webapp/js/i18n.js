// Minimal offline i18n: flat message keys, {param} interpolation, plural forms
// via Intl.PluralRules, English fallback, language detection and DOM binding.
import en from './locales/en.js';
import nl from './locales/nl.js';
import de from './locales/de.js';

export const MESSAGES = { en, nl, de };
export const LANGUAGES = { en: 'English', nl: 'Nederlands', de: 'Deutsch' };
export const DEFAULT_LANGUAGE = 'en';
export const LANG_KEY = 'tc420-lang';

// First supported language in the browser's preference list, else English.
export function detectLanguage(preferred = []) {
  for (const tag of preferred) {
    const base = String(tag).toLowerCase().split('-')[0];
    if (base in LANGUAGES) return base;
  }
  return DEFAULT_LANGUAGE;
}

// BCP 47 tag for Intl formatting: the user's own English variant if they have
// one (en-GB, en-US …), fixed regional tags for Dutch and German.
export function localeFor(lang, preferred = []) {
  if (lang === 'nl') return 'nl-NL';
  if (lang === 'de') return 'de-DE';
  return preferred.find((t) => /^en(-|$)/i.test(t)) || 'en-US';
}

export class I18n {
  constructor({ lang = DEFAULT_LANGUAGE, messages = MESSAGES, preferred = [], warn = console.warn } = {}) {
    this.messages = messages;
    this.preferred = preferred;
    this.warn = warn;
    this.missing = new Set();
    this.listeners = new Set();
    this.lang = lang in messages ? lang : DEFAULT_LANGUAGE;
  }

  get locale() {
    return localeFor(this.lang, this.preferred);
  }

  setLanguage(lang) {
    const next = lang in this.messages ? lang : DEFAULT_LANGUAGE;
    if (next === this.lang) return;
    this.lang = next;
    this.listeners.forEach((fn) => fn(next));
  }

  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  lookup(key) {
    const own = this.messages[this.lang]?.[key];
    if (own !== undefined) return own;
    const fallback = this.messages[DEFAULT_LANGUAGE]?.[key];
    const id = `${this.lang}:${key}`;
    if (!this.missing.has(id)) {
      this.missing.add(id);
      this.warn(`i18n: missing ${fallback === undefined ? 'key' : `"${this.lang}" text for`} "${key}"`);
    }
    return fallback;
  }

  t(key, params = {}) {
    let msg = this.lookup(key);
    if (msg === undefined) return key;
    if (typeof msg === 'object') {
      const form = new Intl.PluralRules(this.locale).select(Number(params.count ?? 0));
      msg = msg[form] ?? msg.other;
    }
    return msg.replace(/\{(\w+)\}/g, (m, name) => (name in params ? String(params[name]) : m));
  }

  formatDateTime(date, options) {
    return new Intl.DateTimeFormat(this.locale, options).format(date);
  }
}

// Fills elements marked with data-i18n (text), data-i18n-html (trusted markup
// from our own locale files) and data-i18n-attr ("attr:key;attr:key").
export function applyTranslations(root, i18n) {
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = i18n.t(el.dataset.i18n);
  });
  root.querySelectorAll('[data-i18n-html]').forEach((el) => {
    el.innerHTML = i18n.t(el.dataset.i18nHtml);
  });
  root.querySelectorAll('[data-i18n-attr]').forEach((el) => {
    el.dataset.i18nAttr.split(';').forEach((pair) => {
      const [attr, key] = pair.split(':').map((s) => s.trim());
      if (attr && key) el.setAttribute(attr, i18n.t(key));
    });
  });
}
