// TC420 Web entry point: wires the device connection, logbook and test bench UI.
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
import { checkSteps } from './schedule.js';
import { DeviceConnection, describeCollections } from './device.js';
import { SimDevice } from './simulator.js';
import { Logbook } from './logbook.js';
import { $, el, download, stamp, setLast } from './ui/dom.js';
import { mountLogView } from './ui/log-view.js';
import { mountLiveControl } from './ui/live-control.js';
import { mountSchedules } from './ui/schedules.js';

const APP = 'TC420 Web';
const APP_VERSION = '0.4.0';
const SIM = new URLSearchParams(location.search).has('sim');

// localStorage can throw (private mode, blocked site data); the log then lives in memory only.
function browserStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
const logbook = new Logbook({ storage: browserStorage() });
const log = (kind, text, test = '', extra = {}) => logbook.add(kind, text, test, extra);
const conn = new DeviceConnection({ log });

// ---------- logbook ----------

mountLogView(logbook);
const meta = () => ({ app: APP, version: APP_VERSION, userAgent: navigator.userAgent });

function exportJson() {
  download(`tc420-testlog-${stamp()}.json`, logbook.toJson(meta()), 'application/json');
  log('info', 'logboek opgeslagen als .json');
}

function exportTxt() {
  download(`tc420-testlog-${stamp()}.txt`, logbook.toText(meta()), 'text/plain');
  log('info', 'logboek opgeslagen als .txt');
}

function startSession() {
  log(
    'sessie',
    `nieuwe sessie · ${APP} ${APP_VERSION} · ${location.protocol}//${location.host || '(bestand)'} · secure context ${window.isSecureContext} · WebHID ${'hid' in navigator}${SIM ? ' · SIMULATIE' : ''} · ${navigator.userAgent}`,
  );
}

['btn-export-json', 'btn-export-json2'].forEach((id) => $(id).addEventListener('click', exportJson));
['btn-export-txt', 'btn-export-txt2'].forEach((id) => $(id).addEventListener('click', exportTxt));
$('btn-new-session').addEventListener('click', startSession);
$('btn-clear-log').addEventListener('click', () => {
  if (!confirm('Het logboek leegmaken? Sla het eerst op als je het wilt bewaren.')) return;
  logbook.clear();
  $('log').innerHTML = '';
  startSession();
});

// ---------- observations ----------

document.querySelectorAll('[data-test]').forEach((card) => {
  const test = card.dataset.test;
  const box = el('div', { class: 'obs' });
  const note = el('input', { type: 'text', placeholder: 'Wat zie je op de TC420? (optioneel)' });
  const ok = el('button', { class: 'small' }, '✔ Werkt');
  const bad = el('button', { class: 'small' }, '✘ Werkt niet');
  const saved = el('span', { class: 'saved' });
  const save = (good) => {
    const extra = note.value.trim() ? ` · ${note.value.trim()}` : '';
    log(good ? 'obs-ok' : 'obs-bad', `waarneming: ${good ? 'werkt' : 'werkt niet'}${extra}`, test);
    note.value = '';
    saved.textContent = 'opgeslagen';
    setTimeout(() => {
      saved.textContent = '';
    }, 2000);
  };
  ok.addEventListener('click', () => save(true));
  bad.addEventListener('click', () => save(false));
  note.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') save(true);
  });
  box.append(el('span', { class: 'note' }, 'Jouw waarneming:'), note, ok, bad, saved);
  card.append(box);
});

// ---------- device ----------

const live = mountLiveControl({ conn, log, onChange: updateButtons });
const schedules = mountSchedules({ log });

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
  $('status-text').textContent = on ? `Verbonden: ${conn.device.productName || 'TC420'}` : 'Niet verbonden';
  $('btn-connect').textContent = on ? 'Verbreken' : 'Verbinden';
}

async function openDevice(dev, how) {
  await conn.open(dev);
  updateButtons();
  log(
    'info',
    `${how}: ${dev.productName || '(geen naam)'} · VID 0x${dev.vendorId.toString(16).padStart(4, '0')} PID 0x${dev.productId.toString(16).padStart(4, '0')} · ${describeCollections(dev)}`,
    'T1',
  );
  setLast('T1', true, `verbonden met ${dev.productName || 'TC420'}`);
}

async function connect() {
  if (conn.connected) {
    if (live.playing) await live.stop();
    await conn.close();
    updateButtons();
    log('info', 'verbinding gesloten', 'T1');
    return;
  }
  if (SIM) {
    await openDevice(new SimDevice(), 'simulatie geopend');
    return;
  }
  try {
    const list = await navigator.hid.requestDevice({ filters: [{ vendorId: VENDOR_ID, productId: PRODUCT_ID }] });
    if (!list.length) {
      log('info', 'geen apparaat gekozen', 'T1');
      return;
    }
    await openDevice(list[0], 'apparaat geopend');
  } catch (e) {
    log('fout', `verbinden mislukt: ${e.message}`, 'T1');
    setLast('T1', false, e.message);
  }
}
$('btn-connect').addEventListener('click', connect);

// ---------- T2 clock ----------

setInterval(() => {
  $('pc-time').textContent = new Date().toLocaleString('nl-NL', { dateStyle: 'full', timeStyle: 'medium' });
}, 500);

$('btn-sync').addEventListener('click', async () => {
  const r = await conn.send(CMD.SET_CLOCK, clockPayload(new Date()), { test: 'T2' });
  setLast('T2', r.ok, r.ok ? 'klok gezet, bevestigd' : 'geen bevestiging');
});
$('btn-sync-preview').addEventListener('click', () => {
  const frame = buildFrame(CMD.SET_CLOCK, clockPayload(new Date()));
  log('info', `voorbeeld (niet verstuurd): ${describeFrame(frame)}`, 'T2');
});

// ---------- T5 download ----------

$('btn-download').addEventListener('click', async () => {
  const modes = schedules.modes;
  if (!modes.length) {
    log('fout', "geen schema's om te downloaden; laad of maak er eerst een in T4", 'T5');
    return;
  }
  if (live.playing) await live.stop();
  const startBank = Number($('start-bank').value) || 0;
  if (startBank + modes.length > MAX_BANKS) {
    log('fout', `banken ${startBank}–${startBank + modes.length - 1} vallen buiten 0–${MAX_BANKS - 1}`, 'T5');
    return;
  }
  const bad = modes.filter((m) => m.schema.steps.length < 2 || m.schema.steps.length > MAX_STEPS);
  if (bad.length) {
    log('fout', `ongeldig aantal stappen in: ${bad.map((m) => m.name).join(', ')}`, 'T5');
    return;
  }
  const summary = modes
    .map((m, i) => {
      const w = checkSteps(m.schema.steps);
      return `bank ${startBank + i}: ${m.name} (${m.schema.steps.length} stappen)${w.length ? ` – let op: ${w.join('; ')}` : ''}`;
    })
    .join('\n');
  if (!confirm(`Deze programma's op de controller overschrijven?\n\n${summary}`)) {
    log('info', 'download geannuleerd', 'T5');
    return;
  }
  log('info', `download gestart · ${modes.length} schema('s) · ${summary.replace(/\n/g, '; ')}`, 'T5');
  let ok = true;
  let sentSteps = 0;
  const total = modes.reduce((s, m) => s + m.schema.steps.length, 0);
  outer: for (let i = 0; i < modes.length; i++) {
    const m = modes[i];
    const bank = startBank + i;
    $('dl-progress').textContent = `bank ${bank}: ${m.name} …`;
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
      $('dl-progress').textContent =
        `bank ${bank}: ${m.name} · stap ${k + 1}/${m.schema.steps.length} · totaal ${sentSteps}/${total}`;
    }
    await conn.send(CMD.END_MODE, [], { test: 'T5' });
  }
  const end = await conn.send(CMD.END, [], { test: 'T5' });
  ok = ok && end.ok;
  $('dl-progress').textContent = ok ? 'Download geslaagd' : 'Download mislukt (zie logboek)';
  log(
    ok ? 'info' : 'fout',
    ok
      ? `download geslaagd: ${modes.length} schema('s), ${sentSteps} stappen`
      : `download mislukt na ${sentSteps} van ${total} stappen`,
    'T5',
  );
  setLast('T5', ok, ok ? `${modes.length} schema('s) gedownload` : 'mislukt');
});

// ---------- T6 clear ----------

$('btn-clear').addEventListener('click', async () => {
  const answer = prompt("Typ WISSEN om alle programma's op de controller te wissen.");
  if (answer !== 'WISSEN') {
    log('info', 'wissen geannuleerd', 'T6');
    return;
  }
  if (live.playing) await live.stop();
  const r = await conn.send(CMD.CLEAR_ALL, [], { test: 'T6' });
  setLast('T6', r.ok, r.ok ? 'alles gewist, bevestigd' : 'niet bevestigd');
});

// ---------- T7 raw ----------

$('btn-raw').addEventListener('click', async () => {
  let cmd;
  let payload;
  try {
    [cmd] = parseHexBytes($('raw-cmd').value);
    payload = $('raw-payload').value.trim() ? parseHexBytes($('raw-payload').value) : [];
    if (cmd === undefined) throw new Error('geen commando');
  } catch (e) {
    log('fout', e.message, 'T7');
    return;
  }
  if (!confirm(`Commando 0x${cmd.toString(16).padStart(2, '0')} met ${payload.length} bytes payload versturen?`))
    return;
  const r = await conn.send(cmd, payload, { test: 'T7', expectReply: $('raw-expect').checked });
  setLast('T7', r.ok, r.ok ? 'bevestigd' : r.error || 'geen OK');
});

// ---------- startup ----------

startSession();
if (SIM) {
  $('sim-badge').hidden = false;
  $('sim-note').hidden = false;
} else if (!('hid' in navigator)) {
  $('unsupported').hidden = false;
  $('btn-connect').disabled = true;
  log('fout', 'deze browser ondersteunt geen WebHID');
} else {
  navigator.hid.addEventListener('disconnect', (e) => {
    if (conn.device && e.device === conn.device) {
      live.abort();
      conn.forget();
      updateButtons();
      log('fout', 'TC420 losgekoppeld', 'T1');
    }
  });
  navigator.hid.getDevices().then((devs) => {
    const dev = devs.find((d) => d.vendorId === VENDOR_ID && d.productId === PRODUCT_ID);
    if (dev) {
      openDevice(dev, 'automatisch opnieuw verbonden').catch((e) =>
        log('fout', `automatisch verbinden mislukt: ${e.message}`, 'T1'),
      );
    }
  });
}
updateButtons();
