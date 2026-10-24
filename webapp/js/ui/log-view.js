// Shows the logbook in the page. Entries stay in English; only labels and
// timestamps follow the UI language.
import { $, el } from './dom.js';

export function mountLogView(logbook, i18n) {
  const box = $('log');

  function renderEntry(e) {
    const row = el('div', { class: `log-row k-${e.kind}` });
    const d = new Date(e.t);
    const ts = `${i18n.formatDateTime(d, { dateStyle: 'short', timeStyle: 'medium' })}.${String(d.getMilliseconds()).padStart(3, '0')}`;
    row.append(
      el('span', { class: 'log-time' }, ts),
      el('span', { class: 'log-kind' }, e.kind.toUpperCase()),
      el('span', { class: 'log-test' }, e.test || ''),
      el('span', { class: 'log-text' }, e.text),
    );
    box.append(row);
  }

  function updateCount() {
    const count = i18n.t('log.count', { count: logbook.entries.length });
    $('log-count').textContent = i18n.t(logbook.storageOk ? 'log.stored' : 'log.notStored', { count });
  }

  function render() {
    box.innerHTML = '';
    logbook.entries.forEach(renderEntry);
    box.scrollTop = box.scrollHeight;
    updateCount();
  }

  logbook.onAdd((e) => {
    renderEntry(e);
    box.scrollTop = box.scrollHeight;
    updateCount();
  });
  render();
  return { render };
}
