// TC420 Web: UI, transport, test flows and persistent log.
(function () {
  'use strict';
  const T = window.TC420;
  const APP_VERSION = '0.3.0';
  const LOG_KEY = 'tc420-testlog-v1';
  const REPLY_TIMEOUT_MS = 3000;
  const END_MODE_WAIT_MS = 300;
  const PLAY_INTERVAL_MS = 60;
  const CH_COLORS = ['var(--ch1)', 'var(--ch2)', 'var(--ch3)', 'var(--ch4)', 'var(--ch5)'];
  const SIM = new URLSearchParams(location.search).has('sim');

  const $ = (id) => document.getElementById(id);
  const el = (tag, attrs, text) => {
    const e = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => { if (k === 'class') e.className = v; else e.setAttribute(k, v); });
    if (text !== undefined) e.textContent = text;
    return e;
  };

  // ---------- persistent log ----------

  let entries = [];
  try { entries = JSON.parse(localStorage.getItem(LOG_KEY) || '[]'); } catch { entries = []; }
  let storageOk = true;

  function persist() {
    try { localStorage.setItem(LOG_KEY, JSON.stringify(entries)); storageOk = true; } catch { storageOk = false; }
    $('log-count').textContent = `${entries.length} regels${storageOk ? ' · bewaard in de browser' : ' · LET OP: opslaan in de browser lukt niet, sla het log tussendoor op'}`;
  }

  function renderEntry(e) {
    const row = el('div', { class: `log-row k-${e.kind}` });
    const d = new Date(e.t);
    const ts = `${d.toLocaleDateString('nl-NL')} ${d.toLocaleTimeString('nl-NL', { hour12: false })}.${String(d.getMilliseconds()).padStart(3, '0')}`;
    row.append(el('span', { class: 'log-time' }, ts), el('span', { class: 'log-kind' }, e.kind.toUpperCase()),
      el('span', { class: 'log-test' }, e.test || ''), el('span', { class: 'log-text' }, e.text));
    $('log').append(row);
  }

  function log(kind, text, test, extra) {
    const e = Object.assign({ t: new Date().toISOString(), kind, test: test || '', text }, extra || {});
    entries.push(e);
    persist();
    renderEntry(e);
    $('log').scrollTop = $('log').scrollHeight;
    return e;
  }

  function setLast(test, ok, text) {
    const n = $(`last-${test}`);
    if (!n) return;
    n.className = `last ${ok ? 'ok' : 'bad'}`;
    n.textContent = `Laatste resultaat: ${text}`;
  }

  function download(name, content, type) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const a = el('a', { href: url, download: name });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function stamp() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
  }

  function exportJson() {
    const doc = { app: 'TC420 Web', version: APP_VERSION, exported: new Date().toISOString(), userAgent: navigator.userAgent, entries };
    download(`tc420-testlog-${stamp()}.json`, JSON.stringify(doc, null, 2), 'application/json');
    log('info', 'logboek opgeslagen als .json');
  }

  function exportTxt() {
    const lines = entries.map((e) => `${e.t}\t${e.kind.toUpperCase()}\t${e.test || '-'}\t${e.text}`);
    download(`tc420-testlog-${stamp()}.txt`, `TC420 Web ${APP_VERSION}\n${navigator.userAgent}\n\n${lines.join('\n')}\n`, 'text/plain');
    log('info', 'logboek opgeslagen als .txt');
  }

  ['btn-export-json', 'btn-export-json2'].forEach((id) => $(id).addEventListener('click', exportJson));
  ['btn-export-txt', 'btn-export-txt2'].forEach((id) => $(id).addEventListener('click', exportTxt));
  $('btn-new-session').addEventListener('click', startSession);
  $('btn-clear-log').addEventListener('click', () => {
    if (!confirm('Het logboek leegmaken? Sla het eerst op als je het wilt bewaren.')) return;
    entries = [];
    $('log').innerHTML = '';
    persist();
    startSession();
  });

  function startSession() {
    log('sessie', `nieuwe sessie · TC420 Web ${APP_VERSION} · ${location.protocol}//${location.host || '(bestand)'} · secure context ${window.isSecureContext} · WebHID ${'hid' in navigator}${SIM ? ' · SIMULATIE' : ''} · ${navigator.userAgent}`);
  }

  // ---------- observations ----------

  document.querySelectorAll('[data-test]').forEach((card) => {
    const test = card.dataset.test;
    const box = el('div', { class: 'obs' });
    const note = el('input', { type: 'text', placeholder: 'Wat zie je op de TC420? (optioneel)' });
    const ok = el('button', { class: 'small' }, '✔ Werkt');
    const bad = el('button', { class: 'small' }, '✘ Werkt niet');
    const saved = el('span', { class: 'saved' });
    const save = (good) => {
      log(good ? 'obs-ok' : 'obs-bad', `waarneming: ${good ? 'werkt' : 'werkt niet'}${note.value.trim() ? ` · ${note.value.trim()}` : ''}`, test);
      note.value = '';
      saved.textContent = 'opgeslagen';
      setTimeout(() => { saved.textContent = ''; }, 2000);
    };
    ok.addEventListener('click', () => save(true));
    bad.addEventListener('click', () => save(false));
    note.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(true); });
    box.append(el('span', { class: 'note' }, 'Jouw waarneming:'), note, ok, bad, saved);
    card.append(box);
  });

  // ---------- transport ----------

  class SimDevice extends EventTarget {
    constructor() { super(); this.opened = false; this.productName = 'Time Controller (SIMULATIE)'; this.vendorId = T.VENDOR_ID; this.productId = T.PRODUCT_ID; this.collections = [{ usagePage: 0xff, usage: 0xff, inputReports: [{ reportId: 0, items: [{ reportSize: 8, reportCount: 64 }] }], outputReports: [{ reportId: 0, items: [{ reportSize: 8, reportCount: 64 }] }] }]; }
    async open() { this.opened = true; }
    async close() { this.opened = false; }
    async sendReport(reportId, data) {
      const cmd = data[2];
      if (cmd === T.CMD.END_MODE) return;
      const reply = new Uint8Array(64);
      reply[2] = cmd; reply[4] = 1; reply[5] = 0;
      setTimeout(() => {
        const ev = new Event('inputreport');
        ev.reportId = 0;
        ev.data = new DataView(reply.buffer);
        this.dispatchEvent(ev);
      }, 8 + Math.random() * 10);
    }
  }

  let device = null;
  let waiter = null;
  let queue = Promise.resolve();

  function onInputReport(event) {
    const data = new Uint8Array(event.data.buffer, event.data.byteOffset, event.data.byteLength);
    if (waiter) {
      const w = waiter;
      waiter = null;
      clearTimeout(w.timer);
      w.resolve({ reportId: event.reportId, data });
    } else {
      log('rx', `onverwacht antwoord · report-id ${event.reportId} · ${T.toHex(data, 16)} …`);
    }
  }

  function waitReply(ms) {
    return new Promise((resolve) => {
      const timer = setTimeout(() => { waiter = null; resolve(null); }, ms);
      waiter = { resolve, timer };
    });
  }

  // Serialised: one command in flight at a time, like PLed and the library.
  function send(cmd, payload, opts) {
    const o = Object.assign({ test: '', expectReply: true, quiet: false }, opts || {});
    const run = async () => {
      if (!device) throw new Error('niet verbonden');
      const frame = T.buildFrame(cmd, payload);
      const { reportId, data } = T.frameToReport(frame);
      const label = `0x${cmd.toString(16).padStart(2, '0')} ${T.CMD_NAMES[cmd] || ''}`;
      if (!o.quiet) log('tx', `${label} · ${T.describeFrame(frame)}`, o.test);
      const reply = waitReply(o.expectReply ? REPLY_TIMEOUT_MS : END_MODE_WAIT_MS);
      const t0 = performance.now();
      try {
        await device.sendReport(reportId, data);
      } catch (e) {
        if (waiter) { clearTimeout(waiter.timer); waiter = null; }
        log('fout', `${label}: versturen mislukt · ${e.message}`, o.test);
        return { ok: false, error: e.message };
      }
      const r = await reply;
      const ms = Math.round(performance.now() - t0);
      if (!r) {
        if (o.expectReply) {
          log('fout', `${label}: geen antwoord binnen ${REPLY_TIMEOUT_MS} ms`, o.test);
          return { ok: false, error: 'timeout' };
        }
        if (!o.quiet) log('info', `${label}: geen antwoord (zoals verwacht)`, o.test);
        return { ok: true, noReply: true };
      }
      const a = T.parseResponse(r.data);
      const verdict = a.ok ? 'OK' : 'GEEN OK';
      const detail = `${ms} ms · RX ${T.toHex(r.data, 12)} … · cmd 0x${(a.cmd ?? 0).toString(16).padStart(2, '0')}, lengte ${a.len}, resultaat 0x${(a.result ?? 0).toString(16).padStart(2, '0')} → ${verdict}${a.ok !== a.pledOk ? ` (PLed-regel zegt ${a.pledOk ? 'OK' : 'GEEN OK'})` : ''}`;
      if (!o.quiet || !a.ok) log(a.ok ? 'ack' : 'nack', `${label}: ${detail}`, o.test, { rx: T.toHex(r.data) });
      if (!o.expectReply) log('info', `${label}: toch een antwoord ontvangen (onverwacht)`, o.test);
      return { ok: a.ok, resp: a, ms };
    };
    const p = queue.then(run, run);
    queue = p.catch(() => {});
    return p;
  }

  function describeCollections(dev) {
    return dev.collections.map((c) => {
      const size = (reports) => reports.map((r) => `id ${r.reportId}: ${r.items.reduce((s, it) => s + it.reportSize * it.reportCount, 0) / 8} B`).join(', ') || 'geen';
      return `usagePage 0x${c.usagePage.toString(16)} usage 0x${c.usage.toString(16)} · in [${size(c.inputReports)}] · uit [${size(c.outputReports)}]`;
    }).join(' | ');
  }

  function updateButtons() {
    document.querySelectorAll('.needs-device').forEach((b) => { b.disabled = !device; });
    $('btn-play-start').disabled = !device || playing;
    $('btn-play-stop').disabled = !device || !playing;
    document.querySelectorAll('.needs-play').forEach((b) => { b.disabled = !playing; });
    $('dot').classList.toggle('on', !!device);
    $('status-text').textContent = device ? `Verbonden: ${device.productName || 'TC420'}` : 'Niet verbonden';
    $('btn-connect').textContent = device ? 'Verbreken' : 'Verbinden';
  }

  async function openDevice(dev, how) {
    if (!dev.opened) await dev.open();
    dev.addEventListener('inputreport', onInputReport);
    device = dev;
    updateButtons();
    log('info', `${how}: ${dev.productName || '(geen naam)'} · VID 0x${dev.vendorId.toString(16).padStart(4, '0')} PID 0x${dev.productId.toString(16).padStart(4, '0')} · ${describeCollections(dev)}`, 'T1');
    setLast('T1', true, `verbonden met ${dev.productName || 'TC420'}`);
  }

  async function connect() {
    if (device) {
      if (playing) await stopPlay();
      device.removeEventListener('inputreport', onInputReport);
      await device.close();
      device = null;
      updateButtons();
      log('info', 'verbinding gesloten', 'T1');
      return;
    }
    if (SIM) { await openDevice(new SimDevice(), 'simulatie geopend'); return; }
    try {
      const list = await navigator.hid.requestDevice({ filters: [{ vendorId: T.VENDOR_ID, productId: T.PRODUCT_ID }] });
      if (!list.length) { log('info', 'geen apparaat gekozen', 'T1'); return; }
      await openDevice(list[0], 'apparaat geopend');
    } catch (e) {
      log('fout', `verbinden mislukt: ${e.message}`, 'T1');
      setLast('T1', false, e.message);
    }
  }
  $('btn-connect').addEventListener('click', connect);

  // ---------- T2 clock ----------

  setInterval(() => { $('pc-time').textContent = new Date().toLocaleString('nl-NL', { dateStyle: 'full', timeStyle: 'medium' }); }, 500);

  $('btn-sync').addEventListener('click', async () => {
    const r = await send(T.CMD.SET_CLOCK, T.clockPayload(new Date()), { test: 'T2' });
    setLast('T2', r.ok, r.ok ? 'klok gezet, bevestigd' : 'geen bevestiging');
  });
  $('btn-sync-preview').addEventListener('click', () => {
    log('info', `voorbeeld (niet verstuurd): ${T.describeFrame(T.buildFrame(T.CMD.SET_CLOCK, T.clockPayload(new Date())))}`, 'T2');
  });

  // ---------- T3 online play ----------

  let playing = false;
  let values = [0, 0, 0, 0, 0];
  let sweepTimer = null;
  let playStats = { sent: 0, failed: 0, ms: 0 };

  const sliderBox = $('sliders');
  const sliders = [];
  for (let c = 0; c < 5; c++) {
    const lab = el('label', { for: `sl${c}` }, `CH${c + 1}`);
    lab.style.color = CH_COLORS[c];
    const s = el('input', { type: 'range', min: '0', max: '100', value: '0', id: `sl${c}` });
    s.disabled = true;
    const out = el('output', {}, '0 %');
    s.addEventListener('input', () => { values[c] = Number(s.value); out.textContent = `${s.value} %`; });
    sliderBox.append(lab, s, out);
    sliders.push({ s, out });
  }
  function setValues(v) {
    values = v.slice();
    sliders.forEach((x, c) => { x.s.value = values[c]; x.out.textContent = `${values[c]} %`; });
  }

  async function playLoop() {
    let lastLogged = null;
    let lastLogAt = 0;
    while (playing) {
      const t0 = performance.now();
      const v = values.slice();
      const verbose = $('verbose').checked;
      const r = await send(T.CMD.PLAY_VALUES, T.playValuesPayload(v), { test: 'T3', quiet: !verbose });
      playStats.sent++;
      if (!r.ok) playStats.failed++;
      else playStats.ms = r.ms;
      const key = v.join(',');
      // Without verbose logging, log changed values at most twice a second.
      if (!verbose && key !== lastLogged && performance.now() - lastLogAt >= 500) {
        log('info', `live waarden CH1–CH5 = ${v.join(' / ')} %${r.ok ? '' : ' (niet bevestigd)'}`, 'T3');
        lastLogged = key;
        lastLogAt = performance.now();
      }
      $('play-stats').textContent = `${playStats.sent} pakketten · ${playStats.failed} mislukt · laatste antwoord ${playStats.ms} ms`;
      if (playStats.failed >= 5 && playStats.failed === playStats.sent) {
        log('fout', 'online play: 5 keer geen bevestiging, gestopt', 'T3');
        await stopPlay();
        break;
      }
      const wait = PLAY_INTERVAL_MS - (performance.now() - t0);
      if (wait > 0) await new Promise((res) => setTimeout(res, wait));
    }
  }

  async function startPlay() {
    let payload;
    try { payload = T.playInitPayload($('play-name').value); } catch (e) { log('fout', e.message, 'T3'); return; }
    const r = await send(T.CMD.PLAY_INIT, payload, { test: 'T3' });
    setLast('T3', r.ok, r.ok ? 'online play gestart' : 'start niet bevestigd');
    if (!r.ok) return;
    playing = true;
    playStats = { sent: 0, failed: 0, ms: 0 };
    sliders.forEach((x) => { x.s.disabled = false; });
    updateButtons();
    playLoop();
  }

  async function stopPlay() {
    if (sweepTimer) { clearInterval(sweepTimer); sweepTimer = null; }
    playing = false;
    sliders.forEach((x) => { x.s.disabled = true; });
    updateButtons();
    const r = await send(T.CMD.END, [], { test: 'T3' });
    log('info', `online play gestopt na ${playStats.sent} pakketten (${playStats.failed} mislukt); laatste waarden ${values.join(' / ')} %`, 'T3');
    setLast('T3', r.ok, r.ok ? `gestopt; ${playStats.sent} pakketten, ${playStats.failed} mislukt` : 'stop niet bevestigd');
  }

  $('btn-play-start').addEventListener('click', startPlay);
  $('btn-play-stop').addEventListener('click', stopPlay);
  $('btn-all-0').addEventListener('click', () => setValues([0, 0, 0, 0, 0]));
  $('btn-all-100').addEventListener('click', () => setValues([100, 100, 100, 100, 100]));
  $('btn-sweep').addEventListener('click', () => {
    if (sweepTimer) { clearInterval(sweepTimer); sweepTimer = null; log('info', 'kanaaltest afgebroken', 'T3'); return; }
    log('info', 'kanaaltest gestart: CH1 t/m CH5 elk 0→100→0 in 4 s', 'T3');
    const t0 = performance.now();
    sweepTimer = setInterval(() => {
      const t = (performance.now() - t0) / 1000;
      const c = Math.floor(t / 4);
      if (c >= 5) { clearInterval(sweepTimer); sweepTimer = null; setValues([0, 0, 0, 0, 0]); log('info', 'kanaaltest klaar', 'T3'); return; }
      const ph = (t % 4) / 2;
      const v = [0, 0, 0, 0, 0];
      v[c] = Math.round(ph <= 1 ? ph * 100 : (2 - ph) * 100);
      setValues(v);
    }, 50);
  });

  // ---------- T4 schemas ----------

  let modes = [];   // { name, schema }
  let selected = -1;

  function nameFromFile(fname) {
    return fname.replace(/\.tmf$/i, '').replace(/[^\x20-\x7e]/g, '?').slice(0, T.NAME_LEN).toUpperCase();
  }

  function addMode(name, schema) {
    if (modes.length >= T.MAX_BANKS) { log('fout', `maximaal ${T.MAX_BANKS} schema's`, 'T4'); return; }
    modes.push({ name, schema });
    selected = modes.length - 1;
    renderModes();
    renderEditor();
  }

  async function loadFiles(files) {
    for (const f of files) {
      try {
        const schema = T.parseTmf(await f.arrayBuffer());
        addMode(nameFromFile(f.name), schema);
        log('info', `schema ingelezen: ${f.name} · ${schema.deviceName} · ${schema.channels} kanalen · ${schema.steps.length} stappen · derde veld ${schema.third}${schema.warnings.length ? ` · waarschuwingen: ${schema.warnings.join('; ')}` : ''}`, 'T4');
      } catch (e) {
        log('fout', `${f.name}: ${e.message}`, 'T4');
      }
    }
  }

  $('file').addEventListener('change', (e) => { loadFiles(Array.from(e.target.files)); e.target.value = ''; });
  const drop = $('drop');
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); loadFiles(Array.from(e.dataTransfer.files)); });

  const blankStep = (h, m, ch, jump) => ({ hour: h, minute: m, ch: ch || [0, 0, 0, 0, 0], jump: jump || [false, false, false, false, false] });

  $('btn-new-mode').addEventListener('click', () => {
    addMode(`MODE${modes.length + 1}`.slice(0, 8), { deviceType: 0, deviceName: 'TC420', channels: 5, third: 3, steps: [blankStep(0, 0), blankStep(12, 0, [50, 50, 50, 50, 0])], warnings: [] });
    log('info', 'leeg schema aangemaakt', 'T4');
  });

  $('btn-test-mode').addEventListener('click', () => {
    const now = new Date();
    const start = now.getHours() * 60 + now.getMinutes() + 2;
    if (start + 6 >= 1439 || start < 2) { log('fout', 'testschema kan niet rond middernacht; probeer het na 00:05 of vóór 23:50', 'T4'); return; }
    const hm = (t) => [Math.floor(t / 60), t % 60];
    const steps = [
      blankStep(0, 0),
      blankStep(...hm(start)),
      blankStep(...hm(start + 3), [100, 100, 0, 0, 0], [false, true, false, false, false]),
      blankStep(...hm(start + 6), [0, 0, 0, 0, 0], [false, true, false, false, false]),
      blankStep(23, 59),
    ];
    addMode('FADETEST', { deviceType: 0, deviceName: 'TC420', channels: 5, third: 3, steps, warnings: [] });
    log('info', `testschema FADETEST gemaakt: CH1 fade en CH2 springen tussen ${T.timeLabel(...hm(start))} en ${T.timeLabel(...hm(start + 6))}`, 'T4');
  });

  function renderModes() {
    const box = $('modes');
    box.innerHTML = '';
    if (!modes.length) { box.append(el('p', { class: 'note' }, "Nog geen schema's.")); return; }
    const startBank = Number($('start-bank').value) || 0;
    modes.forEach((m, i) => {
      const item = el('div', { class: `mode-item${i === selected ? ' sel' : ''}` });
      const name = el('input', { type: 'text', maxlength: '8', size: '9', value: m.name });
      name.addEventListener('change', () => { m.name = name.value.trim().slice(0, 8) || m.name; name.value = m.name; });
      const w = T.checkSteps(m.schema.steps);
      item.append(el('span', { class: 'tid' }, `bank ${startBank + i}`), name,
        el('span', { class: 'meta' }, `${m.schema.steps.length} stappen${w.length ? ` · ${w.length} waarschuwing(en)` : ''}`));
      const edit = el('button', { class: 'small' }, 'Bewerken');
      edit.addEventListener('click', () => { selected = i; renderModes(); renderEditor(); });
      const up = el('button', { class: 'small' }, '↑');
      up.disabled = i === 0;
      up.addEventListener('click', () => { [modes[i - 1], modes[i]] = [modes[i], modes[i - 1]]; selected = i - 1; renderModes(); renderEditor(); });
      const del = el('button', { class: 'small' }, 'Verwijderen');
      del.addEventListener('click', () => { modes.splice(i, 1); selected = Math.min(selected, modes.length - 1); renderModes(); renderEditor(); });
      item.append(edit, up, del);
      box.append(item);
    });
  }
  $('start-bank').addEventListener('change', renderModes);

  function renderChart(container, legend, steps) {
    const W = 760, H = 250, x0 = 40, x1 = 744, y0 = 12, y1 = 214;
    const now = new Date();
    const nowM = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
    const zoom = $('chart-zoom').checked;
    const from = zoom ? Math.max(0, Math.min(1380, Math.floor(nowM / 10) * 10 - 10)) : 0;
    const to = zoom ? from + 60 : 1440;
    const tickStep = zoom ? 10 : 180;
    const X = (m) => x0 + ((m - from) / (to - from)) * (x1 - x0);
    const Y = (v) => y1 - (v / 100) * (y1 - y0);
    let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Verwacht verloop per kanaal">`;
    [0, 50, 100].forEach((v) => { svg += `<line x1="${x0}" x2="${x1}" y1="${Y(v)}" y2="${Y(v)}" class="grid"/><text x="${x0 - 6}" y="${Y(v) + 4}" text-anchor="end" class="tick">${v}</text>`; });
    for (let m = Math.ceil(from / tickStep) * tickStep; m <= to; m += tickStep) {
      svg += `<line x1="${X(m)}" x2="${X(m)}" y1="${y0}" y2="${y1}" class="grid"/><text x="${X(m)}" y="${y1 + 16}" text-anchor="middle" class="tick">${T.timeLabel(Math.floor(m / 60) % 24 || (m === 1440 ? 24 : 0), m % 60)}</text>`;
    }
    svg += `<line x1="${X(nowM)}" x2="${X(nowM)}" y1="${y0}" y2="${y1}" stroke="var(--quiet)" stroke-dasharray="3 3"/>`;
    const used = [];
    const sample = (to - from) / 360;
    for (let c = 0; c < 5; c++) {
      if (steps.every((s) => !s.ch[c])) continue;
      used.push(c);
      let d = '';
      for (let t = from; t <= to; t += sample) d += `${t === from ? 'M' : 'L'}${X(t).toFixed(1)} ${Y(T.valuesAt(steps, Math.min(t, 1439.99))[c]).toFixed(1)}`;
      svg += `<path d="${d}" fill="none" stroke="${CH_COLORS[c]}" stroke-width="2"/>`;
    }
    svg += '</svg>';
    container.innerHTML = svg;
    legend.innerHTML = '';
    for (let c = 0; c < 5; c++) {
      const s = el('span', {}, `CH${c + 1}${used.includes(c) ? '' : ' (0 %)'}`);
      const i = el('i');
      i.style.background = CH_COLORS[c];
      s.prepend(i);
      legend.append(s);
    }
    legend.append(el('span', { class: 'note' }, `stippellijn = nu (${T.timeLabel(now.getHours(), now.getMinutes())}); verwacht nu: ${T.valuesAt(steps, nowM).join(' / ')} %`));
  }

  function renderEditor() {
    const m = modes[selected];
    $('editor').hidden = !m;
    if (!m) return;
    const steps = m.schema.steps;
    $('editor-title').textContent = `Bewerken: ${m.name}`;
    const warn = T.checkSteps(steps);
    $('editor-warnings').innerHTML = '';
    warn.forEach((w) => $('editor-warnings').append(el('li', {}, w)));
    renderChart($('editor-chart'), $('editor-legend'), steps);
    const table = $('editor-table');
    table.innerHTML = '';
    const head = el('tr');
    ['#', 'Tijd', 'CH1', 'CH2', 'CH3', 'CH4', 'CH5', 'Springen', ''].forEach((h) => head.append(el('th', {}, h)));
    table.append(head);
    steps.forEach((s, i) => {
      const tr = el('tr');
      tr.append(el('td', {}, String(i + 1)));
      const time = el('input', { type: 'time', value: T.timeLabel(s.hour, s.minute) });
      time.addEventListener('change', () => { const [h, mi] = time.value.split(':').map(Number); if (h >= 0) { s.hour = h; s.minute = mi; renderEditor(); renderModes(); } });
      const tdTime = el('td');
      tdTime.append(time);
      tr.append(tdTime);
      for (let c = 0; c < 5; c++) {
        const inp = el('input', { type: 'number', min: '0', max: '100', value: String(s.ch[c]) });
        inp.addEventListener('change', () => { s.ch[c] = Math.max(0, Math.min(100, Number(inp.value) || 0)); inp.value = s.ch[c]; renderChart($('editor-chart'), $('editor-legend'), steps); });
        const td = el('td');
        td.append(inp);
        tr.append(td);
      }
      const tdJ = el('td', { class: 'jumps' });
      for (let c = 0; c < 5; c++) {
        const lab = el('label');
        const cb = el('input', { type: 'checkbox' });
        cb.checked = !!s.jump[c];
        cb.addEventListener('change', () => { s.jump[c] = cb.checked; renderChart($('editor-chart'), $('editor-legend'), steps); });
        lab.append(cb, document.createTextNode(String(c + 1)));
        tdJ.append(lab);
      }
      tr.append(tdJ);
      const del = el('button', { class: 'small' }, '×');
      del.addEventListener('click', () => { steps.splice(i, 1); renderEditor(); renderModes(); });
      const tdDel = el('td');
      tdDel.append(del);
      tr.append(tdDel);
      table.append(tr);
    });
  }

  $('chart-zoom').addEventListener('change', () => { if (modes[selected]) renderChart($('editor-chart'), $('editor-legend'), modes[selected].schema.steps); });

  $('btn-add-step').addEventListener('click', () => {
    const m = modes[selected];
    if (!m) return;
    if (m.schema.steps.length >= T.MAX_STEPS) { log('fout', `maximaal ${T.MAX_STEPS} stappen`, 'T4'); return; }
    const last = m.schema.steps[m.schema.steps.length - 1];
    const t = last ? Math.min(1439, last.hour * 60 + last.minute + 30) : 0;
    m.schema.steps.push(blankStep(Math.floor(t / 60), t % 60, last ? last.ch.slice() : undefined));
    renderEditor();
    renderModes();
  });
  $('btn-sort').addEventListener('click', () => {
    const m = modes[selected];
    if (!m) return;
    m.schema.steps.sort((a, b) => (a.hour * 60 + a.minute) - (b.hour * 60 + b.minute));
    renderEditor();
  });
  $('btn-export-tmf').addEventListener('click', () => {
    const m = modes[selected];
    if (!m) return;
    download(`${m.name}.tmf`, T.serializeTmf(m.schema), 'application/octet-stream');
    log('info', `schema ${m.name} opgeslagen als .tmf (${m.schema.steps.length} stappen)`, 'T4');
  });

  // ---------- T5 download ----------

  $('btn-download').addEventListener('click', async () => {
    if (!modes.length) { log('fout', "geen schema's om te downloaden; laad of maak er eerst een in T4", 'T5'); return; }
    if (playing) await stopPlay();
    const startBank = Number($('start-bank').value) || 0;
    if (startBank + modes.length > T.MAX_BANKS) { log('fout', `banken ${startBank}–${startBank + modes.length - 1} vallen buiten 0–${T.MAX_BANKS - 1}`, 'T5'); return; }
    const bad = modes.filter((m) => m.schema.steps.length < 2 || m.schema.steps.length > T.MAX_STEPS);
    if (bad.length) { log('fout', `ongeldig aantal stappen in: ${bad.map((m) => m.name).join(', ')}`, 'T5'); return; }
    const summary = modes.map((m, i) => {
      const w = T.checkSteps(m.schema.steps);
      return `bank ${startBank + i}: ${m.name} (${m.schema.steps.length} stappen)${w.length ? ` – let op: ${w.join('; ')}` : ''}`;
    }).join('\n');
    if (!confirm(`Deze programma's op de controller overschrijven?\n\n${summary}`)) { log('info', 'download geannuleerd', 'T5'); return; }
    log('info', `download gestart · ${modes.length} schema('s) · ${summary.replace(/\n/g, '; ')}`, 'T5');
    let ok = true;
    let sentSteps = 0;
    const total = modes.reduce((s, m) => s + m.schema.steps.length, 0);
    outer: for (let i = 0; i < modes.length; i++) {
      const m = modes[i];
      const bank = startBank + i;
      $('dl-progress').textContent = `bank ${bank}: ${m.name} …`;
      const r1 = await send(T.CMD.MODE_INIT, T.modeInitPayload(bank, m.schema.steps.length, m.name), { test: 'T5' });
      if (!r1.ok) { ok = false; break; }
      for (let k = 0; k < m.schema.steps.length; k++) {
        const r = await send(T.CMD.STEP, T.stepPayload(m.schema.steps[k]), { test: 'T5' });
        if (!r.ok) { ok = false; break outer; }
        sentSteps++;
        $('dl-progress').textContent = `bank ${bank}: ${m.name} · stap ${k + 1}/${m.schema.steps.length} · totaal ${sentSteps}/${total}`;
      }
      await send(T.CMD.END_MODE, [], { test: 'T5', expectReply: false });
    }
    const end = await send(T.CMD.END, [], { test: 'T5' });
    ok = ok && end.ok;
    $('dl-progress').textContent = ok ? 'Download geslaagd' : 'Download mislukt (zie logboek)';
    log(ok ? 'info' : 'fout', ok ? `download geslaagd: ${modes.length} schema('s), ${sentSteps} stappen` : `download mislukt na ${sentSteps} van ${total} stappen`, 'T5');
    setLast('T5', ok, ok ? `${modes.length} schema('s) gedownload` : 'mislukt');
  });

  // ---------- T6 clear ----------

  $('btn-clear').addEventListener('click', async () => {
    const answer = prompt('Typ WISSEN om alle programma\'s op de controller te wissen.');
    if (answer !== 'WISSEN') { log('info', 'wissen geannuleerd', 'T6'); return; }
    if (playing) await stopPlay();
    const r = await send(T.CMD.CLEAR_ALL, [], { test: 'T6' });
    setLast('T6', r.ok, r.ok ? 'alles gewist, bevestigd' : 'niet bevestigd');
  });

  // ---------- T7 raw ----------

  $('btn-raw').addEventListener('click', async () => {
    let cmd;
    let payload;
    try {
      [cmd] = T.parseHexBytes($('raw-cmd').value);
      payload = $('raw-payload').value.trim() ? T.parseHexBytes($('raw-payload').value) : [];
      if (cmd === undefined) throw new Error('geen commando');
    } catch (e) { log('fout', e.message, 'T7'); return; }
    if (!confirm(`Commando 0x${cmd.toString(16).padStart(2, '0')} met ${payload.length} bytes payload versturen?`)) return;
    const r = await send(cmd, payload, { test: 'T7', expectReply: $('raw-expect').checked });
    setLast('T7', r.ok, r.ok ? 'bevestigd' : (r.error || 'geen OK'));
  });

  // ---------- startup ----------

  entries.forEach(renderEntry);
  $('log').scrollTop = $('log').scrollHeight;
  startSession();
  if (SIM) { $('sim-badge').hidden = false; $('sim-note').hidden = false; }
  if (!SIM && !('hid' in navigator)) {
    $('unsupported').hidden = false;
    $('btn-connect').disabled = true;
    log('fout', 'deze browser ondersteunt geen WebHID');
  } else if (!SIM) {
    navigator.hid.addEventListener('disconnect', (e) => {
      if (device && e.device === device) {
        playing = false;
        device = null;
        updateButtons();
        log('fout', 'TC420 losgekoppeld', 'T1');
      }
    });
    navigator.hid.getDevices().then((devs) => {
      const dev = devs.find((d) => d.vendorId === T.VENDOR_ID && d.productId === T.PRODUCT_ID);
      if (dev) openDevice(dev, 'automatisch opnieuw verbonden').catch((e) => log('fout', `automatisch verbinden mislukt: ${e.message}`, 'T1'));
    });
  }
  updateButtons();
  window.tc420app = { loadBuffers: (list) => list.forEach(([name, buf]) => { const s = T.parseTmf(buf); addMode(nameFromFile(name), s); }) };
})();
