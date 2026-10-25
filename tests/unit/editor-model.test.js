import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as E from '../../webapp/js/editor-model.js';
import { parseTmf } from '../../webapp/js/schedule.js';
import { TEMPLATES } from '../../webapp/js/templates.js';

const step = (hour, minute, level, jump = false) => ({
  hour,
  minute,
  ch: Array(5).fill(level),
  jump: Array(5).fill(jump),
});
const times = (steps) => steps.map((s) => E.minutesOf(s));
const base = [step(0, 0, 10), step(7, 0, 10), step(7, 30, 70), step(20, 0, 70), step(20, 30, 10)];

test('sortSteps sorts by time without touching the input', () => {
  const input = [step(12, 0, 1), step(1, 0, 2)];
  const out = E.sortSteps(input);
  assert.deepEqual(times(out), [60, 720]);
  assert.equal(input[0].hour, 12);
});

test('linked detection and linking copy channel 1 to all channels', () => {
  assert.ok(E.isLinked(base));
  const mixed = [{ hour: 0, minute: 0, ch: [10, 20, 0, 0, 0], jump: [true, false, false, false, false] }];
  assert.ok(!E.isLinked(mixed));
  const linked = E.linkChannels(mixed);
  assert.deepEqual(linked[0].ch, [10, 10, 10, 10, 10]);
  assert.deepEqual(linked[0].jump, [true, true, true, true, true]);
  assert.ok(E.isLinked(linked));
});

test('addStep inserts at the expected level so the curve does not change', () => {
  const out = E.addStep(base, 7 * 60 + 15);
  assert.deepEqual(times(out), [0, 420, 435, 450, 1200, 1230]);
  assert.equal(out[2].ch[0], 40);
  assert.equal(E.addStep(base, 7 * 60), null, 'duplicate time');
  const full = Array.from({ length: 50 }, (_, i) => step(0, i, 0));
  assert.equal(E.addStep(full, 600), null, 'max 50 steps');
});

test('suggestTime picks the middle of the largest gap', () => {
  assert.equal(E.suggestTime(base), 13 * 60 + 45); // middle of 07:30–20:00, the largest gap
  assert.equal(E.suggestTime([]), 0);
});

test('moveStep keeps steps sorted and refuses an occupied time', () => {
  const out = E.moveStep(base, 1, 21 * 60);
  assert.deepEqual(times(out), [0, 450, 1200, 1230, 1260]);
  assert.equal(E.moveStep(base, 1, 20 * 60), null);
  assert.equal(E.minutesOf(E.moveStep(base, 4, 5000)[4]), 1439, 'clamped to 23:59');
});

test('removeStep keeps at least 2 steps', () => {
  assert.equal(E.removeStep(base, 0).length, 4);
  assert.equal(E.removeStep(base.slice(0, 2), 0), null);
  assert.equal(E.removeStep(base, 9), null);
});

test('setLevel and setJump for one channel or all channels', () => {
  assert.deepEqual(E.setLevel(base, 1, null, 55)[1].ch, [55, 55, 55, 55, 55]);
  assert.deepEqual(E.setLevel(base, 1, 2, 120)[1].ch, [10, 10, 100, 10, 10]);
  assert.deepEqual(E.setJump(base, 1, null, true)[1].jump, [true, true, true, true, true]);
  assert.deepEqual(E.setJump(base, 1, 4, true)[1].jump, [false, false, false, false, true]);
  assert.deepEqual(base[1].ch, [10, 10, 10, 10, 10], 'input unchanged');
});

test('history undoes and redoes snapshots and clears redo after a new edit', () => {
  const h = new E.History(3);
  assert.equal(h.undo({ v: 0 }), null);
  h.push({ v: 1 });
  h.push({ v: 2 });
  assert.deepEqual(h.undo({ v: 3 }), { v: 2 });
  assert.deepEqual(h.redo({ v: 2 }), { v: 3 });
  h.undo({ v: 3 });
  h.push({ v: 9 });
  assert.equal(h.canRedo, false);
  for (let i = 0; i < 10; i++) h.push({ v: i });
  assert.equal(h.past.length, 3, 'limited depth');
});

test('PLed example templates match the bundled .tmf files (sorted by time)', () => {
  for (const [id, file] of [
    ['afrika', 'AFRIKA'],
    ['amazone', 'AMAZONE'],
    ['thailand', 'THAILAND'],
  ]) {
    const fromFile = E.sortSteps(parseTmf(readFileSync(new URL(`../../schemas/${file}.tmf`, import.meta.url))).steps);
    assert.deepEqual(TEMPLATES[id].steps(), fromFile, id);
    assert.equal(TEMPLATES[id].name, file);
  }
});

test('the winter template equals the WINTER.tmf the user made', () => {
  const fromFile = parseTmf(readFileSync(new URL('../../schemas/WINTER.tmf', import.meta.url))).steps;
  assert.deepEqual(TEMPLATES.winter.steps(), fromFile);
});

test('all templates are valid programs with linked flags that match their steps', () => {
  for (const [id, tpl] of Object.entries(TEMPLATES)) {
    const steps = tpl.steps();
    assert.ok(steps.length >= 2 && steps.length <= 50, id);
    assert.ok(tpl.name.length <= 8 && /^[A-Z0-9 -]+$/.test(tpl.name), id);
    assert.deepEqual(
      times(steps),
      [...times(steps)].sort((a, b) => a - b),
      `${id} sorted`,
    );
    if (tpl.linked) assert.ok(E.isLinked(steps), `${id} linked`);
  }
});
