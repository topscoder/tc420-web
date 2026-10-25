// T4: the user's program library (saved in the browser) with editor, .tmf import/export and backups.
import { MAX_BANKS, NAME_LEN } from '../protocol.js';
import { parseTmf, serializeTmf, checkSteps, describeWarning, timeLabel, ScheduleError } from '../schedule.js';
import { sanitizeName, parseBackup, BackupError } from '../programs.js';
import { minutesOf } from '../editor-model.js';
import { TEMPLATES } from '../templates.js';
import { $, el, download, stamp, setLast } from './dom.js';
import { ask } from './ask.js';
import { mountEditor } from './editor.js';

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
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 -]/g, '')
    .slice(0, NAME_LEN);
}

export function mountPrograms({ store, log, i18n, meta }) {
  const t = (key, params) => i18n.t(key, params);
  const warningText = (w) => t(`schedule.warn.${w.code}`, w);

  const editor = mountEditor({ store, log, i18n, onChange: () => renderList() });

  function add(name, steps, source, linked) {
    const p = store.add({ name, steps, source, linked });
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
        const sorted = schema.steps.some((st, k) => k > 0 && minutesOf(st) < minutesOf(schema.steps[k - 1]));
        if (sorted) log('info', `${f.name}: steps sorted by time`, 'T4');
        if (p.name !== base) setLast('T4', true, 't4.importRenamed', { file: f.name, name: p.name });
        else if (sorted) setLast('T4', true, 't4.importSorted', { file: f.name });
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
      const okKey = 'common.replace';
      if (!(await ask('t4.confirmRestore', { count: backup.programs.length }, { okKey, danger: true }))) return;
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

  // First visit (no programs yet): three ways to start.
  function welcome() {
    const choice = (title, text, label, id, run, primary = false) => {
      const btn = el('button', { class: `small${primary ? ' primary' : ''}`, id }, t(label));
      btn.addEventListener('click', run);
      const box = el('div', { class: 'choice' });
      box.append(el('strong', {}, t(title)), el('span', { class: 'note' }, t(text)), btn);
      return box;
    };
    const pickTemplate = () => {
      const select = $('template-select');
      select.focus();
      try {
        select.showPicker();
      } catch {
        // showPicker needs a recent browser and a user gesture; focusing is enough.
      }
    };
    const choices = el('div', { class: 'choices' });
    choices.append(
      choice(
        'welcome.templateTitle',
        'welcome.templateText',
        'welcome.templateButton',
        'welcome-template',
        pickTemplate,
        true,
      ),
      choice('welcome.importTitle', 'welcome.importText', 'welcome.importButton', 'welcome-import', () =>
        $('file').click(),
      ),
      choice('welcome.emptyTitle', 'welcome.emptyText', 't4.new', 'welcome-empty', () => $('btn-new-mode').click()),
    );
    const box = el('div', { class: 'welcome' });
    box.append(el('h3', {}, t('welcome.title')), el('p', { class: 'note' }, t('welcome.text')), choices);
    return box;
  }

  function renderList() {
    const box = $('modes');
    box.innerHTML = '';
    $('list-title').hidden = !store.programs.length;
    $('list-title').textContent = t(store.settings.multiplePrograms ? 't4.listTitle' : 't4.listTitleOne');
    if (!store.programs.length) {
      box.append(welcome());
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
        if (p.id === store.selected?.id) editor.render();
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
      const actions = el('span', { class: 'actions' });
      item.append(actions);

      const button = (label, onClick, attrs = {}) => {
        const b = el('button', { class: 'small', ...attrs }, label);
        b.addEventListener('click', onClick);
        actions.append(b);
        return b;
      };
      button(t('t4.edit'), () => {
        store.select(p.id);
        editor.reset();
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
      button(t('t4.remove'), async () => {
        if (!(await ask('t4.confirmDelete', { name: p.name }, { okKey: 'common.delete', danger: true }))) return;
        store.remove(p.id);
        log('info', `program ${p.name} deleted`, 'T4');
        render();
      });
      box.append(item);
    });
  }

  function render() {
    renderStatus();
    renderList();
    renderTemplates();
    editor.render();
  }

  function renderTemplates() {
    const select = $('template-select');
    const current = select.value;
    select.innerHTML = '';
    select.append(el('option', { value: '' }, t('templates.choose')));
    Object.keys(TEMPLATES).forEach((id) => select.append(el('option', { value: id }, t(`templates.${id}`))));
    select.value = current;
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
    const day = [80, 80, 80, 80, 80];
    const steps = [
      blankStep(0, 0),
      blankStep(8, 0),
      blankStep(8, 30, day),
      blankStep(20, 0, day.slice()),
      blankStep(20, 30),
    ];
    if (add(`PROG${store.programs.length + 1}`, steps, 'new', true)) {
      editor.reset();
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
    if (add('FADETEST', steps, 'test', false)) {
      editor.reset();
      log(
        'info',
        `test program FADETEST created: CH1 fades and CH2 jumps between ${timeLabel(...hm(start))} and ${timeLabel(...hm(start + 6))}`,
        'T4',
      );
      render();
    }
  });

  $('btn-add-template').addEventListener('click', () => {
    const id = $('template-select').value;
    const tpl = TEMPLATES[id];
    if (!tpl) return;
    if (add(tpl.name, tpl.steps(), `template:${id}`, tpl.linked)) {
      log('info', `program created from template ${id}`, 'T4');
      setLast('T4', true, 't4.fromTemplate', { name: store.selected.name });
      editor.reset();
      render();
    }
  });

  $('btn-export-backup').addEventListener('click', exportBackup);
  $('btn-restore-backup').addEventListener('click', () => $('backup-file').click());
  $('backup-file').addEventListener('change', (e) => {
    if (e.target.files[0]) restoreBackup(e.target.files[0]);
    e.target.value = '';
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
  return { refresh: render, warningText, exportBackup, sanitizeName, editor };
}
