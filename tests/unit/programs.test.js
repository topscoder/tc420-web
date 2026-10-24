import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ProgramStore,
  sanitizeName,
  isValidName,
  parseBackup,
  BackupError,
  programHash,
  BACKUP_FORMAT,
} from '../../webapp/js/programs.js';
import { memoryBackend, localStorageBackend } from '../../webapp/js/storage.js';
import { parseTmf, serializeTmf } from '../../webapp/js/schedule.js';

const winter = parseTmf(readFileSync(new URL('../../schemas/WINTER.tmf', import.meta.url))).steps;
const meta = { app: 'TC420 Web', version: 'test' };

async function freshStore(backend = memoryBackend()) {
  const store = await new ProgramStore({ backend }).load();
  return { store, backend };
}

test('names are strictly 8 characters from A–Z, 0–9, space and "-"', () => {
  assert.equal(sanitizeName('winter'), 'WINTER');
  assert.equal(sanitizeName('Tagesablauf 1'), 'TAGESABL');
  assert.equal(sanitizeName('Zwölf_Uhr'), 'ZWOLF-UH');
  assert.equal(sanitizeName('a  b'), 'A B');
  assert.equal(sanitizeName('  !!  '), 'PROGRAM');
  assert.equal(sanitizeName('', 'OLD'), 'OLD');
  assert.ok(isValidName('ZOMER-2'));
  assert.ok(!isValidName('zomer'));
  assert.ok(!isValidName('TOOLONGNAME'));
  assert.ok(!isValidName(' X'));
});

test('a new store is empty with default settings', async () => {
  const { store } = await freshStore();
  assert.deepEqual(store.programs, []);
  assert.equal(store.selected, null);
  assert.equal(store.settings.multiplePrograms, false);
  assert.deepEqual(store.settings.channelNames, ['CH1', 'CH2', 'CH3', 'CH4', 'CH5']);
});

test('programs and settings survive a reload through the backend', async () => {
  const { store, backend } = await freshStore();
  const p = store.add({ name: 'winter', steps: winter, source: 'tmf' });
  store.setSetting('multiplePrograms', true);
  await store.pendingSave;
  const again = (await freshStore(backend)).store;
  assert.equal(again.programs.length, 1);
  assert.equal(again.programs[0].name, 'WINTER');
  assert.deepEqual(again.programs[0].steps, winter);
  assert.equal(again.selected.id, p.id);
  assert.equal(again.settings.multiplePrograms, true);
});

test('saves happen in order and the last state wins', async () => {
  const { store, backend } = await freshStore();
  const p = store.add({ name: 'A', steps: winter });
  for (let i = 0; i < 5; i++) store.rename(p.id, `A${i}`);
  await store.pendingSave;
  assert.equal((await backend.load()).programs[0].name, 'A4');
});

test('a failing backend is reported but the store keeps working', async () => {
  const backend = {
    load: async () => null,
    save: async () => {
      throw new Error('quota');
    },
  };
  const { store } = await freshStore(backend);
  store.add({ name: 'X', steps: winter });
  await store.pendingSave;
  assert.equal(store.saveError.message, 'quota');
  assert.equal(store.programs.length, 1);
});

test('rename, duplicate, move and remove', async () => {
  const { store } = await freshStore();
  const a = store.add({ name: 'WINTER', steps: winter });
  const b = store.add({ name: 'ZOMER', steps: winter });
  store.rename(a.id, 'winter2!');
  assert.equal(store.get(a.id).name, 'WINTER2');
  const c = store.duplicate(a.id);
  assert.equal(c.name, 'WINTER-2');
  assert.notEqual(c.id, a.id);
  assert.deepEqual(c.steps, a.steps);
  store.move(c.id, -1);
  assert.deepEqual(
    store.programs.map((p) => p.name),
    ['WINTER2', 'WINTER-2', 'ZOMER'],
  );
  store.move(store.programs[0].id, -1); // no-op at the top
  assert.equal(store.programs[0].name, 'WINTER2');
  store.select(b.id);
  store.remove(b.id);
  assert.equal(store.programs.length, 2);
  assert.equal(store.selected.name, 'WINTER-2');
});

test('steps are cleaned on update: clamped, at most 50', async () => {
  const { store } = await freshStore();
  const p = store.add({ name: 'X', steps: winter });
  store.update(p.id, (q) => {
    q.steps[0].ch[0] = 250;
    q.steps[0].hour = 30;
    for (let i = 0; i < 60; i++) q.steps.push({ hour: 1, minute: i % 60, ch: [1], jump: [] });
  });
  assert.equal(store.get(p.id).steps[0].ch[0], 100);
  assert.equal(store.get(p.id).steps[0].hour, 23);
  assert.equal(store.get(p.id).steps.length, 50);
});

test('the library holds at most 50 programs', async () => {
  const { store } = await freshStore();
  for (let i = 0; i < 50; i++) assert.ok(store.add({ name: `P${i}`, steps: winter }));
  assert.equal(store.add({ name: 'ONE MORE', steps: winter }), null);
});

test('remembers what is on the controller and notices later edits', async () => {
  const { store } = await freshStore();
  const a = store.add({ name: 'WINTER', steps: winter });
  const b = store.add({ name: 'ZOMER', steps: winter });
  assert.equal(store.controllerStatus(a.id), null);
  store.markSent([{ id: a.id, bank: 0 }]);
  assert.deepEqual(store.controllerStatus(a.id), { bank: 0, changed: false });
  assert.equal(store.controllerStatus(b.id), null);
  assert.ok(store.lastSentAt);
  store.update(a.id, (q) => {
    q.steps[1].ch[0] = 55;
  });
  assert.deepEqual(store.controllerStatus(a.id), { bank: 0, changed: true });
  store.update(a.id, (q) => {
    q.steps[1].ch[0] = 10;
  });
  assert.equal(store.controllerStatus(a.id).changed, false);
  assert.notEqual(programHash(a), '');
});

test('backup round trip restores programs and settings and keeps the controller state', async () => {
  const { store } = await freshStore();
  const a = store.add({ name: 'WINTER', steps: winter });
  store.setSetting('channelNames', ['White', 'Warm', 'Moon', 'Blue', 'CH5']);
  store.markSent([{ id: a.id, bank: 0 }]);
  const json = store.toBackup(meta);
  const data = JSON.parse(json);
  assert.equal(data.format, BACKUP_FORMAT);
  assert.equal(data.programs.length, 1);

  const other = (await freshStore()).store;
  other.add({ name: 'JUNK', steps: winter });
  other.restore(parseBackup(json));
  assert.deepEqual(
    other.programs.map((p) => p.name),
    ['WINTER'],
  );
  assert.deepEqual(other.settings.channelNames, ['White', 'Warm', 'Moon', 'Blue', 'CH5']);
  assert.deepEqual(other.programs[0].steps, winter);

  store.restore(parseBackup(json));
  assert.deepEqual(store.controllerStatus(a.id), { bank: 0, changed: false });
});

test('invalid backups are rejected with a reason', () => {
  const code = (text) => {
    try {
      parseBackup(text);
      return null;
    } catch (e) {
      assert.ok(e instanceof BackupError);
      return e.code;
    }
  };
  assert.equal(code('not json'), 'notJson');
  assert.equal(code('{"programs":[]}'), 'notBackup');
  assert.equal(code(JSON.stringify({ format: BACKUP_FORMAT, formatVersion: 99, programs: [] })), 'newerVersion');
  assert.equal(code(JSON.stringify({ format: BACKUP_FORMAT, formatVersion: 1, programs: [] })), 'empty');
});

test('a stored program exports to a .tmf identical to the PLed-style file', async () => {
  const { store } = await freshStore();
  const p = store.add({ name: 'WINTER', steps: winter });
  const out = serializeTmf({ deviceType: 0, channels: 5, third: 3, steps: p.steps });
  assert.deepEqual(Buffer.from(out), readFileSync(new URL('../../schemas/WINTER.tmf', import.meta.url)));
});

test('localStorage backend stores the library as JSON', async () => {
  const data = new Map();
  const ls = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) };
  const backend = localStorageBackend(ls);
  const { store } = await freshStore(backend);
  store.add({ name: 'X', steps: winter });
  await store.pendingSave;
  assert.equal(JSON.parse(data.get('tc420-web-library')).programs[0].name, 'X');
  assert.throws(() =>
    localStorageBackend({
      getItem() {
        throw new Error('blocked');
      },
    }),
  );
});
