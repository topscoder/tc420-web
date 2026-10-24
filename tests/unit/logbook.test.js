import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Logbook } from '../../webapp/js/logbook.js';

class MemoryStorage {
  constructor() {
    this.data = new Map();
  }
  getItem(k) {
    return this.data.has(k) ? this.data.get(k) : null;
  }
  setItem(k, v) {
    this.data.set(k, v);
  }
}

const fixedNow = () => new Date('2026-10-24T10:00:00.000Z');

test('entries are saved and restored from storage', () => {
  const storage = new MemoryStorage();
  const a = new Logbook({ storage, now: fixedNow });
  a.add('tx', 'hello', 'T2');
  const b = new Logbook({ storage });
  assert.deepEqual(b.entries, [{ t: '2026-10-24T10:00:00.000Z', kind: 'tx', test: 'T2', text: 'hello' }]);
});

test('listeners are notified of new entries', () => {
  const log = new Logbook({ storage: new MemoryStorage() });
  const seen = [];
  const off = log.onAdd((e) => seen.push(e.text));
  log.add('info', 'one');
  off();
  log.add('info', 'two');
  assert.deepEqual(seen, ['one']);
});

test('broken or missing storage does not break logging', () => {
  const broken = {
    getItem() {
      throw new Error('blocked');
    },
    setItem() {
      throw new Error('full');
    },
  };
  const log = new Logbook({ storage: broken });
  log.add('info', 'still works');
  assert.equal(log.entries.length, 1);
  assert.equal(log.storageOk, false);
  const none = new Logbook();
  none.add('info', 'x');
  assert.equal(none.storageOk, false);
});

test('clear() empties the log and storage', () => {
  const storage = new MemoryStorage();
  const log = new Logbook({ storage });
  log.add('info', 'x');
  log.clear();
  assert.deepEqual(new Logbook({ storage }).entries, []);
});

test('exports as JSON and text', () => {
  const log = new Logbook({ storage: new MemoryStorage(), now: fixedNow });
  log.add('ack', 'OK', 'T2');
  const meta = { app: 'TC420 Web', version: '0.4.0', userAgent: 'UA' };
  const json = JSON.parse(log.toJson(meta));
  assert.equal(json.app, 'TC420 Web');
  assert.equal(json.entries.length, 1);
  assert.equal(log.toText(meta), 'TC420 Web 0.4.0\nUA\n\n2026-10-24T10:00:00.000Z\tACK\tT2\tOK\n');
});
