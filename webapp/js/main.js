// TC420 Web entry point: wires language, program library, device connection, sending, logbook and test bench UI.
// UI texts come from js/locales/*; the log stays in English so it can be shared in bug reports.
import { CMD, clockPayload, parseHexBytes, describeFrame, buildFrame } from './protocol.js';
import { DeviceConnection } from './device.js';
import { Logbook } from './logbook.js';
import { I18n, LANGUAGES, LANG_KEY, detectLanguage, applyTranslations } from './i18n.js';
import { $, el, download, stamp, setLast, bindI18n, refreshResults } from './ui/dom.js';
import { mountLogView } from './ui/log-view.js';
import { mountLiveControl } from './ui/live-control.js';
import { mountPrograms } from './ui/programs.js';
import { ProgramStore } from './programs.js';
import { createBackend } from './storage.js';
import { mountDevice } from './ui/device.js';
import { mountSend } from './ui/send.js';

const APP = 'TC420 Web';
const APP_VERSION = '0.8.0';
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
const store = await new ProgramStore({ backend: await createBackend() }).load();
log('info', `program library: ${store.programs.length} programs in ${store.backend?.kind || 'memory'} storage`, 'T4');
const programs = mountPrograms({ store, log, i18n, meta });

const multipleSetting = $('setting-multiple');
multipleSetting.checked = store.settings.multiplePrograms;
multipleSetting.addEventListener('change', () => {
  store.setSetting('multiplePrograms', multipleSetting.checked);
  log('info', `setting: multiple programs on the controller ${multipleSetting.checked ? 'on' : 'off'}`, 'T5');
  programs.refresh();
});
$('btn-backup-after').addEventListener('click', programs.exportBackup);

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
  device.render();
  send.render();
}

const device = mountDevice({
  conn,
  store,
  log,
  i18n,
  sim: SIM,
  storage,
  live,
  onChange: () => updateButtons(),
  onControllerChange: () => programs.refresh(),
});
const send = mountSend({ conn, store, device, programs, live, log, i18n, onChange: () => updateButtons() });
store.onChange(() => send.render());

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
  if (r.ok) {
    store.markSent([]);
    programs.refresh();
  }
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
  programs.refresh();
  live.refresh();
  logView.render();
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
}
