// TC420 Web entry point: wires language, program library, device connection, sending, logbook and the Advanced panel.
// UI texts come from js/locales/*; the log stays in English so it can be shared in bug reports.
import { CMD, buildFrame, frameToReport, parseHexBytes } from './protocol.js';
import { usbSupport } from './platform.js';
import { DeviceConnection } from './device.js';
import { Logbook } from './logbook.js';
import { I18n, LANGUAGES, LANG_KEY, detectLanguage, applyTranslations } from './i18n.js';
import { $, el, download, stamp, setLast, bindI18n, refreshResults } from './ui/dom.js';
import { ask, bindAsk } from './ui/ask.js';
import { mountLogView } from './ui/log-view.js';
import { mountLiveControl } from './ui/live-control.js';
import { mountPrograms } from './ui/programs.js';
import { ProgramStore } from './programs.js';
import { createBackend } from './storage.js';
import { mountDevice } from './ui/device.js';
import { mountSend } from './ui/send.js';
import { mountSupport } from './ui/support.js';
import { mountPwa } from './ui/pwa.js';
import { mountPreview } from './ui/preview.js';

const APP = 'TC420 Web';
const APP_VERSION = '0.14.0';
const SIM = new URLSearchParams(location.search).has('sim');
const detected = usbSupport(navigator, { secure: window.isSecureContext });
const usb = SIM ? { ...detected, ok: true } : detected; // the simulator needs no USB

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
bindAsk(i18n);

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
    `new session · ${APP} ${APP_VERSION} · ${location.protocol}//${location.host || '(file)'} · language ${i18n.lang} · secure context ${window.isSecureContext} · WebHID ${'hid' in navigator} · platform ${detected.platform} · browser ${detected.browser || 'unknown'}${SIM ? ' · SIMULATOR' : ''} · ${navigator.userAgent}`,
  );
}

$('btn-export-json').addEventListener('click', exportJson);
$('btn-export-txt').addEventListener('click', exportTxt);
$('btn-new-session').addEventListener('click', startSession);
$('btn-clear-log').addEventListener('click', async () => {
  if (!(await ask('log.clearConfirm', {}, { okKey: 'log.clear', danger: true }))) return;
  logbook.clear();
  logView.render();
  startSession();
});

// ---------- notes for the log ----------

const obsNote = $('obs-note');
function saveObservation(good) {
  const extra = obsNote.value.trim() ? ` · ${obsNote.value.trim()}` : '';
  log(good ? 'obs-ok' : 'obs-bad', `observation: ${good ? 'works' : 'does not work'}${extra}`);
  obsNote.value = '';
  $('obs-saved').textContent = t('obs.saved');
  setTimeout(() => {
    $('obs-saved').textContent = '';
  }, 2000);
}
$('obs-ok').addEventListener('click', () => saveObservation(true));
$('obs-bad').addEventListener('click', () => saveObservation(false));
obsNote.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') saveObservation(true);
});

// ---------- simulator ----------

const simSetting = $('setting-sim');
simSetting.checked = SIM;
simSetting.addEventListener('change', () => {
  const url = new URL(location.href);
  if (simSetting.checked) url.searchParams.set('sim', '1');
  else url.searchParams.delete('sim');
  log('info', `simulator turned ${simSetting.checked ? 'on' : 'off'}; reloading`);
  location.assign(url);
});

// ---------- device ----------

let preview = null; // mounted below; updateButtons() runs before that
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
  preview?.render();
}

const support = mountSupport({ usb, i18n, log });
const device = mountDevice({
  conn,
  store,
  log,
  i18n,
  sim: SIM,
  storage,
  live,
  usb,
  support,
  onChange: () => updateButtons(),
  onControllerChange: () => programs.refresh(),
});
const send = mountSend({ conn, store, device, programs, live, log, i18n, usb, onChange: () => updateButtons() });
store.onChange(() => send.render());
const pwa = mountPwa({ i18n, log, toast: device.toast });
preview = mountPreview({ conn, store, live, editor: programs.editor, log, i18n });
store.onChange(() => preview.render());

// Leaving the page during online play: tell the controller to go back to its program.
// Best effort: the browser may close the page before the report is out.
window.addEventListener('pagehide', () => {
  if (!live.playing) return;
  const { reportId, data } = frameToReport(buildFrame(CMD.END, []));
  conn.device?.sendReport(reportId, data);
});

// ---------- raw packet ----------

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
  if (!(await ask('t7.confirm', { cmd: label, count: payload.length }, { okKey: 't7.send' }))) return;
  const r = await conn.send(cmd, payload, { test: 'T7', expectReply: $('raw-expect').checked });
  setLast('T7', r.ok, r.ok ? 't7.ok' : 't7.failed', { error: r.error || 'NOT OK' });
});

// ---------- language changes ----------

function applyLanguage() {
  document.documentElement.lang = i18n.lang;
  document.title = t('app.title');
  langSelect.value = i18n.lang;
  applyTranslations(document, i18n);
  $('app-version').textContent = t('adv.version', { version: APP_VERSION });
  support.render();
  pwa.render();
  preview.render();
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
} else if (!usb.ok) {
  log('error', `no USB access (${usb.reason}): this browser cannot connect to the TC420`);
}
