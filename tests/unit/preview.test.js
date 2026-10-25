import { test } from 'node:test';
import assert from 'node:assert/strict';
import { advance, clockAt } from '../../webapp/js/preview.js';

test('playback advances a whole day in the chosen number of minutes and wraps at midnight', () => {
  assert.equal(advance(0, 60000, 1), 0); // one day in 1 minute: back at 00:00
  assert.equal(advance(0, 30000, 1), 720);
  assert.equal(advance(0, 60000, 2), 720);
  assert.equal(advance(1380, 5 * 60000 * (120 / 1440), 5), 60); // 23:00 + 2 h → 01:00
  assert.ok(Math.abs(advance(600, 100, 2) - (600 + (100 / 120000) * 1440)) < 1e-9);
});

test('shows the playback time as hh:mm', () => {
  assert.equal(clockAt(0), '00:00');
  assert.equal(clockAt(450.9), '07:30');
  assert.equal(clockAt(1439.99), '23:59');
});
