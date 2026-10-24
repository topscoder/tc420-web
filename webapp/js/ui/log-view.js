// Shows the logbook in the page.
import { $, el } from './dom.js';

function renderEntry(e) {
  const row = el('div', { class: `log-row k-${e.kind}` });
  const d = new Date(e.t);
  const ts = `${d.toLocaleDateString('nl-NL')} ${d.toLocaleTimeString('nl-NL', { hour12: false })}.${String(d.getMilliseconds()).padStart(3, '0')}`;
  row.append(
    el('span', { class: 'log-time' }, ts),
    el('span', { class: 'log-kind' }, e.kind.toUpperCase()),
    el('span', { class: 'log-test' }, e.test || ''),
    el('span', { class: 'log-text' }, e.text),
  );
  $('log').append(row);
}

function updateCount(logbook) {
  $('log-count').textContent =
    `${logbook.entries.length} regels` +
    (logbook.storageOk
      ? ' · bewaard in de browser'
      : ' · LET OP: opslaan in de browser lukt niet, sla het log tussendoor op');
}

export function mountLogView(logbook) {
  const box = $('log');
  const render = () => {
    box.innerHTML = '';
    logbook.entries.forEach(renderEntry);
    box.scrollTop = box.scrollHeight;
    updateCount(logbook);
  };
  logbook.onAdd((e) => {
    renderEntry(e);
    box.scrollTop = box.scrollHeight;
    updateCount(logbook);
  });
  render();
  return { render };
}
