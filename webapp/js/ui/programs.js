// T4: the user's program library (saved in the browser) with editor, .tmf import/export and backups.
import { MAX_BANKS, MAX_STEPS, NAME_LEN } from '../protocol.js';
import { parseTmf, serializeTmf, checkSteps, describeWarning, timeLabel, ScheduleError } from '../schedule.js';
import { sanitizeName, parseBackup, BackupError } from '../programs.js';
import { $, el, download, stamp, setLast } from './dom.js';
import { renderChart } from './chart.js';

const blankStep = (h, m, ch, jump) => ({
  hour: h,
  minute: m,
  ch: ch || [0, 0, 0, 0, 0],
  jump: jump || [false, false, false, false, false],
});

// What the user may type in a name field: capitals, digits, space and "-".
function liveName(value) {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 -]/g, '')
    .slice(0, NAME_LEN);
}

export function mountPrograms({ store, log, i18n, meta }) {
  const t = (key, params) => i18n.t(key, params);
  const warningText = (w) => t(`schedule.warn.${w.code}`, w);

  const chart = (steps) =>
    renderChart($('editor-chart'), $('editor-legend'), steps, { zoom: $('chart-zoom').checked, t });

  function add(name, steps, source) {
    const p = store.add({ name, steps, source });
    if (!p) {
      setLast('T4', false, 't4.full', { max: MAX_BANKS });
      log('error', `library full (max. ${MAX_BANKS} programs)`, 'T4');
    }
    return p;
  }

  // ---------- import / export ----------

  async function importFiles(files) {
    let count = 0;
    for (const f of files) {
      try {
        const schema = parseTmf(await f.arrayBuffer());
        const base = f.name.replace(/\.tmf$/i, '');
        const p = add(base, schema.steps, 'tmf');
        if (!p) break;
        count++;
        const warn = schema.warnings.length ? ` · warnings: ${schema.warnings.map(describeWarning).join('; ')}` : '';
        log(
          'info',
          `program imported: ${f.name} as ${p.name} · ${schema.deviceName} · ${schema.channels} channels · ${schema.steps.length} steps · third field ${schema.third}${warn}`,
          'T4',
        );
        if (p.name !== base) setLast('T4', true, 't4.importRenamed', { file: f.name, name: p.name });
        else setLast('T4', true, 't4.imported', { count });
      } catch (e) {
        log('error', `${f.name}: ${e.message}`, 'T4');
        const error = e instanceof ScheduleError ? t(`schedule.error.${e.code}`, e.params) : e.message;
        setLast('T4', false, 't4.loadFailed', { file: f.name, error });
      }
    }
    render();
  }

  function exportBackup() {
    download(`tc420-web-backup-${stamp()}.json`, store.toBackup(meta()), 'application/json');
    log('info', `backup exported (${store.programs.length} programs)`, 'T4');
  }

  async function restoreBackup(file) {
    try {
      const backup = parseBackup(await file.text());
      if (!confirm(t('t4.confirmRestore', { count: backup.programs.length }))) return;
      store.restore(backup);
      log('info', `backup restored from ${file.name}: ${store.programs.length} programs`, 'T4');
      setLast('T4', true, 't4.restored', { count: store.programs.length });
      render();
    } catch (e) {
      const code = e instanceof BackupError ? e.code : 'notBackup';
      log('error', `restoring ${file.name} failed: ${code}`, 'T4');
      setLast('T4', false, `t4.backupError.${code}`, { file: file.name });
    }
  }

  // ---------- list ----------

  function renderStatus() {
    const s = $('lib-status');
    const kind = store.backend?.kind;
    if (store.saveError) {
      s.className = 'note warn-text';
      s.textContent = t('t4.saveFailed');
    } else if (kind === 'memory') {
      s.className = 'note warn-text';
      s.textContent = t('t4.savedMemory');
    } else {
      s.className = 'note';
      s.textContent = t('t4.saved');
    }
  }

  function renderList() {
    const box = $('modes');
    box.innerHTML = '';
    if (!store.programs.length) {
      box.append(el('p', { class: 'note' }, t('t4.none')));
      return;
    }
    const multiple = store.settings.multiplePrograms;
    store.programs.forEach((p, i) => {
      const item = el('div', { class: `mode-item${p.id === store.selected?.id ? ' sel' : ''}`, 'data-id': p.id });
      if (multiple) item.append(el('span', { class: 'tid' }, t('t4.slot', { n: i + 1 })));
      const name = el('input', {
        type: 'text',
        class: 'name',
        maxlength: String(NAME_LEN),
        size: '9',
        value: p.name,
        title: t('t4.nameHint'),
        'aria-label': t('t4.nameHint'),
      });
      name.addEventListener('input', () => {
        const pos = name.selectionStart;
        name.value = liveName(name.value);
        name.setSelectionRange(pos, pos);
      });
      name.addEventListener('change', () => {
        store.rename(p.id, name.value);
        name.value = p.name;
        if (p.id === store.selected?.id) $('editor-title').textContent = t('t4.editTitle', { name: p.name });
        renderList();
      });
      item.append(name);
      const status = store.controllerStatus(p.id);
      if (status) {
        const label = multiple ? t('t4.onControllerSlot', { n: status.bank + 1 }) : t('t4.onController');
        item.append(el('span', { class: 'badge safe on-controller' }, label));
        if (status.changed) item.append(el('span', { class: 'badge danger changed' }, t('t4.changedSinceSent')));
      }
      const w = checkSteps(p.steps);
      const meta =
        t('t4.steps', { count: p.steps.length }) + (w.length ? ` · ${t('t4.warnings', { count: w.length })}` : '');
      item.append(el('span', { class: 'meta' }, meta));

      const button = (label, onClick, attrs = {}) => {
        const b = el('button', { class: 'small', ...attrs }, label);
        b.addEventListener('click', onClick);
        item.append(b);
        return b;
      };
      button(t('t4.edit'), () => {
        store.select(p.id);
        render();
      });
      button(t('t4.duplicate'), () => {
        if (store.duplicate(p.id)) render();
        else setLast('T4', false, 't4.full', { max: MAX_BANKS });
      });
      if (multiple) {
        button(
          '↑',
          () => {
            store.move(p.id, -1);
            renderList();
          },
          { 'aria-label': t('t4.moveUp'), title: t('t4.moveUp') },
        ).disabled = i === 0;
        button(
          '↓',
          () => {
            store.move(p.id, 1);
            renderList();
          },
          { 'aria-label': t('t4.moveDown'), title: t('t4.moveDown') },
        ).disabled = i === store.programs.length - 1;
      }
      button(t('t4.remove'), () => {
        if (!confirm(t('t4.confirmDelete', { name: p.name }))) return;
        store.remove(p.id);
        log('info', `program ${p.name} deleted`, 'T4');
        render();
      });
      box.append(item);
    });
  }

  // ---------- editor ----------

  function renderEditor() {
    const p = store.selected;
    $('editor').hidden = !p;
    if (!p) return;
    const edit = (mutate, { full = false } = {}) => {
      store.update(p.id, mutate);
      if (full) render();
      else {
        chart(p.steps);
        renderList();
      }
    };
    $('editor-title').textContent = t('t4.editTitle', { name: p.name });
    $('editor-warnings').innerHTML = '';
    checkSteps(p.steps).forEach((w) => $('editor-warnings').append(el('li', {}, warningText(w))));
    chart(p.steps);
    const table = $('editor-table');
    table.innerHTML = '';
    const head = el('tr');
    [t('t4.col.step'), t('t4.col.time'), 'CH1', 'CH2', 'CH3', 'CH4', 'CH5', t('t4.col.jump'), ''].forEach((h) =>
      head.append(el('th', {}, h)),
    );
    table.append(head);
    p.steps.forEach((s, i) => {
      const tr = el('tr');
      tr.append(el('td', {}, String(i + 1)));
      const time = el('input', { type: 'time', value: timeLabel(s.hour, s.minute) });
      time.addEventListener('change', () => {
        const [h, mi] = time.value.split(':').map(Number);
        if (h >= 0) edit((q) => Object.assign(q.steps[i], { hour: h, minute: mi }), { full: true });
      });
      const tdTime = el('td');
      tdTime.append(time);
      tr.append(tdTime);
      for (let c = 0; c < 5; c++) {
        const inp = el('input', {
          type: 'number',
          min: '0',
          max: '100',
          value: String(s.ch[c]),
          'aria-label': `CH${c + 1}`,
        });
        inp.addEventListener('change', () => {
          edit((q) => {
            q.steps[i].ch[c] = Math.max(0, Math.min(100, Number(inp.value) || 0));
          });
          inp.value = p.steps[i].ch[c];
        });
        const td = el('td');
        td.append(inp);
        tr.append(td);
      }
      const tdJ = el('td', { class: 'jumps' });
      for (let c = 0; c < 5; c++) {
        const lab = el('label');
        const cb = el('input', { type: 'checkbox' });
        cb.checked = !!s.jump[c];
        cb.addEventListener('change', () =>
          edit((q) => {
            q.steps[i].jump[c] = cb.checked;
          }),
        );
        lab.append(cb, document.createTextNode(String(c + 1)));
        tdJ.append(lab);
      }
      tr.append(tdJ);
      const del = el('button', { class: 'small', 'aria-label': t('t4.deleteStep'), title: t('t4.deleteStep') }, '×');
      del.addEventListener('click', () => edit((q) => q.steps.splice(i, 1), { full: true }));
      const tdDel = el('td');
      tdDel.append(del);
      tr.append(tdDel);
      table.append(tr);
    });
  }

  function render() {
    renderStatus();
    renderList();
    renderEditor();
  }

  // ---------- events ----------

  $('file').addEventListener('change', (e) => {
    importFiles(Array.from(e.target.files));
    e.target.value = '';
  });
  const drop = $('drop');
  drop.addEventListener('dragover', (e) => {
    e.preventDefault();
    drop.classList.add('over');
  });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    drop.classList.remove('over');
    importFiles(Array.from(e.dataTransfer.files));
  });

  $('btn-new-mode').addEventListener('click', () => {
    if (add(`PROG${store.programs.length + 1}`, [blankStep(0, 0), blankStep(12, 0, [50, 50, 50, 50, 0])], 'new')) {
      log('info', 'empty program created', 'T4');
      render();
    }
  });

  $('btn-test-mode').addEventListener('click', () => {
    const now = new Date();
    const start = now.getHours() * 60 + now.getMinutes() + 2;
    if (start + 6 >= 1439 || start < 2) {
      log('error', 'the test program cannot run around midnight; try after 00:05 or before 23:50', 'T4');
      return;
    }
    const hm = (m) => [Math.floor(m / 60), m % 60];
    const steps = [
      blankStep(0, 0),
      blankStep(...hm(start)),
      blankStep(...hm(start + 3), [100, 100, 0, 0, 0], [false, true, false, false, false]),
      blankStep(...hm(start + 6), [0, 0, 0, 0, 0], [false, true, false, false, false]),
      blankStep(23, 59),
    ];
    if (add('FADETEST', steps, 'test')) {
      log(
        'info',
        `test program FADETEST created: CH1 fades and CH2 jumps between ${timeLabel(...hm(start))} and ${timeLabel(...hm(start + 6))}`,
        'T4',
      );
      render();
    }
  });

  $('btn-export-backup').addEventListener('click', exportBackup);
  $('btn-restore-backup').addEventListener('click', () => $('backup-file').click());
  $('backup-file').addEventListener('change', (e) => {
    if (e.target.files[0]) restoreBackup(e.target.files[0]);
    e.target.value = '';
  });

  $('chart-zoom').addEventListener('change', () => {
    if (store.selected) chart(store.selected.steps);
  });

  $('btn-add-step').addEventListener('click', () => {
    const p = store.selected;
    if (!p) return;
    if (p.steps.length >= MAX_STEPS) {
      log('error', `at most ${MAX_STEPS} steps`, 'T4');
      return;
    }
    const last = p.steps[p.steps.length - 1];
    const next = last ? Math.min(1439, last.hour * 60 + last.minute + 30) : 0;
    store.update(p.id, (q) =>
      q.steps.push(blankStep(Math.floor(next / 60), next % 60, last ? last.ch.slice() : undefined)),
    );
    render();
  });

  $('btn-sort').addEventListener('click', () => {
    const p = store.selected;
    if (!p) return;
    store.update(p.id, (q) => q.steps.sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute)));
    render();
  });

  $('btn-export-tmf').addEventListener('click', () => {
    const p = store.selected;
    if (!p) return;
    download(
      `${p.name}.tmf`,
      serializeTmf({ deviceType: 0, channels: 5, third: 3, steps: p.steps }),
      'application/octet-stream',
    );
    log('info', `program ${p.name} saved as .tmf (${p.steps.length} steps)`, 'T4');
  });

  store.onChange(renderStatus);
  render();
  // refresh() redraws in the current language; programs live in the store.
  return { refresh: render, warningText, exportBackup, sanitizeName };
}
