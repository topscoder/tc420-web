// Small DOM helpers.
export const $ = (id) => document.getElementById(id);

export function el(tag, attrs = {}, text) {
  const e = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'class') e.className = v;
    else e.setAttribute(k, v);
  });
  if (text !== undefined) e.textContent = text;
  return e;
}

export function download(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = el('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// yyyymmdd-hhmm for file names.
export function stamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

// "Last result" lines per test. They are stored as message keys so they can be
// shown again in another language.
let i18n = null;
const results = new Map();

export function bindI18n(instance) {
  i18n = instance;
}

function renderResult(test) {
  const n = $(`last-${test}`);
  const r = results.get(test);
  if (!n || !r) return;
  n.className = `last ${r.ok ? 'ok' : 'bad'}`;
  n.textContent = i18n.t('last.result', { text: i18n.t(r.key, r.params) });
}

export function setLast(test, ok, key, params = {}) {
  results.set(test, { ok, key, params });
  renderResult(test);
}

export function refreshResults() {
  results.forEach((r, test) => renderResult(test));
}
