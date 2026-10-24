// T4: load, create and edit schedules in the browser.
import { MAX_BANKS, MAX_STEPS, NAME_LEN } from '../protocol.js';
import { parseTmf, serializeTmf, checkSteps, describeWarning, timeLabel, ScheduleError } from '../schedule.js';
import { $, el, download, setLast } from './dom.js';
import { renderChart } from './chart.js';

const blankStep = (h, m, ch, jump) => ({
  hour: h,
  minute: m,
  ch: ch || [0, 0, 0, 0, 0],
  jump: jump || [false, false, false, false, false],
});

const newSchema = (steps) => ({ deviceType: 0, deviceName: 'TC420', channels: 5, third: 3, steps, warnings: [] });

export function nameFromFile(fname) {
  return fname
    .replace(/\.tmf$/i, '')
    .replace(/[^\x20-\x7e]/g, '?')
    .slice(0, NAME_LEN)
    .toUpperCase();
}

export function mountSchedules({ log, i18n }) {
  const t = (key, params) => i18n.t(key, params);
  const warningText = (w) => t(`schedule.warn.${w.code}`, w);
  const modes = []; // { name, schema }
  let selected = -1;

  const chart = (steps) =>
    renderChart($('editor-chart'), $('editor-legend'), steps, { zoom: $('chart-zoom').checked, t });

  function add(name, schema) {
    if (modes.length >= MAX_BANKS) {
      log('error', `at most ${MAX_BANKS} schedules`, 'T4');
      return;
    }
    modes.push({ name, schema });
    selected = modes.length - 1;
    render();
  }

  async function loadFiles(files) {
    for (const f of files) {
      try {
        const schema = parseTmf(await f.arrayBuffer());
        add(nameFromFile(f.name), schema);
        const warn = schema.warnings.length ? ` · warnings: ${schema.warnings.map(describeWarning).join('; ')}` : '';
        log(
          'info',
          `schedule loaded: ${f.name} · ${schema.deviceName} · ${schema.channels} channels · ${schema.steps.length} steps · third field ${schema.third}${warn}`,
          'T4',
        );
      } catch (e) {
        log('error', `${f.name}: ${e.message}`, 'T4');
        const error = e instanceof ScheduleError ? t(`schedule.error.${e.code}`, e.params) : e.message;
        setLast('T4', false, 't4.loadFailed', { file: f.name, error });
      }
    }
  }

  function renderModes() {
    const box = $('modes');
    box.innerHTML = '';
    if (!modes.length) {
      box.append(el('p', { class: 'note' }, t('t4.none')));
      return;
    }
    const startBank = Number($('start-bank').value) || 0;
    modes.forEach((m, i) => {
      const item = el('div', { class: `mode-item${i === selected ? ' sel' : ''}` });
      const name = el('input', { type: 'text', maxlength: String(NAME_LEN), size: '9', value: m.name });
      name.addEventListener('change', () => {
        m.name = name.value.trim().slice(0, NAME_LEN) || m.name;
        name.value = m.name;
      });
      const w = checkSteps(m.schema.steps);
      const meta =
        t('t4.steps', { count: m.schema.steps.length }) +
        (w.length ? ` · ${t('t4.warnings', { count: w.length })}` : '');
      item.append(
        el('span', { class: 'tid' }, t('t4.bank', { n: startBank + i })),
        name,
        el('span', { class: 'meta' }, meta),
      );
      const edit = el('button', { class: 'small' }, t('t4.edit'));
      edit.addEventListener('click', () => {
        selected = i;
        render();
      });
      const up = el('button', { class: 'small', 'aria-label': t('t4.moveUp'), title: t('t4.moveUp') }, '↑');
      up.disabled = i === 0;
      up.addEventListener('click', () => {
        [modes[i - 1], modes[i]] = [modes[i], modes[i - 1]];
        selected = i - 1;
        render();
      });
      const del = el('button', { class: 'small' }, t('t4.remove'));
      del.addEventListener('click', () => {
        modes.splice(i, 1);
        selected = Math.min(selected, modes.length - 1);
        render();
      });
      item.append(edit, up, del);
      box.append(item);
    });
  }

  function renderEditor() {
    const m = modes[selected];
    $('editor').hidden = !m;
    if (!m) return;
    const steps = m.schema.steps;
    $('editor-title').textContent = t('t4.editTitle', { name: m.name });
    $('editor-warnings').innerHTML = '';
    checkSteps(steps).forEach((w) => $('editor-warnings').append(el('li', {}, warningText(w))));
    chart(steps);
    const table = $('editor-table');
    table.innerHTML = '';
    const head = el('tr');
    [t('t4.col.step'), t('t4.col.time'), 'CH1', 'CH2', 'CH3', 'CH4', 'CH5', t('t4.col.jump'), ''].forEach((h) =>
      head.append(el('th', {}, h)),
    );
    table.append(head);
    steps.forEach((s, i) => {
      const tr = el('tr');
      tr.append(el('td', {}, String(i + 1)));
      const time = el('input', { type: 'time', value: timeLabel(s.hour, s.minute) });
      time.addEventListener('change', () => {
        const [h, mi] = time.value.split(':').map(Number);
        if (h >= 0) {
          s.hour = h;
          s.minute = mi;
          render();
        }
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
          s.ch[c] = Math.max(0, Math.min(100, Number(inp.value) || 0));
          inp.value = s.ch[c];
          chart(steps);
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
        cb.addEventListener('change', () => {
          s.jump[c] = cb.checked;
          chart(steps);
        });
        lab.append(cb, document.createTextNode(String(c + 1)));
        tdJ.append(lab);
      }
      tr.append(tdJ);
      const del = el('button', { class: 'small', 'aria-label': t('t4.deleteStep'), title: t('t4.deleteStep') }, '×');
      del.addEventListener('click', () => {
        steps.splice(i, 1);
        render();
      });
      const tdDel = el('td');
      tdDel.append(del);
      tr.append(tdDel);
      table.append(tr);
    });
  }

  function render() {
    renderModes();
    renderEditor();
  }

  $('file').addEventListener('change', (e) => {
    loadFiles(Array.from(e.target.files));
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
    loadFiles(Array.from(e.dataTransfer.files));
  });

  $('btn-new-mode').addEventListener('click', () => {
    add(
      `MODE${modes.length + 1}`.slice(0, NAME_LEN),
      newSchema([blankStep(0, 0), blankStep(12, 0, [50, 50, 50, 50, 0])]),
    );
    log('info', 'empty schedule created', 'T4');
  });

  $('btn-test-mode').addEventListener('click', () => {
    const now = new Date();
    const start = now.getHours() * 60 + now.getMinutes() + 2;
    if (start + 6 >= 1439 || start < 2) {
      log('error', 'the test schedule cannot run around midnight; try after 00:05 or before 23:50', 'T4');
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
    add('FADETEST', newSchema(steps));
    log(
      'info',
      `test schedule FADETEST created: CH1 fades and CH2 jumps between ${timeLabel(...hm(start))} and ${timeLabel(...hm(start + 6))}`,
      'T4',
    );
  });

  $('start-bank').addEventListener('change', renderModes);
  $('chart-zoom').addEventListener('change', () => {
    if (modes[selected]) chart(modes[selected].schema.steps);
  });

  $('btn-add-step').addEventListener('click', () => {
    const m = modes[selected];
    if (!m) return;
    if (m.schema.steps.length >= MAX_STEPS) {
      log('error', `at most ${MAX_STEPS} steps`, 'T4');
      return;
    }
    const last = m.schema.steps[m.schema.steps.length - 1];
    const next = last ? Math.min(1439, last.hour * 60 + last.minute + 30) : 0;
    m.schema.steps.push(blankStep(Math.floor(next / 60), next % 60, last ? last.ch.slice() : undefined));
    render();
  });

  $('btn-sort').addEventListener('click', () => {
    const m = modes[selected];
    if (!m) return;
    m.schema.steps.sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute));
    renderEditor();
  });

  $('btn-export-tmf').addEventListener('click', () => {
    const m = modes[selected];
    if (!m) return;
    download(`${m.name}.tmf`, serializeTmf(m.schema), 'application/octet-stream');
    log('info', `schedule ${m.name} saved as .tmf (${m.schema.steps.length} steps)`, 'T4');
  });

  render();
  // refresh() redraws in the current language; modes and edits stay in memory.
  return { modes, loadFiles, refresh: render, warningText };
}
