// The user's program library: programs, settings and what was last sent to the
// controller. The TC420 cannot be read back, so this is the only copy of the
// user's work; every change is saved through the injected backend.
import { NAME_LEN, MAX_BANKS, MAX_STEPS, clampPct } from './protocol.js';
import { sortSteps, isLinked } from './editor-model.js';

export const STATE_VERSION = 1;
export const BACKUP_FORMAT = 'tc420-web-backup';
export const CHANNELS = 5;

export const DEFAULT_SETTINGS = {
  multiplePrograms: false,
  channelNames: ['CH1', 'CH2', 'CH3', 'CH4', 'CH5'],
  channelColors: ['#2f6fdb', '#e0662f', '#2ea672', '#c9971c', '#9a5bd1'],
};
const COLOR = /^#[0-9a-f]{6}$/i;
export const CHANNEL_NAME_LEN = 12;

const NAME_CHARS = /[^A-Z0-9 -]/g;
const HAS_INVALID = /[^A-Z0-9 -]/;

// Program names are shown on the controller display: strictly 8 characters from
// A–Z, 0–9, space and "-". Accents are dropped, letters become capitals and
// anything else is removed.
export function sanitizeName(raw, fallback = 'PROGRAM') {
  const name = String(raw ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[_.]/g, '-')
    .replace(NAME_CHARS, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, NAME_LEN)
    .trim();
  return name || fallback.slice(0, NAME_LEN);
}

export function isValidName(name) {
  return (
    typeof name === 'string' &&
    name.length >= 1 &&
    name.length <= NAME_LEN &&
    !HAS_INVALID.test(name) &&
    name.trim() === name
  );
}

let counter = 0;
export function newId() {
  counter += 1;
  return `p${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function cleanStep(s) {
  const hour = Math.max(0, Math.min(23, Math.trunc(Number(s?.hour)) || 0));
  const minute = Math.max(0, Math.min(59, Math.trunc(Number(s?.minute)) || 0));
  const ch = Array.from({ length: CHANNELS }, (_, i) => clampPct(s?.ch?.[i]));
  const jump = Array.from({ length: CHANNELS }, (_, i) => !!s?.jump?.[i]);
  return { hour, minute, ch, jump };
}

// Fingerprint of what the controller would receive, to notice edits after sending.
export function programHash(p) {
  return JSON.stringify([p.name, p.steps.map((s) => [s.hour, s.minute, ...s.ch, ...s.jump.map(Number)])]);
}

export function makeProgram({ name, steps = [], source = 'new', id = newId(), linked, now = new Date() } = {}) {
  const stamp = now.toISOString();
  const clean = sortSteps(steps.slice(0, MAX_STEPS).map(cleanStep));
  return {
    id,
    name: sanitizeName(name),
    steps: clean,
    linked: typeof linked === 'boolean' ? linked && isLinked(clean) : isLinked(clean),
    source,
    createdAt: stamp,
    updatedAt: stamp,
  };
}

function emptyState() {
  return {
    version: STATE_VERSION,
    programs: [],
    selectedId: null,
    settings: structuredClone(DEFAULT_SETTINGS),
    controller: null, // { sentAt, entries: [{ id, bank, name, hash }] }
  };
}

function normaliseState(raw) {
  const state = emptyState();
  if (!raw || typeof raw !== 'object') return state;
  state.programs = (Array.isArray(raw.programs) ? raw.programs : [])
    .filter((p) => p && Array.isArray(p.steps))
    .map((p) => ({
      ...makeProgram({
        name: p.name,
        steps: p.steps,
        source: p.source || 'new',
        id: p.id || newId(),
        linked: p.linked,
      }),
      createdAt: p.createdAt || new Date().toISOString(),
      updatedAt: p.updatedAt || new Date().toISOString(),
    }));
  state.selectedId = state.programs.some((p) => p.id === raw.selectedId)
    ? raw.selectedId
    : (state.programs[0]?.id ?? null);
  state.settings = {
    multiplePrograms: !!raw.settings?.multiplePrograms,
    channelNames: DEFAULT_SETTINGS.channelNames.map(
      (d, i) =>
        String(raw.settings?.channelNames?.[i] ?? d)
          .trim()
          .slice(0, CHANNEL_NAME_LEN) || d,
    ),
    channelColors: DEFAULT_SETTINGS.channelColors.map((d, i) =>
      COLOR.test(raw.settings?.channelColors?.[i]) ? raw.settings.channelColors[i] : d,
    ),
  };
  if (raw.controller && Array.isArray(raw.controller.entries)) {
    state.controller = {
      sentAt: String(raw.controller.sentAt || ''),
      entries: raw.controller.entries
        .filter((e) => e && typeof e.id === 'string')
        .map((e) => ({ id: e.id, bank: Number(e.bank) || 0, name: String(e.name || ''), hash: String(e.hash || '') })),
    };
  }
  return state;
}

export class ProgramStore {
  // backend: { load(): Promise<state|null>, save(state): Promise<void> }
  constructor({ backend = null, now = () => new Date() } = {}) {
    this.backend = backend;
    this.now = now;
    this.state = emptyState();
    this.listeners = new Set();
    this.saveError = null;
    this.pendingSave = Promise.resolve();
  }

  async load() {
    try {
      this.state = normaliseState(await this.backend?.load());
    } catch (e) {
      this.saveError = e;
      this.state = emptyState();
    }
    this.emit();
    return this;
  }

  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit() {
    this.listeners.forEach((fn) => fn(this.state));
  }

  // Saves are serialised so an older state never overwrites a newer one.
  commit() {
    const snapshot = structuredClone(this.state);
    this.pendingSave = this.pendingSave
      .then(() => this.backend?.save(snapshot))
      .then(
        () => {
          this.saveError = null;
        },
        (e) => {
          this.saveError = e;
        },
      )
      .then(() => this.emit());
    this.emit();
    return this.pendingSave;
  }

  get programs() {
    return this.state.programs;
  }

  get settings() {
    return this.state.settings;
  }

  get selected() {
    return this.state.programs.find((p) => p.id === this.state.selectedId) || null;
  }

  get(id) {
    return this.state.programs.find((p) => p.id === id) || null;
  }

  // Returns the new program, or null when the library is full.
  add({ name, steps, source = 'new', linked }) {
    if (this.state.programs.length >= MAX_BANKS) return null;
    const p = makeProgram({ name, steps, source, linked, now: this.now() });
    this.state.programs.push(p);
    this.state.selectedId = p.id;
    this.commit();
    return p;
  }

  select(id) {
    if (!this.get(id) || this.state.selectedId === id) return;
    this.state.selectedId = id;
    this.commit();
  }

  // mutate(program) changes the program in place; name and steps are cleaned afterwards.
  update(id, mutate) {
    const p = this.get(id);
    if (!p) return;
    mutate(p);
    p.name = sanitizeName(p.name);
    p.steps = sortSteps(p.steps.slice(0, MAX_STEPS).map(cleanStep));
    p.linked = !!p.linked && isLinked(p.steps);
    p.updatedAt = this.now().toISOString();
    this.commit();
  }

  rename(id, raw) {
    this.update(id, (p) => {
      p.name = sanitizeName(raw, p.name);
    });
  }

  duplicate(id) {
    const p = this.get(id);
    if (!p) return null;
    const base = p.name.slice(0, NAME_LEN - 2).trim();
    let n = 2;
    const taken = new Set(this.state.programs.map((x) => x.name));
    while (taken.has(`${base}-${n}`) && n < 9) n++;
    return this.add({ name: `${base}-${n}`, steps: structuredClone(p.steps), source: p.source, linked: p.linked });
  }

  remove(id) {
    const i = this.state.programs.findIndex((p) => p.id === id);
    if (i < 0) return;
    this.state.programs.splice(i, 1);
    if (this.state.selectedId === id) {
      this.state.selectedId = this.state.programs[Math.min(i, this.state.programs.length - 1)]?.id ?? null;
    }
    this.commit();
  }

  move(id, delta) {
    const list = this.state.programs;
    const i = list.findIndex((p) => p.id === id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    this.commit();
  }

  setSetting(key, value) {
    if (!(key in DEFAULT_SETTINGS)) return;
    this.state.settings = normaliseState({ settings: { ...this.state.settings, [key]: value } }).settings;
    this.commit();
  }

  // entries: [{ id, bank }] that the controller confirmed.
  markSent(entries) {
    this.state.controller = {
      sentAt: this.now().toISOString(),
      entries: entries
        .map(({ id, bank }) => {
          const p = this.get(id);
          return p ? { id, bank, name: p.name, hash: programHash(p) } : null;
        })
        .filter(Boolean),
    };
    this.commit();
  }

  // { bank, changed } when this program is on the controller (as far as we know), else null.
  controllerStatus(id) {
    const entry = this.state.controller?.entries.find((e) => e.id === id);
    if (!entry) return null;
    const p = this.get(id);
    return { bank: entry.bank, changed: !p || programHash(p) !== entry.hash };
  }

  get lastSentAt() {
    return this.state.controller?.sentAt || null;
  }

  toBackup({ app, version }) {
    return JSON.stringify(
      {
        format: BACKUP_FORMAT,
        formatVersion: STATE_VERSION,
        app,
        appVersion: version,
        exported: this.now().toISOString(),
        settings: this.state.settings,
        programs: this.state.programs.map(({ id, name, steps, linked, source, createdAt, updatedAt }) => ({
          id,
          name,
          steps,
          linked,
          source,
          createdAt,
          updatedAt,
        })),
      },
      null,
      2,
    );
  }

  // Replaces programs and settings; the "on controller" state is kept.
  restore(backup) {
    const controller = this.state.controller;
    this.state = normaliseState({ ...backup, controller, selectedId: null });
    this.commit();
  }
}

export class BackupError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

// Parses and checks a backup file; throws BackupError('notJson' | 'notBackup' | 'newerVersion' | 'empty').
export function parseBackup(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new BackupError('notJson');
  }
  if (!data || data.format !== BACKUP_FORMAT || !Array.isArray(data.programs)) throw new BackupError('notBackup');
  if (Number(data.formatVersion) > STATE_VERSION) throw new BackupError('newerVersion');
  const programs = data.programs.filter((p) => p && Array.isArray(p.steps));
  if (!programs.length) throw new BackupError('empty');
  return { programs: programs.slice(0, MAX_BANKS), settings: data.settings };
}
