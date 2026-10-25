// "Send to TC420": confirmation, progress, success and failure in one dialog.
import { checkSteps } from '../schedule.js';
import { planTransfer, sendToController } from '../transfer.js';
import { $, el, setLast } from './dom.js';

export function mountSend({ conn, store, device, programs, live, log, i18n, usb = { ok: true }, onChange }) {
  const t = (key, params) => i18n.t(key, params);
  const timeNow = () => i18n.formatDateTime(new Date(), { hour: '2-digit', minute: '2-digit' });
  const dlg = $('dlg-send');
  let busy = false;
  let lastStatus = null; // { key, params } shown next to the button

  const plan = () =>
    planTransfer({
      programs: store.programs,
      selectedId: store.selected?.id,
      multiple: store.settings.multiplePrograms,
    });

  // ---------- T5 card ----------

  function render() {
    const multiple = store.settings.multiplePrograms;
    const btn = $('btn-download');
    const p = store.selected;
    if (multiple) btn.textContent = t('send.buttonMany', { count: store.programs.length });
    else btn.textContent = p ? t('send.button', { name: p.name }) : t('send.buttonNone');
    btn.disabled = !usb.ok || busy || (multiple ? !store.programs.length : !p);
    $('t5-text').textContent = t(multiple ? 'send.introMany' : 'send.intro');
    if (!usb.ok) $('dl-progress').textContent = t('send.needsUsb');
    else if (lastStatus) $('dl-progress').textContent = t(lastStatus.key, lastStatus.params);
  }

  function status(key, params = {}) {
    lastStatus = { key, params };
    $('dl-progress').textContent = t(key, params);
  }

  // ---------- dialog building blocks ----------

  function show(titleKey, titleParams, body, actions) {
    $('dlg-send-title').textContent = t(titleKey, titleParams);
    $('dlg-send-body').replaceChildren(...body);
    const row = $('dlg-send-actions');
    row.innerHTML = '';
    actions.forEach(({ label, kind = '', run, id }) => {
      const b = el('button', { class: kind, ...(id ? { id } : {}) }, t(label));
      b.addEventListener('click', run);
      row.append(b);
    });
    if (!dlg.open) dlg.showModal();
    row.lastElementChild?.focus();
  }
  const para = (key, params, cls = '') => el('p', { class: cls }, t(key, params));
  const close = () => dlg.close();

  // Esc closes the dialog, except while sending.
  dlg.addEventListener('cancel', (e) => {
    if (busy) e.preventDefault();
  });

  // ---------- flow ----------

  async function start() {
    if (busy) return;
    device.hideToast();
    const entries = plan();
    if (!entries.length) return;
    const problems = entries.flatMap(({ program }) => checkSteps(program.steps).map((w) => ({ program, w })));
    if (problems.length) {
      const { program, w } = problems[0];
      show(
        'send.invalidTitle',
        { name: program.name },
        [para(`schedule.warn.${w.code}`, w), para('send.invalidHint')],
        [{ label: 'common.close', kind: 'primary', run: close }],
      );
      return;
    }
    if (!conn.connected && !(await device.connect({ offerClock: false }))) return;
    confirm(entries);
  }

  function confirm(entries) {
    const multiple = store.settings.multiplePrograms;
    const clock = el('input', { type: 'checkbox', id: 'send-clock' });
    clock.checked = true;
    const clockLabel = el('label');
    clockLabel.append(clock, document.createTextNode(` ${t('send.alsoClock', { time: timeNow() })}`));
    const body = [];
    if (multiple) {
      const list = el('ul', { class: 'send-summary' });
      entries.forEach(({ program, bank }) =>
        list.append(
          el(
            'li',
            {},
            t('send.slotLine', {
              n: bank + 1,
              name: program.name,
              steps: t('t4.steps', { count: program.steps.length }),
            }),
          ),
        ),
      );
      body.push(list, para('send.replaceAll'));
    } else {
      const p = entries[0].program;
      body.push(para('send.willRun', { name: p.name, steps: t('t4.steps', { count: p.steps.length }) }));
    }
    body.push(para('send.noReadBack', {}, 'note'), el('p', {}, ''), clockLabel);
    const titleKey = multiple ? 'send.confirmTitleMany' : 'send.confirmTitle';
    show(titleKey, { name: entries[0].program.name, count: entries.length }, body, [
      {
        label: 'common.cancel',
        run: () => {
          log('info', 'sending cancelled', 'T5');
          close();
        },
      },
      { label: 'send.send', kind: 'danger', id: 'send-go', run: () => run(entries, clock.checked) },
    ]);
  }

  async function run(entries, setClock) {
    busy = true;
    if (live.playing) await live.stop();
    $('btn-backup-after').hidden = true;
    render();
    const bar = el('progress', { max: '1', value: '0' });
    const line = el('p', { id: 'send-phase' }, '');
    show('send.progressTitle', {}, [line, bar, para('send.keepConnected', {}, 'note')], []);
    const summary = entries.map(
      ({ program, bank }) => `slot ${bank + 1}: ${program.name} (${program.steps.length} steps)`,
    );
    log('info', `sending started · ${summary.join('; ')} · clock ${setClock ? 'yes' : 'no'}`, 'T5');

    const result = await sendToController(conn, {
      plan: entries,
      setClock,
      onProgress: ({ phase, done, total, name, step, steps }) => {
        bar.max = Math.max(1, total);
        bar.value = done;
        const key = `send.phase.${phase}`;
        const params = { name, step, steps, done, total };
        line.textContent = t(key, params);
        status(key, params);
      },
    });
    busy = false;
    if (result.ok) succeeded(entries, result);
    else failedWith(entries, result, setClock);
    render();
    onChange();
  }

  function succeeded(entries, result) {
    store.markSent(result.entries);
    programs.refresh();
    const multiple = entries.length > 1 || store.settings.multiplePrograms;
    const name = entries[0].program.name;
    log('info', `sending succeeded: ${entries.length} program(s)${result.clockSet ? ', clock set' : ''}`, 'T5');
    status('send.statusOk', { count: entries.length });
    setLast('T5', true, 't5.resultOk', { count: entries.length });
    $('btn-backup-after').hidden = false;
    const body = [];
    if (result.clockSet) body.push(para('send.clockWasSet', { time: timeNow() }));
    body.push(para(multiple ? 'send.onlyThese' : 'send.nothingElse'));
    show(multiple ? 'send.doneTitleMany' : 'send.doneTitle', { name, count: entries.length }, body, [
      {
        label: 'send.exportBackup',
        run: () => {
          programs.exportBackup();
          close();
        },
      },
      { label: 'common.done', kind: 'primary', run: close },
    ]);
  }

  function failedWith(entries, result, setClock) {
    const where = result.name ? `${result.name} step ${result.step}` : result.phase;
    log(
      'error',
      `sending failed: ${result.kind} during ${result.phase} (${where}); controller cleared: ${result.cleared}`,
      'T5',
    );
    if (result.cleared) {
      store.markSent([]); // we no longer know what is on the controller
      programs.refresh();
    }
    if (result.kind === 'disconnected') device.unplugged();
    status('send.statusFailed');
    setLast('T5', false, 't5.resultFailed');
    const body = [para(`send.error.${result.kind}`), para(result.cleared ? 'send.maybeEmpty' : 'send.unchanged')];
    const retry =
      result.kind === 'disconnected'
        ? { label: 'send.reconnectRetry', kind: 'primary', run: retryAfterReconnect }
        : { label: 'send.tryAgain', kind: 'primary', run: () => run(entries, setClock) };
    show(`send.errorTitle.${result.kind}`, {}, body, [
      {
        label: 'send.showLog',
        run: () => {
          close();
          $('advanced').open = true;
          $('log').scrollIntoView({ behavior: 'smooth' });
        },
      },
      { label: 'common.close', run: close },
      retry,
    ]);
  }

  async function retryAfterReconnect() {
    close();
    if (await device.connect({ offerClock: false })) start();
  }

  $('btn-download').addEventListener('click', start);
  render();
  return { render, start };
}
