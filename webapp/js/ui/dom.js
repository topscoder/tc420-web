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

export function setLast(test, ok, text) {
  const n = $(`last-${test}`);
  if (!n) return;
  n.className = `last ${ok ? 'ok' : 'bad'}`;
  n.textContent = `Laatste resultaat: ${text}`;
}
