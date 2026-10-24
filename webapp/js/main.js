// TC420 Web entry point: wires language, device connection, logbook and test bench UI.
// UI texts come from js/locales/*; the log stays in English so it can be shared in bug reports.
import {
  CMD,
  VENDOR_ID,
  PRODUCT_ID,
  MAX_BANKS,
  MAX_STEPS,
  clockPayload,
  modeInitPayload,
  stepPayload,
  parseHexBytes,
  describeFrame,
  buildFrame,
} from './protocol.js';
import { checkSteps, describeWarning } from './schedule.js';
import { DeviceConnection, describeCollections } from './device.js';
import { SimDevice } from './simulator.js';
import { Logbook } from './logbook.js';
import { I18n, LANGUAGES, LANG_KEY, detectLanguage, applyTranslations } from './i18n.js';
import { $, el, download, stamp, setLast, bindI18n, refreshResults } from './ui/dom.js';
import { mountLogView } from './ui/log-view.js';
import { mountLiveControl } from './ui/live-control.js';
import { mountSchedules } from './ui/schedules.js';

const APP = 'TC420 Web';
const APP_VERSION = '0.5.0';
const SIM = new URLSearchParams(location.search).has('sim');

// localStorage can throw (private mode, blocked site data); then nothing is remembered.
function browserStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
const storage = browserStorage();
const remembered = (key) => {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
};

// ---------- language ----------

const preferred = navigator.languages?.length ? navigator.languages : [navigator.language || 'en'];
const i18n = new I18n({ lang: remembered(LANG_KEY) || detectLanguage(preferred), preferred });
const t = (key, params) => i18n.t(key, params);
bindI18n(i18n);

const langSelect = $('lang');
Object.entries(LANGUAGES).forEach(([code, name]) => langSelect.append(el('option', { value: code }, name)));
langSelect.addEventListener('change', () => {
  try {
    storage?.setItem(LANG_KEY, langSelect.value);
  } catch {
    // Not remembered; the choice still applies to this visit.
  }
  i18n.setLanguage(langSelect.value);
});

// ---------- logbook ----------

const logbook = new Logbook({ storage });
const log = (kind, text, test = '', extra = {}) => logbook.add(kind, text, test, extra);
const conn = new DeviceConnection({ log });
const logView = mountLogView(logbook, i18n);
const meta = () => ({ app: APP, version: APP_VERSION, userAgent: navigator.userAgent });

function exportJson() {
  download(`tc420-testlog-${stamp()}.json`, logbook.toJson(meta()), 'application/json');
  log('info', 'log saved as .json');
}

function exportTxt() {
  download(`tc420-testlog-${stamp()}.txt`, logbook.toText(meta()), 'text/plain');
  log('info', 'log saved as .txt');
}

function startSession() {
  log(
    'session',
    `new session · ${APP} ${APP_VERSION} · ${location.protocol}//${location.host || '(file)'} · language ${i18n.lang} · secure context ${window.isSecureContext} · WebHID ${'hid' in navigator}${SIM ? ' · SIMULATOR' : ''} · ${navigator.userAgent}`,
  );
}

['btn-export-json', 'btn-export-json2'].forEach((id) => $(id).addEventListener('click', exportJson));
['btn-export-txt', 'btn-export-txt2'].forEach((id) => $(id).addEventListener('click', exportTxt));
$('btn-new-session').addEventListener('click', startSession);
$('btn-clear-log').addEventListener('click', () => {
  if (!confirm(t('log.clearConfirm'))) return;
  logbook.clear();
  logView.render();
  startSession();
});

// ---------- observations ----------

document.querySelectorAll('[data-test]').forEach((card) => {
  const test = card.dataset.test;
  const box = el('div', { class: 'obs' });
  const note = el('input', { type: 'text', 'data-i18n-attr': 'placeholder:obs.placeholder' });
  const ok = el('button', { class: 'small', 'data-i18n': 'obs.works' });
  const bad = el('button', { class: 'small', 'data-i18n': 'obs.fails' });
  const saved = el('span', { class: 'saved' });
  const save = (good) => {
    const extra = note.value.trim() ? ` · ${note.value.trim()}` : '';
    log(good ? 'obs-ok' : 'obs-bad', `observation: ${good ? 'works' : 'does not work'}${extra}`, test);
    note.value = '';
    saved.textContent = t('obs.saved');
    setTimeout(() => {
      saved.textContent = '';
    }, 2000);
  };
  ok.addEventListener('click', () => save(true));
  bad.addEventListener('click', () => save(false));
  note.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') save(true);
  });
  box.append(el('span', { class: 'note', 'data-i18n': 'obs.label' }), note, ok, bad, saved);
  card.append(box);
});

// ---------- device ----------

const live = mountLiveControl({ conn, log, i18n, onChange: updateButtons });
const schedules = mountSchedules({ log, i18n });

function updateButtons() {
  const on = conn.connected;
  document.querySelectorAll('.needs-device').forEach((b) => {
    b.disabled = !on;
  });
  $('btn-play-start').disabled = !on || live.playing;
  $('btn-play-stop').disabled = !on || !live.playing;
  document.querySelectorAll('.needs-play').forEach((b) => {
    b.disabled = !live.playing;
  });
  $('dot').classList.toggle('on', on);
  $('status-text').textContent = on
    ? t('header.status.connected', { name: conn.device.productName || 'TC420' })
    : t('header.status.disconnected');
  $('btn-connect').textContent = t(on ? 'header.disconnect' : 'header.connect');
}

async function openDevice(dev, how) {
  await conn.open(dev);
  updateButtons();
  log(
    'info',
    `${how}: ${dev.productName || '(no name)'} · VID 0x${dev.vendorId.toString(16).padStart(4, '0')} PID 0x${dev.productId.toString(16).padStart(4, '0')} · ${describeCollections(dev)}`,
    'T1',
  );
  setLast('T1', true, 't1.connected', { name: dev.productName || 'TC420' });
}

async function connect() {
  if (conn.connected) {
    if (live.playing) await live.stop();
    await conn.close();
    updateButtons();
    log('info', 'connection closed', 'T1');
    return;
  }
  if (SIM) {
    await openDevice(new SimDevice(), 'simulator opened');
    return;
  }
  try {
    const list = await navigator.hid.requestDevice({ filters: [{ vendorId: VENDOR_ID, productId: PRODUCT_ID }] });
    if (!list.length) {
      log('info', 'no device selected', 'T1');
      return;
    }
    await openDevice(list[0], 'device opened');
  } catch (e) {
    log('error', `connecting failed: ${e.message}`, 'T1');
    setLast('T1', false, 't1.failed', { error: e.message });
  }
}
$('btn-connect').addEventListener('click', connect);

// ---------- T2 clock ----------

const showClock = () => {
  $('pc-time').textContent = i18n.formatDateTime(new Date(), { dateStyle: 'full', timeStyle: 'medium' });
};
setInterval(showClock, 500);

$('btn-sync').addEventListener('click', async () => {
  const r = await conn.send(CMD.SET_CLOCK, clockPayload(new Date()), { test: 'T2' });
  setLast('T2', r.ok, r.ok ? 't2.ok' : 't2.failed');
});
$('btn-sync-preview').addEventListener('click', () => {
  const frame = buildFrame(CMD.SET_CLOCK, clockPayload(new Date()));
  log('info', `preview (not sent): ${describeFrame(frame)}`, 'T2');
});

// ---------- T5 send ----------

let progress = null; // { key, params } of the T5 status line
function setProgress(key, params = {}) {
  progress = { key, params };
  $('dl-progress').textContent = t(key, params);
}

$('btn-download').addEventListener('click', async () => {
  const modes = schedules.modes;
  if (!modes.length) {
    log('error', 'no schedules to send; load or create one in T4 first', 'T5');
    return;
  }
  if (live.playing) await live.stop();
  const startBank = Number($('start-bank').value) || 0;
  if (startBank + modes.length > MAX_BANKS) {
    log('error', `banks ${startBank}–${startBank + modes.length - 1} are outside 0–${MAX_BANKS - 1}`, 'T5');
    return;
  }
  const bad = modes.filter((m) => m.schema.steps.length < 2 || m.schema.steps.length > MAX_STEPS);
  if (bad.length) {
    log('error', `invalid number of steps in: ${bad.map((m) => m.name).join(', ')}`, 'T5');
    return;
  }
  const lines = modes.map((m, i) => {
    const w = checkSteps(m.schema.steps);
    const steps = t('t4.steps', { count: m.schema.steps.length });
    const warn = w.length ? t('t5.summaryWarnings', { warnings: w.map(schedules.warningText).join('; ') }) : '';
    return t('t5.summaryLine', { bank: startBank + i, name: m.name, steps }) + warn;
  });
  if (!confirm(t('t5.confirm', { summary: lines.join('\n') }))) {
    log('info', 'sending cancelled', 'T5');
    return;
  }
  const logSummary = modes
    .map((m, i) => {
      const w = checkSteps(m.schema.steps);
      return `bank ${startBank + i}: ${m.name} (${m.schema.steps.length} steps)${w.length ? ` – ${w.map(describeWarning).join('; ')}` : ''}`;
    })
    .join('; ');
  log('info', `sending started · ${modes.length} schedule(s) · ${logSummary}`, 'T5');
  let ok = true;
  let sentSteps = 0;
  const total = modes.reduce((s, m) => s + m.schema.steps.length, 0);
  outer: for (let i = 0; i < modes.length; i++) {
    const m = modes[i];
    const bank = startBank + i;
    setProgress('t5.progressMode', { bank, name: m.name });
    const r1 = await conn.send(CMD.MODE_INIT, modeInitPayload(bank, m.schema.steps.length, m.name), { test: 'T5' });
    if (!r1.ok) {
      ok = false;
      break;
    }
    for (let k = 0; k < m.schema.steps.length; k++) {
      const r = await conn.send(CMD.STEP, stepPayload(m.schema.steps[k]), { test: 'T5' });
      if (!r.ok) {
        ok = false;
        break outer;
      }
      sentSteps++;
      setProgress('t5.progressStep', {
        bank,
        name: m.name,
        step: k + 1,
        steps: m.schema.steps.length,
        done: sentSteps,
        total,
      });
    }
    await conn.send(CMD.END_MODE, [], { test: 'T5' });
  }
  const end = await conn.send(CMD.END, [], { test: 'T5' });
  ok = ok && end.ok;
  setProgress(ok ? 't5.success' : 't5.failed');
  log(
    ok ? 'info' : 'error',
    ok
      ? `sending succeeded: ${modes.length} schedule(s), ${sentSteps} steps`
      : `sending failed after ${sentSteps} of ${total} steps`,
    'T5',
  );
  setLast('T5', ok, ok ? 't5.resultOk' : 't5.resultFailed', { count: modes.length });
});

// ---------- T6 clear ----------

const showClearText = () => {
  $('t6-text').innerHTML = t('t6.text', { word: t('t6.word') });
};

$('btn-clear').addEventListener('click', async () => {
  const word = t('t6.word');
  const answer = prompt(t('t6.prompt', { word }));
  if (answer?.trim().toUpperCase() !== word.toUpperCase()) {
    log('info', 'clearing cancelled', 'T6');
    return;
  }
  if (live.playing) await live.stop();
  const r = await conn.send(CMD.CLEAR_ALL, [], { test: 'T6' });
  setLast('T6', r.ok, r.ok ? 't6.ok' : 't6.failed');
});

// ---------- T7 raw ----------

$('btn-raw').addEventListener('click', async () => {
  let cmd;
  let payload;
  try {
    [cmd] = parseHexBytes($('raw-cmd').value);
    payload = $('raw-payload').value.trim() ? parseHexBytes($('raw-payload').value) : [];
    if (cmd === undefined) throw new Error('no command');
  } catch (e) {
    log('error', e.message, 'T7');
    return;
  }
  const label = `0x${cmd.toString(16).padStart(2, '0')}`;
  if (!confirm(t('t7.confirm', { cmd: label, count: payload.length }))) return;
  const r = await conn.send(cmd, payload, { test: 'T7', expectReply: $('raw-expect').checked });
  setLast('T7', r.ok, r.ok ? 't7.ok' : 't7.failed', { error: r.error || 'NOT OK' });
});

// ---------- language changes ----------

function applyLanguage() {
  document.documentElement.lang = i18n.lang;
  document.title = t('app.title');
  langSelect.value = i18n.lang;
  applyTranslations(document, i18n);
  showClearText();
  showClock();
  updateButtons();
  refreshResults();
  schedules.refresh();
  live.refresh();
  logView.render();
  if (progress) $('dl-progress').textContent = t(progress.key, progress.params);
}

i18n.onChange((lang) => {
  applyLanguage();
  log('info', `language changed to ${lang}`);
});

// ---------- startup ----------

applyLanguage();
startSession();
if (SIM) {
  $('sim-badge').hidden = false;
  $('sim-note').hidden = false;
} else if (!('hid' in navigator)) {
  $('unsupported').hidden = false;
  $('btn-connect').disabled = true;
  log('error', 'this browser does not support WebHID');
} else {
  navigator.hid.addEventListener('disconnect', (e) => {
    if (conn.device && e.device === conn.device) {
      live.abort();
      conn.forget();
      updateButtons();
      log('error', 'TC420 unplugged', 'T1');
    }
  });
  navigator.hid.getDevices().then((devs) => {
    const dev = devs.find((d) => d.vendorId === VENDOR_ID && d.productId === PRODUCT_ID);
    if (dev) {
      openDevice(dev, 'reconnected automatically').catch((e) =>
        log('error', `reconnecting automatically failed: ${e.message}`, 'T1'),
      );
    }
  });
}
