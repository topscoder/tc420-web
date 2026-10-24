// TC420 USB HID protocol: packet building and reply parsing.
// Sources: decompilation of PLed.exe 1.1 and the hardware-tested wallneradam/tc420
// Python library (GPL-3, used as a protocol reference only). See docs/ for evidence.

export const VENDOR_ID = 0x0888;
export const PRODUCT_ID = 0x4000;

export const CMD = {
  END_MODE: 0x01, // after the steps of one mode; the device sends no reply
  END: 0x02, // after all modes, and to leave online play
  CLEAR_ALL: 0x03,
  SET_CLOCK: 0x11,
  MODE_INIT: 0x12, // bank, step count, name
  STEP: 0x13, // hh, mm, CH1..CH5, jump bits
  PLAY_INIT: 0x15, // name, 00 7F
  PLAY_VALUES: 0x16, // F5, CH1..CH5, 00
};

export const CMD_NAMES = {
  0x01: 'einde modus',
  0x02: 'einde / stop',
  0x03: 'alles wissen',
  0x11: 'klok zetten',
  0x12: 'modus-header',
  0x13: 'stap',
  0x15: 'online play start',
  0x16: 'live waarden',
};

export const MAX_STEPS = 50;
export const MAX_BANKS = 50; // PLed refuses more than 50 modes; the library allows 64
export const NAME_LEN = 8;

// Full 65-byte buffer as PLed builds it (byte 0 = HID report ID 0x00):
// 00 55 AA CMD LEN_HI LEN_LO payload… (zero) … CHK@62 0D 0A
export function buildFrame(cmd, payload = []) {
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
export function frameToReport(frame) {
  return { reportId: frame[0], data: frame.slice(1) };
}

function asciiName(name) {
  const clean = String(name).trim();
  if (!clean) throw new Error('naam is leeg');
  return Array.from(clean.slice(0, NAME_LEN), (ch) => {
    const c = ch.charCodeAt(0);
    return c >= 0x20 && c < 0x7f ? c : 0x3f; // '?' like the library's errors='replace'
  });
}

export function clampPct(v) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0;
}

export function clockPayload(date) {
  const y = date.getFullYear();
  return [y >> 8, y & 0xff, date.getMonth() + 1, date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds()];
}

export function modeInitPayload(bank, stepCount, name) {
  if (!(bank >= 0 && bank < MAX_BANKS)) throw new Error(`bank moet tussen 0 en ${MAX_BANKS - 1} liggen`);
  if (stepCount < 2 || stepCount > MAX_STEPS) throw new Error(`aantal stappen moet tussen 2 en ${MAX_STEPS} liggen`);
  return [bank, stepCount, ...asciiName(name)];
}

// step: { hour, minute, ch: [5], jump: [5] booleans }; jump bit set = no fade.
export function stepPayload(step) {
  const ch = [0, 0, 0, 0, 0];
  (step.ch || []).forEach((v, i) => {
    if (i < 5) ch[i] = clampPct(v);
  });
  let bits = 0;
  (step.jump || []).forEach((j, i) => {
    if (j && i < 5) bits |= 1 << i;
  });
  return [step.hour, step.minute, ...ch, bits];
}

export function playInitPayload(name) {
  return [...asciiName(name), 0x00, 0x7f];
}

export function playValuesPayload(ch) {
  const v = [0, 0, 0, 0, 0];
  (ch || []).forEach((x, i) => {
    if (i < 5) v[i] = clampPct(x);
  });
  return [0xf5, ...v, 0x00];
}

// Reply data as WebHID delivers it (64 bytes, no report ID). Observed on a
// real TC420: 00 00 CMD 00 01 00 … The library reads bytes 3..4 as a
// big-endian length and byte 5 as the result, and treats len 1 + result 0 as
// OK. PLed only checks byte 4 == 1. On errors the device is said to echo the
// sent packet from position 2.
export function parseResponse(d) {
  const len = d.length > 4 ? (d[3] << 8) | d[4] : null;
  const result = d.length > 5 ? d[5] : null;
  return {
    cmd: d.length > 2 ? d[2] : null,
    len,
    result,
    ok: len === 1 && result === 0,
    pledOk: d.length > 4 && d[4] === 1,
  };
}

export function toHex(bytes, limit = bytes.length) {
  return Array.from(bytes.slice(0, limit), (x) => x.toString(16).padStart(2, '0').toUpperCase()).join(' ');
}

export function describeFrame(frame) {
  return `${toHex(frame, 6 + frame[5])} … ${toHex(frame.slice(62))}`;
}

export function parseHexBytes(text) {
  return String(text)
    .trim()
    .split(/[\s,]+/)
    .filter(Boolean)
    .map((p) => {
      if (!/^(0x)?[0-9a-f]{1,2}$/i.test(p)) throw new Error(`ongeldige byte: ${p}`);
      return parseInt(p.replace(/^0x/i, ''), 16);
    });
}
