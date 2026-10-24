import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  parseTmf,
  serializeTmf,
  checkSteps,
  describeWarning,
  valuesAt,
  ScheduleError,
} from '../../webapp/js/schedule.js';

const schema = (name) => readFileSync(new URL(`../../schemas/${name}.tmf`, import.meta.url));
const at = (steps, hhmm) => valuesAt(steps, Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3)));
const step = (hour, minute, ch, jump = [false, false, false, false, false]) => ({ hour, minute, ch, jump });

const EXPECTED_STEPS = { AFRIKA: 21, AMAZONE: 25, THAILAND: 20, WINTER: 9, ZOMER: 9 };

for (const [name, count] of Object.entries(EXPECTED_STEPS)) {
  test(`${name}.tmf parses and round-trips`, () => {
    const buf = schema(name);
    const s = parseTmf(buf);
    assert.equal(s.steps.length, count);
    assert.equal(s.deviceName, 'TC420');
    assert.equal(s.channels, 5);
    assert.equal(s.third, 3);
    const again = serializeTmf(s);
    assert.equal(again.length, buf.length);
    assert.deepEqual(parseTmf(again).steps, s.steps);
  });
}

test('AFRIKA step 2 decodes to 09:00 with the right levels', () => {
  const s = parseTmf(schema('AFRIKA'));
  assert.deepEqual(s.steps[1], step(9, 0, [25, 0, 30, 10, 0]));
});

test('AMAZONE warns about its out-of-order last step', () => {
  assert.deepEqual(parseTmf(schema('AMAZONE')).warnings, [
    { code: 'outOfOrder', step: 25, time: '02:30', prev: 24, prevTime: '22:30' },
  ]);
});

test('invalid files are rejected or flagged', () => {
  assert.throws(
    () => parseTmf(new Uint8Array(4)),
    (e) => e instanceof ScheduleError && e.code === 'tooShort',
  );
  const header = new Uint8Array(12);
  new DataView(header.buffer).setUint32(4, 9, true);
  assert.throws(
    () => parseTmf(header),
    (e) => e.code === 'channels' && e.params.count === 9,
  );
  const gm430 = new Uint8Array(12 + 56 * 2 + 3);
  new DataView(gm430.buffer).setUint32(0, 1, true);
  new DataView(gm430.buffer).setUint32(4, 5, true);
  const w = parseTmf(gm430).warnings;
  assert.deepEqual(w.slice(0, 2), [
    { code: 'deviceType', type: 'GM430' },
    { code: 'trailingBytes', count: 3 },
  ]);
});

test('checkSteps reports too few, too many, duplicate and invalid times', () => {
  assert.deepEqual(checkSteps([step(1, 0, [0, 0, 0, 0, 0])]), [{ code: 'tooFew' }]);
  assert.deepEqual(checkSteps(Array.from({ length: 51 }, (_, i) => step(0, i, [0])))[0], { code: 'tooMany', max: 50 });
  assert.deepEqual(checkSteps([step(1, 0, [0]), step(1, 0, [0])]), [{ code: 'sameTime', step: 2, prev: 1 }]);
  assert.deepEqual(checkSteps([step(1, 0, [0]), step(25, 0, [0])]), [{ code: 'invalidTime', step: 2, time: '25:0' }]);
  assert.deepEqual(checkSteps([step(1, 0, [0]), step(2, 0, [0])]), []);
});

test('warnings have an English description for the log', () => {
  assert.equal(
    describeWarning({ code: 'outOfOrder', step: 25, time: '02:30', prev: 24, prevTime: '22:30' }),
    'step 25 (02:30) comes before step 24 (22:30)',
  );
  assert.equal(describeWarning({ code: 'tooFew' }), 'fewer than 2 steps');
});

test('WINTER: expected levels fade linearly between steps', () => {
  const steps = parseTmf(schema('WINTER')).steps;
  assert.equal(at(steps, '03:00')[0], 10);
  assert.equal(at(steps, '07:15')[0], 40);
  assert.equal(at(steps, '13:00')[0], 100);
  assert.equal(at(steps, '20:15')[0], 40);
  assert.equal(at(steps, '23:59')[0], 10);
});

test('a jump step keeps the old level until its time', () => {
  const steps = [step(0, 0, [0, 0, 0, 0, 0]), step(12, 0, [100, 100, 0, 0, 0], [false, true, false, false, false])];
  assert.deepEqual(valuesAt(steps, 360).slice(0, 2), [50, 0]);
  assert.deepEqual(valuesAt(steps, 720).slice(0, 2), [100, 100]);
});

test('the night wraps from the last step to the first step of the next day', () => {
  const steps = [step(8, 0, [0, 0, 0, 0, 0]), step(20, 0, [100, 0, 0, 0, 0])];
  assert.equal(valuesAt(steps, 2 * 60)[0], 50); // halfway between 20:00 and 08:00
});
