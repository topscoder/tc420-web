// Schedules (PLed "modes"): .tmf file format, validation and expected channel values.
import { MAX_STEPS, clampPct } from './protocol.js';

export const DEVICE_TYPES = { 0: 'TC420', 1: 'GM430' };
const STEP_SIZE = 0x38;
const HEADER_SIZE = 12;

export function timeLabel(h, m) {
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

const minutes = (s) => s.hour * 60 + s.minute;

export function checkSteps(steps) {
  const warnings = [];
  if (steps.length < 2) warnings.push('minder dan 2 stappen: de controller weigert dit');
  if (steps.length > MAX_STEPS) warnings.push(`meer dan ${MAX_STEPS} stappen`);
  steps.forEach((s, i) => {
    if (s.hour > 23 || s.minute > 59) warnings.push(`stap ${i + 1}: ongeldige tijd ${s.hour}:${s.minute}`);
    if (i > 0) {
      const prev = steps[i - 1];
      if (minutes(s) === minutes(prev)) warnings.push(`stap ${i + 1} heeft dezelfde tijd als stap ${i}`);
      else if (minutes(s) < minutes(prev)) {
        warnings.push(
          `stap ${i + 1} (${timeLabel(s.hour, s.minute)}) ligt vóór stap ${i} (${timeLabel(prev.hour, prev.minute)})`,
        );
      }
    }
  });
  return warnings;
}

// .tmf: three u32 LE (device type, channel count, third field) then 56-byte
// step records until EOF. Hour +4, minute +5, channels +0x2c, flags +0x31.
export function parseTmf(buffer) {
  const bytes = new Uint8Array(buffer);
  if (bytes.length < HEADER_SIZE) throw new Error('bestand is te kort voor een .tmf-header');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const deviceType = view.getUint32(0, true);
  const channels = view.getUint32(4, true);
  const third = view.getUint32(8, true);
  if (channels < 1 || channels > 5) throw new Error(`onverwacht aantal kanalen: ${channels}`);
  const warnings = [];
  if (deviceType !== 0) warnings.push(`apparaattype is ${DEVICE_TYPES[deviceType] || deviceType}, niet TC420`);
  const rest = bytes.length - HEADER_SIZE;
  if (rest % STEP_SIZE !== 0) warnings.push(`${rest % STEP_SIZE} losse bytes aan het eind genegeerd`);
  const steps = [];
  for (let off = HEADER_SIZE; off + STEP_SIZE <= bytes.length; off += STEP_SIZE) {
    const r = bytes.subarray(off, off + STEP_SIZE);
    const ch = [0, 0, 0, 0, 0];
    const jump = [false, false, false, false, false];
    for (let c = 0; c < channels; c++) {
      ch[c] = r[0x2c + c];
      jump[c] = r[0x31 + c] !== 0;
    }
    steps.push({ hour: r[4], minute: r[5], ch, jump });
  }
  return {
    deviceType,
    deviceName: DEVICE_TYPES[deviceType] || `onbekend (${deviceType})`,
    channels,
    third,
    steps,
    warnings: warnings.concat(checkSteps(steps)),
  };
}

// Writes a .tmf that PLed can import (padding bytes are written as zero).
export function serializeTmf(schema) {
  const out = new Uint8Array(HEADER_SIZE + STEP_SIZE * schema.steps.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, schema.deviceType || 0, true);
  view.setUint32(4, schema.channels || 5, true);
  view.setUint32(8, schema.third === undefined ? 3 : schema.third, true);
  schema.steps.forEach((s, i) => {
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
export function valuesAt(steps, t) {
  const sorted = steps.slice().sort((a, b) => minutes(a) - minutes(b));
  if (!sorted.length) return [0, 0, 0, 0, 0];
  let i = sorted.length - 1;
  for (let k = 0; k < sorted.length; k++) if (minutes(sorted[k]) <= t) i = k;
  if (t < minutes(sorted[0])) i = sorted.length - 1;
  const a = sorted[i];
  const b = sorted[(i + 1) % sorted.length];
  let span = minutes(b) - minutes(a);
  if (span <= 0) span += 1440;
  let pos = t - minutes(a);
  if (pos < 0) pos += 1440;
  const f = Math.min(1, pos / span);
  return [0, 1, 2, 3, 4].map((c) => (b.jump[c] ? a.ch[c] : Math.round(a.ch[c] + (b.ch[c] - a.ch[c]) * f)));
}
