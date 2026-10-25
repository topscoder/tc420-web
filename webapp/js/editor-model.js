// Pure editing operations on a program's steps. Steps are always kept sorted by
// time with unique times; every operation returns a new array (or null when it
// is not allowed) so the UI can keep undo history and refuse invalid edits.
import { MAX_STEPS, clampPct } from './protocol.js';
import { valuesAt } from './schedule.js';

export const DAY = 1440;
export const CHANNELS = 5;

export const minutesOf = (s) => s.hour * 60 + s.minute;
const fromMinutes = (m) => ({ hour: Math.floor(m / 60), minute: m % 60 });
const copy = (s) => ({ hour: s.hour, minute: s.minute, ch: s.ch.slice(), jump: s.jump.slice() });

export function sortSteps(steps) {
  return steps.map(copy).sort((a, b) => minutesOf(a) - minutesOf(b));
}

// True when every step has the same level and fade/instant setting on all channels.
export function isLinked(steps) {
  return steps.every((s) => s.ch.every((v) => v === s.ch[0]) && s.jump.every((j) => j === s.jump[0]));
}

// Makes all channels follow channel 1 (used when the user links the channels).
export function linkChannels(steps) {
  return steps.map((s) => ({
    ...copy(s),
    ch: Array(CHANNELS).fill(s.ch[0]),
    jump: Array(CHANNELS).fill(s.jump[0]),
  }));
}

export function hasTime(steps, minutes, exceptIndex = -1) {
  return steps.some((s, i) => i !== exceptIndex && minutesOf(s) === minutes);
}

// Adds a step at the given minute with the levels the controller would show
// there, so the curve does not change until the user edits the new step.
export function addStep(steps, minutes) {
  const m = Math.max(0, Math.min(DAY - 1, Math.round(minutes)));
  if (steps.length >= MAX_STEPS || hasTime(steps, m)) return null;
  const ch = steps.length ? valuesAt(steps, m) : [0, 0, 0, 0, 0];
  return sortSteps([...steps, { ...fromMinutes(m), ch, jump: [false, false, false, false, false] }]);
}

// A free minute for a new step: halfway into the largest gap after the last step, else the first free slot.
export function suggestTime(steps) {
  if (!steps.length) return 0;
  const sorted = sortSteps(steps);
  let best = -1;
  let bestGap = 0;
  sorted.forEach((s, i) => {
    const next = i + 1 < sorted.length ? minutesOf(sorted[i + 1]) : DAY + minutesOf(sorted[0]);
    const gap = next - minutesOf(s);
    if (gap > bestGap) {
      bestGap = gap;
      best = (minutesOf(s) + Math.floor(gap / 2)) % DAY;
    }
  });
  if (best >= 0 && !hasTime(sorted, best)) return best;
  for (let m = 0; m < DAY; m++) if (!hasTime(sorted, m)) return m;
  return null;
}

export function removeStep(steps, index) {
  if (steps.length <= 2 || index < 0 || index >= steps.length) return null;
  return steps.filter((_, i) => i !== index).map(copy);
}

// Moves step `index` to a new minute; null when another step already has that time.
export function moveStep(steps, index, minutes) {
  const m = Math.max(0, Math.min(DAY - 1, Math.round(minutes)));
  if (hasTime(steps, m, index)) return null;
  const next = steps.map(copy);
  Object.assign(next[index], fromMinutes(m));
  return sortSteps(next);
}

// channel = null sets all channels (linked mode).
export function setLevel(steps, index, channel, value) {
  const v = clampPct(value);
  const next = steps.map(copy);
  if (channel === null) next[index].ch = Array(CHANNELS).fill(v);
  else next[index].ch[channel] = v;
  return next;
}

export function setJump(steps, index, channel, jump) {
  const next = steps.map(copy);
  if (channel === null) next[index].jump = Array(CHANNELS).fill(!!jump);
  else next[index].jump[channel] = !!jump;
  return next;
}

export function indexAt(steps, minutes) {
  return steps.findIndex((s) => minutesOf(s) === minutes);
}

// Undo/redo of editor snapshots ({ steps, linked }), at most `limit` deep.
export class History {
  constructor(limit = 100) {
    this.limit = limit;
    this.past = [];
    this.future = [];
  }

  push(snapshot) {
    this.past.push(structuredClone(snapshot));
    if (this.past.length > this.limit) this.past.shift();
    this.future = [];
  }

  undo(current) {
    if (!this.past.length) return null;
    this.future.push(structuredClone(current));
    return this.past.pop();
  }

  redo(current) {
    if (!this.future.length) return null;
    this.past.push(structuredClone(current));
    return this.future.pop();
  }

  get canUndo() {
    return this.past.length > 0;
  }

  get canRedo() {
    return this.future.length > 0;
  }
}
