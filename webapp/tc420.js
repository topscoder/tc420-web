// TC420 protocol and .tmf file handling.
// Sources: decompilation of PLed.exe 1.1 (see "TC420 / PLed – Technisch ontwerp")
// and the hardware-tested wallneradam/tc420 Python library (GPL-3, used as a
// protocol reference only). Classic script so the page also works from file://.
(function (root) {
  'use strict';

  const VENDOR_ID = 0x0888;
  const PRODUCT_ID = 0x4000;

  const CMD = {
    END_MODE: 0x01,      // after the steps of one mode; the device sends no reply
    END: 0x02,           // after all modes, and to leave online play
    CLEAR_ALL: 0x03,
    SET_CLOCK: 0x11,
    MODE_INIT: 0x12,     // bank, step count, name
    STEP: 0x13,          // hh, mm, CH1..CH5, jump bits
    PLAY_INIT: 0x15,     // name, 00 7F
    PLAY_VALUES: 0x16,   // F5, CH1..CH5, 00
  };

  const CMD_NAMES = {
    0x01: 'einde modus',
    0x02: 'einde / stop',
    0x03: 'alles wissen',
    0x11: 'klok zetten',
    0x12: 'modus-header',
    0x13: 'stap',
    0x15: 'online play start',
    0x16: 'live waarden',
  };

  const MAX_STEPS = 50;
  const MAX_BANKS = 50;   // PLed refuses more than 50 modes; the library allows 64
  const NAME_LEN = 8;

  // Full 65-byte buffer as PLed builds it (byte 0 = HID report ID 0x00):
  // 00 55 AA CMD LEN_HI LEN_LO payload… (zero) … CHK@62 0D 0A
  function buildFrame(cmd, payload) {
    payload = payload || [];
    if (payload.length > 56) throw new Error('payload te lang (max. 56 bytes)');
    const b = new Uint8Array(65);
    b[1] = 0x55;
    b[2] = 0xaa;
    b[3] = cmd;
    b[4] = 0x00;
    b[5] = payload.length;
    b.set(payload, 6);
    let sum = 0;
    for (let i = 1; i < 6 + payload.length; i++) sum += b[i];
    b[62] = sum & 0xff;
    b[63] = 0x0d;
    b[64] = 0x0a;
    return b;
  }

  // WebHID's sendReport takes the report ID separately, so the data is bytes 1..64.
  function frameToReport(frame) {
    return { reportId: frame[0], data: frame.slice(1) };
  }

  function asciiName(name) {
    const clean = String(name).trim();
    if (!clean) throw new Error('naam is leeg');
    const bytes = [];
    for (const ch of clean.slice(0, NAME_LEN)) {
      const c = ch.charCodeAt(0);
      bytes.push(c >= 0x20 && c < 0x7f ? c : 0x3f); // '?' like the library's errors='replace'
    }
    return bytes;
  }

  function clampPct(v) {
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0;
  }

  function clockPayload(date) {
    const y = date.getFullYear();
    return [y >> 8, y & 0xff, date.getMonth() + 1, date.getDate(),
      date.getHours(), date.getMinutes(), date.getSeconds()];
  }

  function modeInitPayload(bank, stepCount, name) {
    if (!(bank >= 0 && bank < MAX_BANKS)) throw new Error(`bank moet tussen 0 en ${MAX_BANKS - 1} liggen`);
    if (stepCount < 2 || stepCount > MAX_STEPS) throw new Error(`aantal stappen moet tussen 2 en ${MAX_STEPS} liggen`);
    return [bank, stepCount].concat(asciiName(name));
  }

  // step: { hour, minute, ch: [5], jump: [5] booleans }; jump bit set = no fade.
  function stepPayload(step) {
    const ch = [0, 0, 0, 0, 0];
    (step.ch || []).forEach(function (v, i) { if (i < 5) ch[i] = clampPct(v); });
    let bits = 0;
    (step.jump || []).forEach(function (j, i) { if (j && i < 5) bits |= 1 << i; });
    return [step.hour, step.minute].concat(ch, [bits]);
  }

  function playInitPayload(name) {
    return asciiName(name).concat([0x00, 0x7f]);
  }

  function playValuesPayload(ch) {
    const v = [0, 0, 0, 0, 0];
    (ch || []).forEach(function (x, i) { if (i < 5) v[i] = clampPct(x); });
    return [0xf5].concat(v, [0x00]);
  }

  // Reply data as WebHID delivers it (64 bytes, no report ID). Observed on a
  // real TC420 for 0x11: 00 00 11 00 01 00 … The library reads bytes 3..4 as a
  // big-endian length and byte 5 as the result, and treats len 1 + result 0 as
  // OK. PLed only checks byte 4 == 1. On errors the device is said to echo the
  // sent packet from position 2.
  function parseResponse(data) {
    const d = data;
    const len = d.length > 4 ? (d[3] << 8) | d[4] : null;
    const result = d.length > 5 ? d[5] : null;
    return {
      cmd: d.length > 2 ? d[2] : null,
      len: len,
      result: result,
      ok: len === 1 && result === 0,
      pledOk: d.length > 4 && d[4] === 1,
    };
  }

  function toHex(bytes, limit) {
    const n = limit === undefined ? bytes.length : limit;
    return Array.prototype.slice.call(bytes, 0, n)
      .map(function (x) { return x.toString(16).padStart(2, '0').toUpperCase(); }).join(' ');
  }

  function describeFrame(frame) {
    const len = frame[5];
    return toHex(frame, 6 + len) + ' … ' + toHex(frame.slice(62));
  }

  function parseHexBytes(text) {
    const parts = String(text).trim().split(/[\s,]+/).filter(Boolean);
    return parts.map(function (p) {
      const v = parseInt(p.replace(/^0x/i, ''), 16);
      if (!(v >= 0 && v <= 255) || !/^(0x)?[0-9a-f]{1,2}$/i.test(p)) throw new Error('ongeldige byte: ' + p);
      return v;
    });
  }

  // ---------- .tmf ----------

  const DEVICE_TYPES = { 0: 'TC420', 1: 'GM430' };
  const STEP_SIZE = 0x38;
  const HEADER_SIZE = 12;

  function timeLabel(h, m) {
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  }

  function checkSteps(steps) {
    const warnings = [];
    if (steps.length < 2) warnings.push('minder dan 2 stappen: de controller weigert dit');
    if (steps.length > MAX_STEPS) warnings.push('meer dan ' + MAX_STEPS + ' stappen');
    steps.forEach(function (s, i) {
      if (s.hour > 23 || s.minute > 59) warnings.push('stap ' + (i + 1) + ': ongeldige tijd ' + s.hour + ':' + s.minute);
      if (i > 0) {
        const prev = steps[i - 1].hour * 60 + steps[i - 1].minute;
        const cur = s.hour * 60 + s.minute;
        if (cur === prev) warnings.push('stap ' + (i + 1) + ' heeft dezelfde tijd als stap ' + i);
        else if (cur < prev) warnings.push('stap ' + (i + 1) + ' (' + timeLabel(s.hour, s.minute) + ') ligt vóór stap ' + i + ' (' + timeLabel(steps[i - 1].hour, steps[i - 1].minute) + ')');
      }
    });
    return warnings;
  }

  // .tmf: three u32 LE (device type, channel count, third field) then 56-byte
  // step records until EOF. Hour +4, minute +5, channels +0x2c, flags +0x31.
  function parseTmf(buffer) {
    const bytes = new Uint8Array(buffer);
    if (bytes.length < HEADER_SIZE) throw new Error('bestand is te kort voor een .tmf-header');
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const deviceType = view.getUint32(0, true);
    const channels = view.getUint32(4, true);
    const third = view.getUint32(8, true);
    if (channels < 1 || channels > 5) throw new Error('onverwacht aantal kanalen: ' + channels);
    const warnings = [];
    if (deviceType !== 0) warnings.push('apparaattype is ' + (DEVICE_TYPES[deviceType] || deviceType) + ', niet TC420');
    const rest = bytes.length - HEADER_SIZE;
    if (rest % STEP_SIZE !== 0) warnings.push((rest % STEP_SIZE) + ' losse bytes aan het eind genegeerd');
    const steps = [];
    for (let off = HEADER_SIZE; off + STEP_SIZE <= bytes.length; off += STEP_SIZE) {
      const r = bytes.subarray(off, off + STEP_SIZE);
      const ch = [0, 0, 0, 0, 0];
      const jump = [false, false, false, false, false];
      for (let c = 0; c < channels; c++) {
        ch[c] = r[0x2c + c];
        jump[c] = r[0x31 + c] !== 0;
      }
      steps.push({ hour: r[4], minute: r[5], ch: ch, jump: jump });
    }
    return {
      deviceType: deviceType,
      deviceName: DEVICE_TYPES[deviceType] || ('onbekend (' + deviceType + ')'),
      channels: channels,
      third: third,
      steps: steps,
      warnings: warnings.concat(checkSteps(steps)),
    };
  }

  // Writes a .tmf that PLed can import (padding bytes are written as zero).
  function serializeTmf(schema) {
    const steps = schema.steps;
    const out = new Uint8Array(HEADER_SIZE + STEP_SIZE * steps.length);
    const view = new DataView(out.buffer);
    view.setUint32(0, schema.deviceType || 0, true);
    view.setUint32(4, schema.channels || 5, true);
    view.setUint32(8, schema.third === undefined ? 3 : schema.third, true);
    steps.forEach(function (s, i) {
      const off = HEADER_SIZE + i * STEP_SIZE;
      out[off + 4] = s.hour;
      out[off + 5] = s.minute;
      for (let c = 0; c < 5; c++) {
        out[off + 0x2c + c] = clampPct(s.ch[c]);
        out[off + 0x31 + c] = s.jump[c] ? 1 : 0;
      }
    });
    return out;
  }

  // Channel values at minute-of-day t, as the controller is expected to show
  // them: linear between steps unless the target channel jumps.
  function valuesAt(steps, t) {
    const sorted = steps.slice().sort(function (a, b) { return (a.hour * 60 + a.minute) - (b.hour * 60 + b.minute); });
    if (!sorted.length) return [0, 0, 0, 0, 0];
    const mins = function (s) { return s.hour * 60 + s.minute; };
    let i = sorted.length - 1;
    for (let k = 0; k < sorted.length; k++) if (mins(sorted[k]) <= t) i = k;
    if (t < mins(sorted[0])) i = sorted.length - 1;
    const a = sorted[i];
    const b = sorted[(i + 1) % sorted.length];
    let span = mins(b) - mins(a);
    if (span <= 0) span += 1440;
    let pos = t - mins(a);
    if (pos < 0) pos += 1440;
    const f = Math.min(1, pos / span);
    return [0, 1, 2, 3, 4].map(function (c) {
      return b.jump[c] ? a.ch[c] : Math.round(a.ch[c] + (b.ch[c] - a.ch[c]) * f);
    });
  }

  const api = {
    VENDOR_ID: VENDOR_ID, PRODUCT_ID: PRODUCT_ID, CMD: CMD, CMD_NAMES: CMD_NAMES,
    MAX_STEPS: MAX_STEPS, MAX_BANKS: MAX_BANKS, NAME_LEN: NAME_LEN, DEVICE_TYPES: DEVICE_TYPES,
    buildFrame: buildFrame, frameToReport: frameToReport, clockPayload: clockPayload,
    modeInitPayload: modeInitPayload, stepPayload: stepPayload,
    playInitPayload: playInitPayload, playValuesPayload: playValuesPayload,
    parseResponse: parseResponse, toHex: toHex, describeFrame: describeFrame, parseHexBytes: parseHexBytes,
    parseTmf: parseTmf, serializeTmf: serializeTmf, checkSteps: checkSteps, valuesAt: valuesAt, timeLabel: timeLabel,
  };

  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TC420 = api;
})(this);
